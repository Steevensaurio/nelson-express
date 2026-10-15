from decimal import Decimal

from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient

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
