import re

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from .tarifas import envio_entre, opciones_de_envio
from .models import Pedido, Negocio, Sucursal, Tarifa, Producto, DetallePedido, Direccion, Usuario, PerfilMotorizado, ESTADOS_FINALES



def validar_telefono(value):
    """Solo números, espacios, guiones y un + al inicio. Devuelve el texto sin espacios en los extremos."""
    value = value.strip()
    if value and not re.fullmatch(r'\+?[0-9][0-9\s\-]{6,19}', value):
        raise serializers.ValidationError(
            'Ingresa un teléfono válido (solo números, espacios, guiones y un + al inicio).'
        )
    return value


class RecogidaMixin(serializers.Serializer):
    """Dónde se recoge el pedido y, en los encargos, quién lo entrega. Igual en comida y encargo."""
    recogida = serializers.SerializerMethodField()
    contacto = serializers.SerializerMethodField()

    def get_recogida(self, pedido):
        return {
            'nombre': pedido.nombre_recogida,
            'direccion': pedido.recogida_direccion,
            'referencia': pedido.recogida_referencia,
            'lat': str(pedido.recogida_lat),
            'lng': str(pedido.recogida_lng),
        }

    def telefono_visible(self, pedido):
        return True

    def get_contacto(self, pedido):
        if pedido.tipo != Pedido.Tipo.ENCARGO:
            return None
        return {
            'nombre': pedido.contacto_nombre,
            'telefono': pedido.contacto_telefono if self.telefono_visible(pedido) else None,
        }


class SucursalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Sucursal
        fields = ['id', 'nombre', 'direccion', 'lat', 'lng', 'abierta']


class NegocioSerializer(serializers.ModelSerializer):
    sucursales = SucursalSerializer(many=True, read_only=True)

    class Meta:
        model = Negocio
        fields = ['id', 'nombre', 'sucursales']


class NegocioResumenSerializer(serializers.ModelSerializer):
    """El negocio tal como aparece dentro de un pedido: solo la marca (la ubicación es de la sucursal)."""
    class Meta:
        model = Negocio
        fields = ['id', 'nombre']


class ProductoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Producto
        fields = ['id', 'nombre', 'precio', 'disponible', 'descripcion', 'imagen']

class DetallePedidoSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source='producto.nombre', read_only=True)

    class Meta:
        model = DetallePedido
        fields = ['producto', 'producto_nombre', 'cantidad', 'precio_unitario']
        read_only_fields = ['precio_unitario']

class PedidoCreateSerializer(serializers.ModelSerializer):
    detalles = DetallePedidoSerializer(many=True)

    class Meta:
        model = Pedido
        fields = [
            'negocio', 'sucursal', 'destino_direccion', 'destino_referencia', 'destino_lat', 'destino_lng',
            'descripcion', 'detalles', 'distancia_km', 'costo_envio',
        ]
        read_only_fields = ['distancia_km', 'costo_envio']
        # Si no se indica sucursal se usa la más cercana al destino.
        extra_kwargs = {'sucursal': {'required': False}}

    def validate_destino_lat(self, valor):
        if not -90 <= valor <= 90:
            raise serializers.ValidationError('Latitud fuera de rango.')
        return valor

    def validate_destino_lng(self, valor):
        if not -180 <= valor <= 180:
            raise serializers.ValidationError('Longitud fuera de rango.')
        return valor

    def validate(self, datos):
        negocio = datos['negocio']
        for detalle in datos['detalles']:
            producto = detalle['producto']
            if producto.negocio_id != negocio.id or not producto.disponible:
                raise serializers.ValidationError(
                    {'detalles': [f'"{producto.nombre}" no está disponible en {negocio.nombre}.']}
                )

        opciones = opciones_de_envio(negocio, datos['destino_lat'], datos['destino_lng']) if negocio.activo else []
        if not opciones:
            raise serializers.ValidationError(
                {'sucursal': ['Este restaurante no tiene sucursales abiertas en este momento.']}
            )
        elegida = datos.get('sucursal')
        if elegida is None:
            opcion = opciones[0]  # la más cercana al destino
        else:
            opcion = next((o for o in opciones if o['sucursal'].id == elegida.id), None)
            if opcion is None:
                raise serializers.ValidationError(
                    {'sucursal': ['Esa sucursal no pertenece al restaurante o está cerrada.']}
                )
        # El envío lo calcula el servidor, nunca viene del cliente, y queda congelado en el pedido.
        datos['sucursal'] = opcion['sucursal']
        datos['_envio'] = {
            'distancia_km': opcion['distancia_km'],
            'costo_envio': opcion['costo_envio'],
            'comision_porcentaje': Tarifa.actual().comision_porcentaje,
        }
        return datos

    @transaction.atomic
    def create(self, validated_data):
        detalles_data = validated_data.pop('detalles')
        envio = validated_data.pop('_envio')
        sucursal = validated_data['sucursal']
        pedido = Pedido.objects.create(
            **validated_data, **envio,
            recogida_direccion=sucursal.direccion, recogida_lat=sucursal.lat, recogida_lng=sucursal.lng,
        )

        for detalle in detalles_data:
            producto = detalle['producto']
            DetallePedido.objects.create(
                pedido=pedido,
                producto=producto,
                cantidad=detalle['cantidad'],
                precio_unitario=producto.precio,
            )
        return pedido

