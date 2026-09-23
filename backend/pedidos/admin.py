from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Pedido, Tarifa, PerfilMotorizado, Usuario, DetallePedido, Negocio, Sucursal, Producto, Direccion


@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ('Datos Nelson Express', {'fields': ('rol', 'telefono')}),
        # Deciden a qué apps puede entrar la cuenta; se pueden marcar las dos a la vez.
        ('Capacidades', {'fields': ('es_motorizado', 'es_despachador')}),
    )
    list_display = ('username', 'email', 'rol', 'es_motorizado', 'es_despachador', 'is_staff')
    list_filter = UserAdmin.list_filter + ('es_motorizado', 'es_despachador')


@admin.register(PerfilMotorizado)
class PerfilMotorizadoAdmin(admin.ModelAdmin):
    list_display = ('usuario', 'disponible', 'vehiculo_placa', 'vehiculo_modelo', 'ubicacion_actualizada')


@admin.register(Tarifa)
class TarifaAdmin(admin.ModelAdmin):
    list_display = ('__str__', 'factor_calles')

    def has_add_permission(self, request):
        return not Tarifa.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


class SucursalInline(admin.TabularInline):
    model = Sucursal
    extra = 1


@admin.register(Negocio)
class NegocioAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'activo', 'imagen', 'cantidad_sucursales')
    list_filter = ('activo',)
    inlines = [SucursalInline]

    @admin.display(description='Sucursales')
    def cantidad_sucursales(self, negocio):
        return negocio.sucursales.count()


@admin.register(Sucursal)
class SucursalAdmin(admin.ModelAdmin):
    list_display = ('__str__', 'direccion', 'abierta')
    list_filter = ('negocio', 'abierta')


@admin.register(Producto)
class ProductoAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'negocio', 'precio', 'disponible', 'imagen')
    list_filter = ('negocio', 'disponible')

@admin.register(Direccion)
class DireccionAdmin(admin.ModelAdmin):
    list_display = ('etiqueta', 'cliente', 'direccion')


class DetallePedidoInline(admin.TabularInline):
    model = DetallePedido
    extra = 1 

@admin.register(Pedido)
class PedidoAdmin(admin.ModelAdmin):
    list_display = ('id', 'tipo', 'cliente', 'motorizado', 'negocio', 'sucursal', 'estado', 'precio', 'creado_en')
    list_filter = ('tipo', 'estado')
    inlines = [DetallePedidoInline]
