# Los contactos viejos (contacto_nombre/contacto_telefono) eran "quien entrega en la recogida",
# así que pasan a recogida_contacto_*. entrega_contacto_* es un campo nuevo, no un renombre.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('pedidos', '0014_capacidades'),
    ]

    operations = [
        migrations.RenameField(
            model_name='pedido',
            old_name='contacto_nombre',
            new_name='recogida_contacto_nombre',
        ),
        migrations.RenameField(
            model_name='pedido',
            old_name='contacto_telefono',
            new_name='recogida_contacto_telefono',
        ),
        migrations.AddField(
            model_name='pedido',
            name='entrega_contacto_nombre',
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name='pedido',
            name='entrega_contacto_telefono',
            field=models.CharField(blank=True, max_length=20),
        ),
    ]