class PedidoSerializer(RecogidaMixin, serializers.ModelSerializer):
    negocio = NegocioResumenSerializer(read_only=True)
    sucursal = SucursalSerializer(read_only=True)
    detalles = DetallePedidoSerializer(many=True, read_only=True)
    class Meta:
        model = Pedido
        fields = [
            'id',
            'tipo',
            'descripcion',
            'negocio',
            'sucursal',
            'recogida',
            'contacto',
            'pagar_en_recogida',
            'monto_estimado',
            'estado',
            'precio',
            'destino_direccion',
            'destino_referencia',
            'destino_lat',
            'destino_lng',
            'creado_en',
            'motivo_cancelacion',
            'distancia_km',
            'costo_envio',
            'detalles',
        ]
        read_only_fields = fields

class DireccionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Direccion
        fields = ['id', 'etiqueta', 'direccion', 'referencia', 'lat', 'lng']


class PerfilSerializer(serializers.ModelSerializer):
    class Meta:
        model = Usuario
        fields = ['username', 'rol', 'first_name', 'last_name', 'telefono']
        read_only_fields = ['username', 'rol']

    def validate_telefono(self, value):
        return validar_telefono(value)


class PerfilMotorizadoSerializer(PerfilSerializer):
    """Perfil del motorizado: los datos de usuario más su vehículo (que vive en PerfilMotorizado)."""
    vehiculo_placa = serializers.CharField(max_length=10, required=False, allow_blank=True)
    vehiculo_modelo = serializers.CharField(max_length=60, required=False, allow_blank=True)
    vehiculo_color = serializers.CharField(max_length=30, required=False, allow_blank=True)
    entregas_completadas = serializers.SerializerMethodField()
    entregas_hoy = serializers.SerializerMethodField()

    CAMPOS_VEHICULO = ['vehiculo_placa', 'vehiculo_modelo', 'vehiculo_color']

    class Meta(PerfilSerializer.Meta):
        fields = PerfilSerializer.Meta.fields + [
            'vehiculo_placa', 'vehiculo_modelo', 'vehiculo_color',
            'entregas_completadas', 'entregas_hoy', 'date_joined',
        ]
        read_only_fields = ['username', 'rol', 'date_joined']

    def _entregas(self, usuario):
        return Pedido.objects.filter(motorizado=usuario, estado=Pedido.Estado.ENTREGADO)

    def get_entregas_completadas(self, usuario):
        return self._entregas(usuario).count()

    def get_entregas_hoy(self, usuario):
        return self._entregas(usuario).filter(actualizado_en__date=timezone.localdate()).count()

    def to_representation(self, usuario):
        datos = super().to_representation(usuario)
        perfil = getattr(usuario, 'perfil_motorizado', None)
        for campo in self.CAMPOS_VEHICULO:
            datos[campo] = getattr(perfil, campo, '') if perfil else ''
        return datos

    def validate_vehiculo_placa(self, value):
        value = re.sub(r'\s+', '', value).upper()
        if value and not re.fullmatch(r'[A-Z0-9\-]{5,10}', value):
            raise serializers.ValidationError('Ingresa una placa válida (letras, números y guion, ej. ABC-1234).')
        return value

    def validate_vehiculo_modelo(self, value):
        return value.strip()

    def validate_vehiculo_color(self, value):
        return value.strip()

    def update(self, usuario, validated_data):
        vehiculo = {c: validated_data.pop(c) for c in self.CAMPOS_VEHICULO if c in validated_data}
        with transaction.atomic():
            usuario = super().update(usuario, validated_data)
            if vehiculo:
                perfil, _ = PerfilMotorizado.objects.get_or_create(usuario=usuario)
                for campo, valor in vehiculo.items():
                    setattr(perfil, campo, valor)
                perfil.save()
        return usuario


