from decimal import Decimal

from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient

from .models import DetallePedido, Negocio, Pedido, Producto, Sucursal, Usuario


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
