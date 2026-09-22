from django.db import migrations


def negocios_a_sucursales(apps, schema_editor):
    """Cada negocio existente pasa a tener una sucursal 'Principal' con su dirección actual,
    y sus pedidos apuntan a ella (así conservan el punto de recogida con el que se hicieron)."""
    Negocio = apps.get_model('pedidos', 'Negocio')
    Sucursal = apps.get_model('pedidos', 'Sucursal')
    Pedido = apps.get_model('pedidos', 'Pedido')
    for negocio in Negocio.objects.all():
        sucursal = Sucursal.objects.create(
            negocio=negocio, nombre='Principal', direccion=negocio.direccion,
            lat=negocio.lat, lng=negocio.lng,
        )
        Pedido.objects.filter(negocio=negocio).update(sucursal=sucursal)


def sucursales_a_negocios(apps, schema_editor):
    Sucursal = apps.get_model('pedidos', 'Sucursal')
    Negocio = apps.get_model('pedidos', 'Negocio')
    for negocio in Negocio.objects.all():
        primera = Sucursal.objects.filter(negocio=negocio).order_by('id').first()
        if primera:
            negocio.direccion, negocio.lat, negocio.lng = primera.direccion, primera.lat, primera.lng
            negocio.save()


class Migration(migrations.Migration):

    dependencies = [('pedidos', '0007_sucursal')]

    operations = [migrations.RunPython(negocios_a_sucursales, sucursales_a_negocios)]