class ClienteContactoSerializer(serializers.ModelSerializer):
    nombre = serializers.SerializerMethodField()

    class Meta:
        model = Usuario
        fields = ['nombre', 'telefono']

    def get_nombre(self, obj):
        return obj.get_full_name() or obj.username


class PedidoMotorizadoSerializer(RecogidaMixin, serializers.ModelSerializer):
    negocio = NegocioResumenSerializer(read_only=True)
    sucursal = SucursalSerializer(read_only=True)
    cliente = serializers.SerializerMethodField()
    detalles = DetallePedidoSerializer(many=True, read_only=True)

    def telefono_visible(self, pedido):
        return pedido.estado not in ESTADOS_FINALES

    def get_cliente(self, pedido):
        contacto = ClienteContactoSerializer(pedido.cliente).data
        if pedido.estado in ESTADOS_FINALES:
            contacto['telefono'] = None
        return contacto

    class Meta:
        model = Pedido
        fields = ['id', 'tipo', 'descripcion', 'negocio', 'sucursal', 'recogida', 'contacto', 'pagar_en_recogida', 'monto_estimado', 'cliente', 'destino_direccion', 'destino_referencia', 'destino_lat', 'destino_lng', 'estado', 'motivo_cancelacion', 'distancia_km', 'costo_envio', 'creado_en', 'detalles']


class UsuarioResumenSerializer(serializers.ModelSerializer):
    nombre = serializers.SerializerMethodField()

    class Meta:
        model = Usuario
        fields = ['id', 'nombre', 'telefono']

    def get_nombre(self, obj):
        return obj.get_full_name() or obj.username


class MotorizadoDespachoSerializer(UsuarioResumenSerializer):
    entregas_activas = serializers.IntegerField(read_only=True)

    class Meta(UsuarioResumenSerializer.Meta):
        fields = UsuarioResumenSerializer.Meta.fields + ['entregas_activas']


class DespachoPedidoSerializer(RecogidaMixin, serializers.ModelSerializer):
    negocio = NegocioResumenSerializer(read_only=True)
    sucursal = SucursalSerializer(read_only=True)
    cliente = UsuarioResumenSerializer(read_only=True)
    motorizado = UsuarioResumenSerializer(read_only=True)
    detalles = DetallePedidoSerializer(many=True, read_only=True)
    total = serializers.SerializerMethodField()

    def get_total(self, pedido):
        # Lo que paga el cliente: productos + envío (los pedidos anteriores a las tarifas no tienen envío).
        productos = sum(d.precio_unitario * d.cantidad for d in pedido.detalles.all())
        return productos + (pedido.costo_envio or 0)

    class Meta:
        model = Pedido
        fields = [
            'id', 'tipo', 'descripcion', 'estado', 'creado_en', 'negocio', 'sucursal', 'recogida', 'contacto',
            'pagar_en_recogida', 'monto_estimado', 'cliente', 'motorizado',
            'destino_direccion', 'destino_referencia', 'costo_envio', 'distancia_km', 'total', 'motivo_cancelacion', 'detalles',
        ]


class CotizarEnvioSerializer(serializers.Serializer):
    negocio = serializers.PrimaryKeyRelatedField(queryset=Negocio.objects.filter(activo=True))
    destino_lat = serializers.DecimalField(max_digits=10, decimal_places=7, min_value=-90, max_value=90)
    destino_lng = serializers.DecimalField(max_digits=10, decimal_places=7, min_value=-180, max_value=180)


class CancelarPedidoSerializer(serializers.Serializer):
    motivo = serializers.CharField(max_length=255, required=False, allow_blank=True, default='')

    def validate_motivo(self, valor):
        return valor.strip()


class AsignarMotorizadoSerializer(serializers.Serializer):
    motorizado = serializers.PrimaryKeyRelatedField(
        queryset=Usuario.objects.filter(rol=Usuario.Rol.MOTORIZADO, is_active=True),
        allow_null=True,
    )

