import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [('pedidos', '0008_datos_sucursales')]

    operations = [
        migrations.AlterField(
            model_name='pedido',
            name='sucursal',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name='pedidos', to='pedidos.sucursal',
            ),
        ),
        migrations.RemoveField(model_name='negocio', name='direccion'),
        migrations.RemoveField(model_name='negocio', name='lat'),
        migrations.RemoveField(model_name='negocio', name='lng'),
    ]
