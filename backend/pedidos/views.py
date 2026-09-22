from datetime import date, datetime, time, timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, generics
from .models import Pedido, Tarifa, Negocio, Producto, Direccion, Usuario, ESTADOS_FINALES, ESTADOS_ACTIVOS, SIGUIENTE_ESTADO, ESTADOS_CANCELABLES
from .permissions import EsDespachador
from .tarifas import envio_entre, opciones_de_envio
from django.db.models import Case, Count, IntegerField, Q, Value, When
from django.db import transaction
from django.shortcuts import get_object_or_404
from .serializers import (
    PedidoSerializer, NegocioSerializer, ProductoSerializer, PedidoCreateSerializer,
    PedidoMotorizadoSerializer, DireccionSerializer, PerfilSerializer, PerfilMotorizadoSerializer,
    DespachoPedidoSerializer, MotorizadoDespachoSerializer, AsignarMotorizadoSerializer, CancelarPedidoSerializer, CotizarEnvioSerializer, SucursalSerializer,
    CotizarEncargoSerializer, EncargoCreateSerializer, DespachoEncargoCreateSerializer,
)

# 0 = activo, 1 = entregado/cancelado: ordenar por esto deja los activos arriba y los finalizados abajo.
FINALIZADO = Case(
    When(estado__in=ESTADOS_FINALES, then=Value(1)),
    default=Value(0),
    output_field=IntegerField(),
)


class NegocioListView(generics.ListAPIView):
    queryset = Negocio.objects.filter(activo=True).prefetch_related('sucursales')
    serializer_class = NegocioSerializer

class ProductoListView(generics.ListAPIView):
    serializer_class = ProductoSerializer

    def get_queryset(self):
        negocio_id = self.kwargs['negocio_id']
        return Producto.objects.filter(negocio=negocio_id, disponible=True)

