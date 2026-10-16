import io
from unittest import mock

from decimal import Decimal

from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient

from . import push
from .models import DetallePedido, Negocio, Pedido, Producto, Sucursal, Tarifa, Usuario


class SaludTests(TestCase):
    def test_salud_no_pide_sesion_ni_toca_la_base(self):
        with self.assertNumQueries(0):
            r = APIClient().get('/api/salud/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json(), {'ok': True})


class ConsultasConstantesTests(TestCase):
    """Las listas no deben hacer más consultas por cada pedido (N+1): 1 pedido y 6 deben costar igual."""

    @classmethod
    def setUpTestData(cls):
        cls.cliente = Usuario.objects.create_user('cli', first_name='Ana', telefono='0999999999')
        cls.moto = Usuario.objects.create_user('moto', es_motorizado=True, first_name='Moto')
        cls.desp = Usuario.objects.create_user('desp', es_despachador=True)
        cls.negocio = Negocio.objects.create(nombre='Don Pollo')
        cls.sucursal = Sucursal.objects.create(negocio=cls.negocio, direccion='Calle 1', lat=-2, lng=-79)
        cls.producto = Producto.objects.create(negocio=cls.negocio, nombre='Pollo', precio=Decimal('5.00'))

    def crear_pedidos(self, cantidad):
        """Mezcla comida (con detalles) y encargos, todos del cliente y asignados al motorizado."""
        for i in range(cantidad):
            comida = i % 2 == 0
            p = Pedido.objects.create(
                cliente=self.cliente, motorizado=self.moto, tipo=Pedido.Tipo.COMIDA if comida else Pedido.Tipo.ENCARGO,
                negocio=self.negocio if comida else None, sucursal=self.sucursal if comida else None,
                recogida_direccion='Calle 1', recogida_lat=-2, recogida_lng=-79,
                destino_direccion='Calle 2', destino_lat=-2, destino_lng=-79,
                estado=Pedido.Estado.ENTREGADO, costo_envio=Decimal('2.00'), entregado_en=timezone.now(),
            )
            if comida:
                for _ in range(2):
                    DetallePedido.objects.create(pedido=p, producto=self.producto, cantidad=1, precio_unitario=5)

    def consultas(self, usuario, url):
        c = APIClient()
        c.force_authenticate(usuario)
        with CaptureQueriesContext(connection) as q:
            r = c.get(url)
        self.assertEqual(r.status_code, 200, url)
        return len(q)

    def test_listas_no_crecen_con_el_numero_de_pedidos(self):
        casos = [
            (self.cliente, '/api/pedidos/'),
            (self.moto, '/api/mis-entregas/'),
            (self.desp, '/api/despacho/pedidos/'),
            (self.moto, '/api/mis-entregas/ganancias/'),
            (self.desp, '/api/despacho/ganancias/'),
        ]
        self.crear_pedidos(2)
        pocos = [self.consultas(u, url) for u, url in casos]
        self.crear_pedidos(10)
        for (u, url), antes in zip(casos, pocos):
            self.assertEqual(self.consultas(u, url), antes, url)

    def test_detalle_de_encargo_no_consulta_el_cliente_aparte(self):
        self.crear_pedidos(2)
        encargo = Pedido.objects.filter(tipo=Pedido.Tipo.ENCARGO).first()
        comida = Pedido.objects.filter(tipo=Pedido.Tipo.COMIDA).first()
        self.assertEqual(
            self.consultas(self.cliente, f'/api/pedidos/{encargo.id}/'),
            self.consultas(self.cliente, f'/api/pedidos/{comida.id}/') - 1,  # la comida además trae sus detalles
        )


class TelefonoTests(TestCase):
    MSG = 'Ingresa un teléfono válido de Ecuador: celular 09XXXXXXXX (10 dígitos) o fijo 0XXXXXXXX (9 dígitos).'

    def test_validos_se_normalizan(self):
        from .serializers import validar_telefono
        casos = {
            '0991234567': '0991234567', '099 123 4567': '0991234567', '(099) 123-4567': '0991234567',
            '+593991234567': '0991234567', '593991234567': '0991234567', '+593 99 123 4567': '0991234567',
            '022345678': '022345678', '02-234.5678': '022345678', '+59322345678': '022345678',
            '072345678': '072345678', '': '', '  ': '',
        }
        for entrada, esperado in casos.items():
            self.assertEqual(validar_telefono(entrada), esperado, entrada)

    def test_invalidos_se_rechazan(self):
        from rest_framework import serializers
        from .serializers import validar_telefono
        for malo in ['099123456', '09912345678', 'abc', '0891234567', '082345678', '092345678',
                     '012345678', '+5938991234567', '+593 1 2345678', '991234567', '0991234567x', '０９９１２３４５６７', '٠٩٩١٢٣٤٥٦٧']:
            with self.assertRaises(serializers.ValidationError, msg=malo) as e:
                validar_telefono(malo)
            self.assertEqual(e.exception.detail[0], self.MSG)

    def test_perfil_normaliza_y_rechaza(self):
        u = Usuario.objects.create_user('perfil', first_name='Ana')
        c = APIClient()
        c.force_authenticate(u)
        r = c.patch('/api/perfil/', {'telefono': '+593 99 123 4567'}, format='json')
        self.assertEqual((r.status_code, r.data['telefono']), (200, '0991234567'))
        r = c.patch('/api/perfil/', {'telefono': '12345'}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data['telefono'][0], self.MSG)

    def encargo(self, **extra):
        return {
            'descripcion': 'Llaves', 'recogida_direccion': 'A', 'recogida_lat': '-0.25', 'recogida_lng': '-79.17',
            'destino_direccion': 'B', 'destino_lat': '-0.26', 'destino_lng': '-79.18',
            'cliente_nombre': 'Luis', **extra,
        }

    def test_despacho_telefono_obligatorio_normalizado_y_reutiliza_legado(self):
        Tarifa.objects.create(pk=1)  # Tarifa.actual() recien creada trae factor_calles como str
        desp = Usuario.objects.create_user('desp2', es_despachador=True)
        legado = Usuario.objects.create_user('legado', first_name='Viejo', telefono='099 123 4567')
        c = APIClient()
        c.force_authenticate(desp)
        r = c.post('/api/despacho/encargos/', self.encargo(cliente_telefono=''), format='json')
        self.assertEqual(r.status_code, 400)
        r = c.post('/api/despacho/encargos/', self.encargo(cliente_telefono='123'), format='json')
        self.assertEqual(r.data['cliente_telefono'][0], self.MSG)
        r = c.post('/api/despacho/encargos/', self.encargo(cliente_telefono='+593991234567'), format='json')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(Pedido.objects.get(pk=r.data['id']).cliente_id, legado.id)
        r = c.post('/api/despacho/encargos/', self.encargo(
            cliente_telefono='0987654321', recogida_contacto_telefono='+59322345678'), format='json')
        self.assertEqual(r.status_code, 201, r.data)
        p = Pedido.objects.get(pk=r.data['id'])
        self.assertEqual((p.cliente.telefono, p.recogida_contacto_telefono), ('0987654321', '022345678'))

    def test_despacho_filas_legado_duplicadas_reutiliza_la_de_menor_pk(self):
        Tarifa.objects.create(pk=1)
        primero = Usuario.objects.create_user('leg1', telefono='099 123 4567')
        Usuario.objects.create_user('leg2', telefono='+593991234567')
        desp = Usuario.objects.create_user('desp3', es_despachador=True)
        c = APIClient()
        c.force_authenticate(desp)
        r = c.post('/api/despacho/encargos/', self.encargo(cliente_telefono='0991234567'), format='json')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(Pedido.objects.get(pk=r.data['id']).cliente_id, primero.pk)

    def test_encargo_cliente_rechaza_telefono_de_contacto_invalido(self):
        c = APIClient()
        c.force_authenticate(Usuario.objects.create_user('cli2', first_name='Ana', telefono='0999999999'))
        base = {k: v for k, v in self.encargo().items() if k != 'cliente_nombre'}
        for campo in ('recogida_contacto_telefono', 'entrega_contacto_telefono'):
            r = c.post('/api/encargos/', {**base, campo: '12345'}, format='json')
            self.assertEqual(r.status_code, 400)
            self.assertEqual(r.data[campo][0], self.MSG)


class DespachoClienteNombreOpcionalTests(TestCase):
    """El despachador no siempre sabe el nombre de quien llama: solo el teléfono es obligatorio."""

    def setUp(self):
        Tarifa.objects.create(pk=1)
        self.c = APIClient()
        self.c.force_authenticate(Usuario.objects.create_user('desp4', es_despachador=True))

    def crear(self, **extra):
        base = TelefonoTests.encargo(None, cliente_telefono='0991112233')
        base.pop('cliente_nombre')
        return self.c.post('/api/despacho/encargos/', {**base, **extra}, format='json')

    def test_sin_nombre_crea_cliente_sin_nombre(self):
        r = self.crear()
        self.assertEqual(r.status_code, 201, r.data)
        cliente = Pedido.objects.get(pk=r.data['id']).cliente
        self.assertEqual((cliente.first_name, cliente.telefono), ('', '0991112233'))
        r = self.crear(cliente_nombre='', cliente_telefono='0991112244')
        self.assertEqual(r.status_code, 201, r.data)

    def test_con_nombre_lo_guarda_sin_espacios(self):
        r = self.crear(cliente_nombre='  Luis  ')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(Pedido.objects.get(pk=r.data['id']).cliente.first_name, 'Luis')

    def test_telefono_existente_no_pisa_el_nombre(self):
        existente = Usuario.objects.create_user('ana', first_name='Ana', telefono='0991112233')
        for nombre in ('Otro', ''):
            r = self.crear(cliente_nombre=nombre)
            self.assertEqual(r.status_code, 201, r.data)
            self.assertEqual(Pedido.objects.get(pk=r.data['id']).cliente_id, existente.pk)
        existente.refresh_from_db()
        self.assertEqual(existente.first_name, 'Ana')


class DespachoCostoEnvioTests(TestCase):
    """El despachador puede ajustar el envío sugerido; si no lo manda, el servidor lo calcula como siempre."""

    def setUp(self):
        Tarifa.objects.create(pk=1)
        self.c = APIClient()
        self.c.force_authenticate(Usuario.objects.create_user('desp5', es_despachador=True))

    def crear(self, cliente=None, **extra):
        c = self.c
        if cliente is not None:
            c = APIClient()
            c.force_authenticate(cliente)
        return c.post('/api/despacho/encargos/', {**TelefonoTests.encargo(None, cliente_telefono='0991112233'), **extra}, format='json')

    def test_sin_costo_envio_lo_calcula_el_servidor(self):
        from .tarifas import envio_entre
        r = self.crear()
        self.assertEqual(r.status_code, 201, r.data)
        p = Pedido.objects.get(pk=r.data['id'])
        self.assertEqual(p.costo_envio, Decimal(str(envio_entre(-0.25, -79.17, -0.26, -79.18)['costo_envio'])))

    def test_costo_envio_editado_se_guarda_y_conserva_distancia_y_comision(self):
        from .tarifas import envio_entre
        r = self.crear(costo_envio='4.75')
        self.assertEqual(r.status_code, 201, r.data)
        p = Pedido.objects.get(pk=r.data['id'])
        self.assertEqual(p.costo_envio, Decimal('4.75'))
        self.assertEqual(Decimal(str(p.distancia_km)), Decimal(str(envio_entre(-0.25, -79.17, -0.26, -79.18)['distancia_km'])))
        self.assertEqual(p.comision_porcentaje, Tarifa.actual().comision_porcentaje)
        self.assertEqual(self.crear(costo_envio='0').status_code, 201)
        self.assertEqual(self.crear(costo_envio='50.00').status_code, 201)

    def test_costo_envio_invalido_se_rechaza_en_espanol(self):
        for malo, msg in (('-1', 'El envío no puede ser negativo.'), ('50.01', 'El envío no puede pasar de $50.00.'),
                          ('2.345', 'El envío admite como máximo 2 decimales.'), ('abc', 'Ingresa un número válido.')):
            r = self.crear(costo_envio=malo)
            self.assertEqual(r.status_code, 400, malo)
            self.assertEqual(r.data['costo_envio'][0], msg, malo)

    def test_solo_el_despachador_usa_el_endpoint(self):
        cliente = Usuario.objects.create_user('cli5', first_name='Ana', telefono='0999999999')
        self.assertEqual(self.crear(cliente=cliente, costo_envio='1.00').status_code, 403)

    def test_encargo_del_cliente_ignora_costo_envio(self):
        from .tarifas import envio_entre
        c = APIClient()
        c.force_authenticate(Usuario.objects.create_user('cli6', first_name='Ana', telefono='0999999998'))
        base = {k: v for k, v in TelefonoTests.encargo(None).items() if k != 'cliente_nombre'}
        r = c.post('/api/encargos/', {**base, 'costo_envio': '0.01'}, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(Pedido.objects.get(pk=r.data['id']).costo_envio,
                         Decimal(str(envio_entre(-0.25, -79.17, -0.26, -79.18)['costo_envio'])))


class PushTests(TestCase):
    TOKEN = 'ExponentPushToken[abc123]'

    def setUp(self):
        self.cliente = Usuario.objects.create_user('cli_push')
        self.moto = Usuario.objects.create_user('moto_push', es_motorizado=True)
        self.api = APIClient()
        self.api.force_authenticate(self.moto)

    def crear_pedido(self, **extra):
        datos = dict(
            cliente=self.cliente, tipo=Pedido.Tipo.ENCARGO, descripcion='Algo',
            recogida_direccion='Farmacia Cruz Azul', recogida_lat=-2, recogida_lng=-79,
            destino_direccion='Casa', destino_lat=-2, destino_lng=-79,
        )
        return Pedido.objects.create(**{**datos, **extra})

    def test_guardar_y_borrar_token(self):
        self.assertEqual(self.api.put('/api/push-token/', {'token': self.TOKEN}, format='json').status_code, 204)
        self.moto.refresh_from_db()
        self.assertEqual(self.moto.push_token, self.TOKEN)
        self.assertEqual(self.api.delete('/api/push-token/').status_code, 204)
        self.moto.refresh_from_db()
        self.assertEqual(self.moto.push_token, '')

    def test_token_invalido_o_sin_ser_motorizado(self):
        self.assertEqual(self.api.put('/api/push-token/', {'token': 'hola'}, format='json').status_code, 400)
        otro = APIClient()
        otro.force_authenticate(self.cliente)
        self.assertEqual(otro.put('/api/push-token/', {'token': self.TOKEN}, format='json').status_code, 403)

    def test_el_token_pasa_al_ultimo_motorizado_que_lo_registra(self):
        otro = Usuario.objects.create_user('moto_push2', es_motorizado=True, push_token=self.TOKEN)
        self.api.put('/api/push-token/', {'token': self.TOKEN}, format='json')
        otro.refresh_from_db()
        self.assertEqual(otro.push_token, '')

    def test_avisa_al_asignar_y_no_al_cambiar_estado(self):
        Usuario.objects.filter(pk=self.moto.pk).update(push_token=self.TOKEN)
        pedido = self.crear_pedido()
        with mock.patch('pedidos.push.enviar_en_segundo_plano') as enviar:
            with self.captureOnCommitCallbacks(execute=True):
                pedido.motorizado = self.moto
                pedido.save()
            enviar.assert_called_once_with(
                self.moto.pk, self.TOKEN, 'Tienes un nuevo pedido',
                f'Farmacia Cruz Azul → Casa\nPedido #{pedido.pk}\nRecoge en: Farmacia Cruz Azul\nEntrega en: Casa',
                {'pedido_id': pedido.pk},
            )
            enviar.reset_mock()
            with self.captureOnCommitCallbacks(execute=True):
                pedido.estado = Pedido.Estado.RECOGIDO
                pedido.save()
            enviar.assert_not_called()

    def test_texto_con_carrera_pago_y_restaurante(self):
        encargo = self.crear_pedido(costo_envio=Decimal('2.5'), pagar_en_recogida=True, monto_estimado=Decimal('7'))
        self.assertEqual(push.texto_aviso(encargo), ('Tienes un nuevo pedido · $2.50', (
            f'Farmacia Cruz Azul → Casa\nPedido #{encargo.pk}\nRecoge en: Farmacia Cruz Azul\nEntrega en: Casa\n'
            'Pagas al recoger: aprox. $7.00'
        )))
        negocio = Negocio.objects.create(nombre='Don Pollo')
        sucursal = Sucursal.objects.create(negocio=negocio, nombre='Centro', direccion='Calle 1', lat=-2, lng=-79)
        comida = self.crear_pedido(destino_direccion='x' * 80)
        comida.tipo, comida.negocio, comida.sucursal = Pedido.Tipo.COMIDA, negocio, sucursal
        lineas = push.texto_aviso(comida)[1].split('\n')
        self.assertEqual(lineas[0], 'Don Pollo (Centro) → ' + 'x' * 29 + '…')
        self.assertEqual(lineas[2], 'Recoge en: Don Pollo (Centro)')
        self.assertEqual(lineas[3], 'Entrega en: ' + 'x' * 59 + '…')

    def test_sin_token_no_avisa(self):
        with mock.patch('pedidos.push.enviar_en_segundo_plano') as enviar:
            with self.captureOnCommitCallbacks(execute=True):
                self.crear_pedido(motorizado=self.moto)
            enviar.assert_not_called()

    def test_token_caducado_se_borra(self):
        Usuario.objects.filter(pk=self.moto.pk).update(push_token=self.TOKEN)
        respuesta = mock.MagicMock()
        respuesta.__enter__.return_value = io.BytesIO(
            b'{"data": {"status": "error", "details": {"error": "DeviceNotRegistered"}}}'
        )
        with mock.patch('pedidos.push.urllib.request.urlopen', return_value=respuesta), \
                mock.patch('pedidos.push.close_old_connections'):
            push._enviar(self.moto.pk, self.TOKEN, 't', 'c', {})
        self.moto.refresh_from_db()
        self.assertEqual(self.moto.push_token, '')
