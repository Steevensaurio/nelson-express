from django.contrib.auth.models import AbstractUser
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone


class Usuario(AbstractUser):
    class Rol(models.TextChoices):
        CLIENTE = 'CLIENTE', 'Cliente'
        MOTORIZADO = 'MOTORIZADO', 'Motorizado'
        ADMIN = 'ADMIN', 'Administrador'

    # Ya no decide accesos (ver abajo): es solo un dato informativo de cómo se creó la cuenta.
    rol = models.CharField(max_length=20, choices=Rol.choices, default=Rol.CLIENTE)
    telefono = models.CharField(max_length=20, blank=True)

    # Estas dos banderas, independientes entre sí, son las que deciden a qué apps puede entrar la
    # cuenta y se pueden combinar (ej. un cliente al que se activa como motorizado sin crear otra
    # cuenta). "Cliente" no necesita bandera: cualquier cuenta puede usar esa app.
    es_motorizado = models.BooleanField(default=False, help_text='Puede entrar a la app de motorizados.')
    es_despachador = models.BooleanField(default=False, help_text='Puede entrar al panel de despacho.')

    def __str__(self):
        return f'{self.username} ({self.rol})'


class PerfilMotorizado(models.Model):
    usuario = models.OneToOneField(
        Usuario, on_delete=models.CASCADE, related_name='perfil_motorizado'
    )
    vehiculo_placa = models.CharField(max_length=20, blank=True)
    vehiculo_modelo = models.CharField(max_length=60, blank=True)
    vehiculo_color = models.CharField(max_length=30, blank=True)
    disponible = models.BooleanField(default=False)
    ubicacion_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    ubicacion_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    ubicacion_actualizada = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f'Motorizado: {self.usuario.username}'




class Negocio(models.Model):
    """Marca/restaurante. Sus locales físicos son las `sucursales`."""

    nombre = models.CharField(max_length=100)
    # Desactivar oculta el negocio a los clientes sin borrar sus pedidos (borrarlo los borra en cascada).
    activo = models.BooleanField(default=True)
    # No es un campo de subida: el archivo se sube al repo a mano (backend/pedidos/static/negocios/)
    # y aquí solo se escribe su nombre. Así la foto sobrevive a un redeploy en Render sin depender de
    # almacenamiento externo (el disco de Render es efímero; lo que se sube por el admin se perdería).
    imagen = models.CharField(
        max_length=100, blank=True,
        help_text='Nombre del archivo en pedidos/static/negocios/ (ej. don-pollo.png). Se sube al repo, no aquí.',
    )

    def __str__(self):
        return self.nombre


class Sucursal(models.Model):
    """Local físico de un negocio (marca). El menú es del negocio; el punto de recogida, de la sucursal."""
    negocio = models.ForeignKey(Negocio, on_delete=models.CASCADE, related_name='sucursales')
    nombre = models.CharField(max_length=100, default='Principal', help_text='Ej. Centro, Norte, Mall del Sol.')
    direccion = models.CharField(max_length=255)
    lat = models.DecimalField(max_digits=9, decimal_places=6)
    lng = models.DecimalField(max_digits=9, decimal_places=6)
    abierta = models.BooleanField(default=True, help_text='Si está cerrada no recibe pedidos.')

    class Meta:
        verbose_name_plural = 'sucursales'
        ordering = ['negocio', 'id']

    def __str__(self):
        return f'{self.negocio.nombre} - {self.nombre}'


class Producto(models.Model):
    negocio = models.ForeignKey(Negocio, on_delete=models.CASCADE, related_name='productos')
    nombre = models.CharField(max_length=100)
    precio = models.DecimalField(max_digits=8, decimal_places=2)
    disponible = models.BooleanField(default=True)
    descripcion = models.CharField(max_length=255, blank=True)
    imagen = models.ImageField(upload_to='productos/', blank=True)

    def __str__(self):
        return f'{self.nombre} ({self.negocio.nombre})'
    
class Tarifa(models.Model):
    """Tarifa de envío. Hay una sola fila; se edita desde el admin de Django."""
    minima = models.DecimalField(
        max_digits=6, decimal_places=2, default=2, validators=[MinValueValidator(0)],
        help_text='Costo mínimo de la carrera (incluye los primeros km).',
    )
    km_incluidos = models.DecimalField(
        max_digits=5, decimal_places=2, default=2, validators=[MinValueValidator(0)],
        help_text='Kilómetros que cubre la tarifa mínima.',
    )
    precio_km_extra = models.DecimalField(
        max_digits=5, decimal_places=2, default='0.50', validators=[MinValueValidator(0)],
        help_text='Costo de cada kilómetro por encima de los incluidos.',
    )
    factor_calles = models.DecimalField(
        max_digits=4, decimal_places=2, default='1.30', validators=[MinValueValidator(1)],
        help_text='Multiplica la distancia en línea recta para aproximar la distancia por calles.',
    )
    comision_porcentaje = models.DecimalField(
        max_digits=5, decimal_places=2, default=25,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text='Porcentaje de cada carrera que el motorizado entrega a la empresa.',
    )

    class Meta:
        verbose_name = 'tarifa'
        verbose_name_plural = 'tarifa'

    def __str__(self):
        return f'Mínima ${self.minima} ({self.km_incluidos} km) + ${self.precio_km_extra}/km extra'

    @classmethod
    def actual(cls):
        return cls.objects.get_or_create(pk=1)[0]