class PedidoListCreateView(APIView):

    def get(self, request):
        # 1. Trae solo los pedidos del usuario logueado (request.user)
        pedidos = (
            Pedido.objects.filter(cliente=request.user)
            .select_related('negocio', 'sucursal')
            .prefetch_related('detalles__producto')
            .annotate(finalizado=FINALIZADO)
            .order_by('finalizado', '-creado_en', '-id')
        )
        # 2. Conviértelos a JSON con el serializer (pista: many=True porque es una lista)
        serializer = PedidoSerializer(pedidos, many=True)
        return Response(serializer.data)

    def post(self, request):
        if not (request.user.first_name and request.user.telefono):
            return Response(
                {'detail': 'Completa tu nombre y teléfono en "Mis datos" para poder hacer pedidos.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # 3. Crea un serializer con los datos que llegaron (request.data)
        serializer = PedidoCreateSerializer(data=request.data)
        # 4. Valida. Si es válido, guarda asignando cliente=request.user
        if serializer.is_valid():
            serializer.save(cliente=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        # 5. Si no es válido, devuelve los errores con status 400
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class CotizarEnvioView(APIView):
    """Calcula el envío sin crear nada, para mostrarlo antes de confirmar el pedido."""

    def post(self, request):
        entrada = CotizarEnvioSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        datos = entrada.validated_data
        opciones = opciones_de_envio(datos['negocio'], datos['destino_lat'], datos['destino_lng'])
        if not opciones:
            return Response(
                {'detail': 'Este restaurante no tiene sucursales abiertas en este momento.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response({
            'sugerida': opciones[0]['sucursal'].id,  # la más cercana al destino
            'opciones': [
                {
                    'sucursal': SucursalSerializer(o['sucursal']).data,
                    # Como texto, igual que el resto de montos de la API.
                    'distancia_km': str(o['distancia_km']),
                    'costo_envio': str(o['costo_envio']),
                }
                for o in opciones
            ],
        })


class CotizarEncargoView(APIView):
    """Envío de un encargo (de cualquier punto a cualquier punto), sin crear nada."""

    def post(self, request):
        entrada = CotizarEncargoSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        d = entrada.validated_data
        envio = envio_entre(d['recogida_lat'], d['recogida_lng'], d['destino_lat'], d['destino_lng'])
        return Response({campo: str(valor) for campo, valor in envio.items()})


class EncargoCreateView(APIView):
    def post(self, request):
        # Igual que en los pedidos de comida: el motorizado necesita poder llamar al cliente.
        if not (request.user.first_name and request.user.telefono):
            return Response(
                {'detail': 'Completa tu nombre y teléfono en "Mis datos" para poder hacer pedidos.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = EncargoCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        pedido = serializer.save(cliente=request.user)
        return Response(PedidoSerializer(pedido).data, status=status.HTTP_201_CREATED)


class DespachoEncargoCreateView(APIView):
    permission_classes = [EsDespachador]

    def post(self, request):
        serializer = DespachoEncargoCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        pedido = serializer.save()
        pedido = Pedido.objects.select_related('negocio', 'sucursal', 'cliente', 'motorizado').get(pk=pedido.pk)
        return Response(DespachoPedidoSerializer(pedido).data, status=status.HTTP_201_CREATED)


class PerfilView(generics.RetrieveUpdateAPIView):
    serializer_class = PerfilSerializer
    http_method_names = ['get', 'patch', 'head', 'options']

    def get_serializer_class(self):
        if self.request.user.rol == Usuario.Rol.MOTORIZADO:
            return PerfilMotorizadoSerializer
        return PerfilSerializer

    def get_object(self):
        return self.request.user


class PedidoDetailView(generics.RetrieveAPIView):
    serializer_class = PedidoSerializer

    def get_queryset(self):
        return (
            Pedido.objects.filter(cliente=self.request.user)
            .select_related('negocio', 'sucursal')
            .prefetch_related('detalles__producto')
        )

def entregas_del_motorizado(usuario):
    return (
        Pedido.objects.filter(motorizado=usuario)
        .select_related('negocio', 'sucursal', 'cliente')
        .prefetch_related('detalles__producto')
    )


class MisEntregasView(generics.ListAPIView):
    serializer_class = PedidoMotorizadoSerializer

    def get_queryset(self):
        return (
            entregas_del_motorizado(self.request.user)
            .annotate(finalizado=FINALIZADO)
            .order_by('finalizado', '-creado_en', '-id')
        )


class MiEntregaDetailView(generics.RetrieveAPIView):
    serializer_class = PedidoMotorizadoSerializer

    def get_queryset(self):
        return entregas_del_motorizado(self.request.user)

class DireccionListCreateView(APIView):
    def get(self, request):
        direcciones = Direccion.objects.filter(cliente=request.user)
        serializer = DireccionSerializer(direcciones, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = DireccionSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(cliente=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class ActualizarEstadoPedidoView(APIView):
    def patch(self, request, pk):
        with transaction.atomic():
            # Se bloquea la fila para que dos peticiones simultáneas no se salten un estado.
            pedido = get_object_or_404(Pedido.objects.select_for_update(), pk=pk)

            if pedido.motorizado != request.user:
                return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)

            nuevo = request.data.get('estado')
            permitido = SIGUIENTE_ESTADO.get(pedido.estado)
            if permitido is None:
                return Response(
                    {'estado': [f'El pedido ya está {pedido.get_estado_display().lower()} y no admite cambios.']},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if nuevo != permitido:
                return Response(
                    {'estado': [f'Desde {pedido.get_estado_display()} solo se puede pasar a {permitido.label}.']},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            pedido.estado = permitido
            pedido.save()
        return Response(PedidoMotorizadoSerializer(pedido).data)

class DireccionDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = DireccionSerializer

    def get_queryset(self):
        return Direccion.objects.filter(cliente=self.request.user)

class DespachoPedidoListView(generics.ListAPIView):
    permission_classes = [EsDespachador]
    serializer_class = DespachoPedidoSerializer
    LIMITE_POR_DEFECTO = 200
    LIMITE_MAXIMO = 500

    def get_queryset(self):
        prioridad = Case(
            When(estado__in=ESTADOS_FINALES, then=Value(2)),
            When(motorizado__isnull=True, then=Value(0)),
            default=Value(1),
            output_field=IntegerField(),
        )
        try:
            limite = int(self.request.query_params.get('limite', self.LIMITE_POR_DEFECTO))
        except ValueError:
            limite = self.LIMITE_POR_DEFECTO
        limite = max(1, min(limite, self.LIMITE_MAXIMO))

        return (
            Pedido.objects.select_related('negocio', 'sucursal', 'cliente', 'motorizado')
            .prefetch_related('detalles__producto')
            .annotate(prioridad=prioridad)
            .order_by('prioridad', '-creado_en', '-id')[:limite]
        )


class DespachoMotorizadoListView(generics.ListAPIView):
    permission_classes = [EsDespachador]
    serializer_class = MotorizadoDespachoSerializer

    def get_queryset(self):
        return (
            Usuario.objects.filter(rol=Usuario.Rol.MOTORIZADO, is_active=True)
            .annotate(
                entregas_activas=Count(
                    'pedidos_como_motorizado',
                    filter=Q(pedidos_como_motorizado__estado__in=ESTADOS_ACTIVOS),
                )
            )
            .order_by('entregas_activas', 'username')
        )


class DespachoAsignarView(APIView):
    permission_classes = [EsDespachador]

    def patch(self, request, pk):
        pedido = get_object_or_404(Pedido, pk=pk)
        entrada = AsignarMotorizadoSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        motorizado = entrada.validated_data['motorizado']

        if pedido.estado in ESTADOS_FINALES:
            return Response(
                {'detail': 'No se puede reasignar un pedido finalizado.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        ya_en_ruta = pedido.estado in (Pedido.Estado.RECOGIDO, Pedido.Estado.EN_CAMINO)
        if motorizado is None and ya_en_ruta:
            return Response(
                {'detail': 'El pedido ya fue recogido: reasígnalo a otro motorizado en vez de quitarlo.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if motorizado is not None and pedido.estado == Pedido.Estado.PENDIENTE:
            pedido.estado = Pedido.Estado.ACEPTADO
        elif motorizado is None and pedido.estado == Pedido.Estado.ACEPTADO:
            pedido.estado = Pedido.Estado.PENDIENTE
        pedido.motorizado = motorizado
        pedido.save()

        pedido = (
            Pedido.objects.select_related('negocio', 'sucursal', 'cliente', 'motorizado')
            .prefetch_related('detalles__producto')
            .get(pk=pedido.pk)
        )
        return Response(DespachoPedidoSerializer(pedido).data)


class DespachoCancelarView(APIView):
    permission_classes = [EsDespachador]

    def post(self, request, pk):
        entrada = CancelarPedidoSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)

        with transaction.atomic():
            # Se bloquea la fila: si el motorizado marca "Recogido" al mismo tiempo, uno de los dos gana y el otro ve el estado real.
            pedido = get_object_or_404(Pedido.objects.select_for_update(), pk=pk)
            if pedido.estado not in ESTADOS_CANCELABLES:
                return Response(
                    {'detail': f'No se puede cancelar un pedido {pedido.get_estado_display().lower()}.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            pedido.estado = Pedido.Estado.CANCELADO
            pedido.motivo_cancelacion = entrada.validated_data['motivo']
            pedido.save()

        pedido = (
            Pedido.objects.select_related('negocio', 'sucursal', 'cliente', 'motorizado')
            .prefetch_related('detalles__producto')
            .get(pk=pedido.pk)
        )
        return Response(DespachoPedidoSerializer(pedido).data)


CENTAVOS = Decimal('0.01')


def _nombre(usuario):
    return usuario.get_full_name() or usuario.username


def _totales(carreras):
    """Suma de un grupo de carreras: total, comisión (cada carrera con su % congelado) y neto del motorizado."""
    total = sum((c.costo_envio or 0 for c in carreras), Decimal(0))
    comision = sum(((c.costo_envio or 0) * c.comision_porcentaje / 100 for c in carreras), Decimal(0))
    comision = comision.quantize(CENTAVOS, rounding=ROUND_HALF_UP)
    return {
        'carreras': len(carreras),
        'total': str(total.quantize(CENTAVOS)),
        'comision': str(comision),
        'neto': str((total - comision).quantize(CENTAVOS)),
    }


class DespachoGananciasView(APIView):
    """Carreras entregadas en un rango de días (hora de Ecuador) y lo que cada motorizado debe a la empresa."""
    permission_classes = [EsDespachador]
    LIMITE_FILAS = 500
    LIMITE_DIAS = 366

    def get(self, request):
        hoy = timezone.localdate()
        try:
            desde = date.fromisoformat(request.query_params.get('desde') or hoy.isoformat())
            hasta = date.fromisoformat(request.query_params.get('hasta') or hoy.isoformat())
            motorizado_id = int(request.query_params['motorizado']) if request.query_params.get('motorizado') else None
        except ValueError:
            return Response({'detail': 'Fechas (AAAA-MM-DD) o motorizado inválidos.'}, status=status.HTTP_400_BAD_REQUEST)
        if desde > hasta or (hasta - desde).days > self.LIMITE_DIAS:
            return Response({'detail': 'El rango de fechas no es válido (máximo un año).'}, status=status.HTTP_400_BAD_REQUEST)

        zona = timezone.get_current_timezone()
        inicio = datetime.combine(desde, time.min, tzinfo=zona)
        fin = datetime.combine(hasta + timedelta(days=1), time.min, tzinfo=zona)
        entregas = (
            Pedido.objects.filter(
                estado=Pedido.Estado.ENTREGADO, motorizado__isnull=False,
                entregado_en__gte=inicio, entregado_en__lt=fin,
            )
            .select_related('negocio', 'sucursal', 'motorizado')
            .order_by('-entregado_en', '-id')
        )
        if motorizado_id:
            entregas = entregas.filter(motorizado_id=motorizado_id)
        # ponytail: se suma en Python; con miles de carreras por rango pasar a agregados en la base de datos.
        carreras = list(entregas)

        grupos = {}
        for c in carreras:
            grupos.setdefault(c.motorizado, []).append(c)
        por_motorizado = sorted(
            (
                {'motorizado': {'id': m.id, 'nombre': _nombre(m)}, **_totales(lista)}
                for m, lista in grupos.items()
            ),
            key=lambda fila: Decimal(fila['total']), reverse=True,
        )
        # Sin carreras en el rango se muestra el porcentaje vigente.
        porcentajes = {c.comision_porcentaje for c in carreras} or {Tarifa.actual().comision_porcentaje}

        return Response({
            'desde': desde.isoformat(),
            'hasta': hasta.isoformat(),
            # Un solo % si todas las carreras del rango usaron el mismo; null si cambió en el período.
            'comision_porcentaje': str(porcentajes.pop().normalize()) if len(porcentajes) == 1 else None,
            'resumen': {**_totales(carreras), 'sin_valor': sum(1 for c in carreras if c.costo_envio is None)},
            'por_motorizado': por_motorizado,
            'carreras_truncadas': len(carreras) > self.LIMITE_FILAS,
            'carreras': [
                {
                    'id': c.id,
                    'entregado_en': c.entregado_en,
                    'motorizado': {'id': c.motorizado.id, 'nombre': _nombre(c.motorizado)},
                    'recogida': c.nombre_recogida,
                    'destino_direccion': c.destino_direccion,
                    'distancia_km': c.distancia_km,
                    'costo_envio': c.costo_envio,
                }
                for c in carreras[:self.LIMITE_FILAS]
            ],
        })
