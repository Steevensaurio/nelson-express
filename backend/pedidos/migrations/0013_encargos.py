from decimal import Decimal

import django.db.models.deletion
from django.db import migrations, models


def copiar_recogida(apps, schema_editor):
    """Los pedidos de comida ya existentes guardan como recogida la ubicación de su sucursal."""
    Pedido = apps.get_model('pedidos', 'Pedido')
    for pedido in Pedido.objects.select_related('sucursal'):
        Pedido.objects.filter(pk=pedido.pk).update(
            recogida_direccion=pedido.sucursal.direccion,
            recogida_lat=pedido.sucursal.lat,
            recogida_lng=pedido.sucursal.lng,
        )


class Migration(migrations.Migration):

    dependencies = [('pedidos', '0012_negocio_activo')]

    operations = [
        migrations.AddField(
            model_name='pedido', name='tipo',
            field=models.CharField(choices=[('COMIDA', 'Comida'), ('ENCARGO', 'Encargo')], default='COMIDA', max_length=10),
        ),
        migrations.AlterField(
            model_name='pedido', name='negocio',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE,
                                    related_name='pedidos', to='pedidos.negocio'),
        ),
        migrations.AlterField(
            model_name='pedido', name='sucursal',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT,
                                    related_name='pedidos', to='pedidos.sucursal'),
        ),
        migrations.AddField(
            model_name='pedido', name='recogida_direccion',
            field=models.CharField(default='', max_length=255), preserve_default=False,
        ),
        migrations.AddField(
            model_name='pedido', name='recogida_lat',
            field=models.DecimalField(decimal_places=6, default=Decimal('0'), max_digits=9), preserve_default=False,
        ),
        migrations.AddField(
            model_name='pedido', name='recogida_lng',
            field=models.DecimalField(decimal_places=6, default=Decimal('0'), max_digits=9), preserve_default=False,
        ),
        migrations.AddField(
            model_name='pedido', name='recogida_referencia',
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name='pedido', name='contacto_nombre',
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name='pedido', name='contacto_telefono',
            field=models.CharField(blank=True, max_length=20),
        ),
        migrations.AddField(
            model_name='pedido', name='pagar_en_recogida',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='pedido', name='monto_estimado',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=8, null=True),
        ),
        migrations.RunPython(copiar_recogida, migrations.RunPython.noop),
    ]