class Pedido(models.Model):
    class Estado(models.TextChoices):
        PENDIENTE = 'PENDIENTE', 'Pendiente'
        ACEPTADO = 'ACEPTADO', 'Aceptado'
        RECOGIDO = 'RECOGIDO', 'Recogido'
        EN_CAMINO = 'EN_CAMINO', 'En camino'
        ENTREGADO = 'ENTREGADO', 'Entregado'
        CANCELADO = 'CANCELADO', 'Cancelado'

    cliente = models.ForeignKey(
        Usuario, on_delete=models.CASCADE, related_name='pedidos_como_cliente'
    )
    motorizado = models.ForeignKey(
        Usuario, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='pedidos_como_motorizado',
    )
    class Tipo(models.TextChoices):
        COMIDA = 'COMIDA', 'Comida'
        ENCARGO = 'ENCARGO', 'Encargo'

    tipo = models.CharField(max_length=10, choices=Tipo.choices, default=Tipo.COMIDA)
    # Solo en pedidos de comida (los encargos no tienen restaurante).
    negocio = models.ForeignKey(
        Negocio, on_delete=models.CASCADE, related_name='pedidos', null=True, blank=True
    )
    sucursal = models.ForeignKey(
        Sucursal, on_delete=models.PROTECT, related_name='pedidos', null=True, blank=True,
    )

    # Dónde se recoge. En comida se copia de la sucursal al crear el pedido; en un encargo lo indica el cliente.
    # De aquí salen la distancia y el envío, y es lo que ve el motorizado.
    recogida_direccion = models.CharField(max_length=255)
    recogida_lat = models.DecimalField(max_digits=9, decimal_places=6)
    recogida_lng = models.DecimalField(max_digits=9, decimal_places=6)
    recogida_referencia = models.CharField(max_length=255, blank=True)
    # Encargo: quién entrega el paquete en la recogida y quién lo recibe en la entrega. No siempre son
    # la misma persona, y ninguna de las dos tiene por qué ser el cliente que pide el encargo (puede
    # mandar a buscar algo a nombre de otra persona, o pedir que se lo entreguen a otra persona). Vacío
    # significa "el propio cliente" (se completa con sus datos al mostrarlo; ver RecogidaMixin).
    recogida_contacto_nombre = models.CharField(max_length=100, blank=True)
    recogida_contacto_telefono = models.CharField(max_length=20, blank=True)
    entrega_contacto_nombre = models.CharField(max_length=100, blank=True)
    entrega_contacto_telefono = models.CharField(max_length=20, blank=True)
    # Encargo: el motorizado debe pagar algo al recoger (monto aproximado; se le reembolsa al entregar).
    pagar_en_recogida = models.BooleanField(default=False)
    monto_estimado = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)

    destino_direccion = models.CharField(max_length=255)
    destino_lat = models.DecimalField(max_digits=9, decimal_places=6)
    destino_lng = models.DecimalField(max_digits=9, decimal_places=6)
    destino_referencia = models.CharField(max_length=255, blank=True)

    descripcion = models.CharField(max_length=255, blank=True)
    estado = models.CharField(max_length=20, choices=Estado.choices, default=Estado.PENDIENTE)
    precio = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    # Se calculan y congelan al crear el pedido: si la tarifa cambia después, no se recalculan.
    distancia_km = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    costo_envio = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    # % de la carrera que el motorizado entrega a la empresa; también queda congelado en el pedido.
    comision_porcentaje = models.DecimalField(max_digits=5, decimal_places=2, default=25)
    motivo_cancelacion = models.CharField(max_length=255, blank=True)

    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)
    # Cuándo se entregó: de aquí sale el "día" de la carrera para las ganancias.
    entregado_en = models.DateTimeField(null=True, blank=True)

    def save(self, *args, **kwargs):
        if self.estado == self.Estado.ENTREGADO and self.entregado_en is None:
            self.entregado_en = timezone.now()
        super().save(*args, **kwargs)

    @property
    def nombre_recogida(self):
        if self.sucursal_id:
            return f'{self.negocio.nombre} ({self.sucursal.nombre})'
        return 'Encargo'

    def __str__(self):
        return f'Pedido #{self.pk} - {self.estado}'


ESTADOS_FINALES = [Pedido.Estado.ENTREGADO, Pedido.Estado.CANCELADO]
ESTADOS_ACTIVOS = [e for e in Pedido.Estado if e not in ESTADOS_FINALES]

# Único paso que puede dar el motorizado desde cada estado (espejo de motorizado-app/constants/estados.js).
SIGUIENTE_ESTADO = {
    Pedido.Estado.PENDIENTE: Pedido.Estado.RECOGIDO,
    Pedido.Estado.ACEPTADO: Pedido.Estado.RECOGIDO,
    Pedido.Estado.RECOGIDO: Pedido.Estado.EN_CAMINO,
    Pedido.Estado.EN_CAMINO: Pedido.Estado.ENTREGADO,
}

# Solo se puede cancelar mientras el motorizado aún no tiene la comida en la mano.
ESTADOS_CANCELABLES = [Pedido.Estado.PENDIENTE, Pedido.Estado.ACEPTADO]

class DetallePedido(models.Model):
    pedido = models.ForeignKey(Pedido, on_delete=models.CASCADE, related_name='detalles')
    producto = models.ForeignKey(Producto, on_delete=models.PROTECT, related_name='detalles')
    cantidad = models.PositiveIntegerField(default=1)
    precio_unitario = models.DecimalField(max_digits=8, decimal_places=2)


class Direccion(models.Model):
    cliente = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='direcciones')
    etiqueta = models.CharField(max_length=50)
    direccion = models.CharField(max_length=255)
    referencia = models.CharField(max_length=255, blank=True)
    lat = models.DecimalField(max_digits=9, decimal_places=6)
    lng = models.DecimalField(max_digits=9, decimal_places=6)

    def __str__(self):
        return f'{self.etiqueta} ({self.cliente.username})'