def _validar_coordenadas(datos, prefijos):
    for prefijo in prefijos:
        if not -90 <= datos[f'{prefijo}_lat'] <= 90:
            raise serializers.ValidationError({f'{prefijo}_lat': ['Latitud fuera de rango.']})
        if not -180 <= datos[f'{prefijo}_lng'] <= 180:
            raise serializers.ValidationError({f'{prefijo}_lng': ['Longitud fuera de rango.']})


class CotizarEncargoSerializer(serializers.Serializer):
    recogida_lat = serializers.DecimalField(max_digits=10, decimal_places=7)
    recogida_lng = serializers.DecimalField(max_digits=10, decimal_places=7)
    destino_lat = serializers.DecimalField(max_digits=10, decimal_places=7)
    destino_lng = serializers.DecimalField(max_digits=10, decimal_places=7)

    def validate(self, datos):
        _validar_coordenadas(datos, ('recogida', 'destino'))
        return datos


class EncargoCreateSerializer(serializers.ModelSerializer):
    """Un encargo: recoger algo en cualquier lugar y llevarlo al destino. El envío lo calcula el servidor."""

    class Meta:
        model = Pedido
        fields = [
            'descripcion', 'recogida_direccion', 'recogida_referencia', 'recogida_lat', 'recogida_lng',
            'contacto_nombre', 'contacto_telefono', 'pagar_en_recogida', 'monto_estimado',
            'destino_direccion', 'destino_referencia', 'destino_lat', 'destino_lng',
            'distancia_km', 'costo_envio',
        ]
        read_only_fields = ['distancia_km', 'costo_envio']
        extra_kwargs = {
            'descripcion': {'required': True, 'allow_blank': False},
            'contacto_nombre': {'required': True, 'allow_blank': False},
            'contacto_telefono': {'required': True, 'allow_blank': False},
        }

    def validate_contacto_telefono(self, valor):
        return validar_telefono(valor)

    def validate(self, datos):
        _validar_coordenadas(datos, ('recogida', 'destino'))
        if datos.get('pagar_en_recogida'):
            if not datos.get('monto_estimado') or datos['monto_estimado'] <= 0:
                raise serializers.ValidationError(
                    {'monto_estimado': ['Indica cuánto debe pagar aproximadamente el motorizado.']}
                )
        else:
            datos['monto_estimado'] = None
        envio = envio_entre(datos['recogida_lat'], datos['recogida_lng'], datos['destino_lat'], datos['destino_lng'])
        datos['_envio'] = {**envio, 'comision_porcentaje': Tarifa.actual().comision_porcentaje}
        return datos

    def create(self, datos):
        envio = datos.pop('_envio')
        return Pedido.objects.create(tipo=Pedido.Tipo.ENCARGO, **datos, **envio)


class DespachoEncargoCreateSerializer(EncargoCreateSerializer):
    """Lo crea el despachador a nombre de un cliente que pidió por llamada o WhatsApp."""
    cliente_nombre = serializers.CharField(max_length=150, write_only=True)
    cliente_telefono = serializers.CharField(max_length=20, write_only=True)

    class Meta(EncargoCreateSerializer.Meta):
        fields = EncargoCreateSerializer.Meta.fields + ['cliente_nombre', 'cliente_telefono']

    def validate_cliente_telefono(self, valor):
        valor = validar_telefono(valor)
        if not valor:
            raise serializers.ValidationError('Este campo es obligatorio.')
        return re.sub(r'[\s-]', '', valor)

    @transaction.atomic
    def create(self, datos):
        nombre = datos.pop('cliente_nombre').strip()
        telefono = datos.pop('cliente_telefono')
        # Si ya hay un cliente con ese teléfono se reutiliza; si no, se crea uno sin contraseña (no puede iniciar sesión).
        cliente = Usuario.objects.filter(rol=Usuario.Rol.CLIENTE, telefono=telefono).first()
        if cliente is None:
            cliente = Usuario(
                username=f'tel_{re.sub(r"[^0-9]", "", telefono)}', rol=Usuario.Rol.CLIENTE,
                first_name=nombre, telefono=telefono,
            )
            cliente.set_unusable_password()
            cliente.save()
        datos['cliente'] = cliente
        return super().create(datos)
