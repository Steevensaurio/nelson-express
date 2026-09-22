from django.db import transaction
from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

from .models import Pedido
from .realtime import notificar_pedido


@receiver(pre_save, sender=Pedido)
def recordar_motorizado_anterior(sender, instance, **kwargs):
    # Si el pedido cambia de motorizado, el anterior también debe enterarse de que ya no es suyo.
    instance._motorizado_anterior_id = None
    if instance.pk:
        instance._motorizado_anterior_id = (
            Pedido.objects.filter(pk=instance.pk).values_list('motorizado_id', flat=True).first()
        )


def _usuarios_involucrados(pedido):
    return [pedido.cliente_id, pedido.motorizado_id, getattr(pedido, '_motorizado_anterior_id', None)]


@receiver(post_save, sender=Pedido)
def avisar_cambio_de_pedido(sender, instance, **kwargs):
    usuarios = _usuarios_involucrados(instance)
    # on_commit: el aviso sale recién cuando la transacción terminó, para que quien lo reciba
    # y vuelva a consultar ya encuentre el pedido completo (con sus detalles).
    transaction.on_commit(lambda: notificar_pedido(instance.pk, usuarios))


@receiver(post_delete, sender=Pedido)
def avisar_pedido_eliminado(sender, instance, **kwargs):
    usuarios = _usuarios_involucrados(instance)
    pedido_id = instance.pk
    transaction.on_commit(lambda: notificar_pedido(pedido_id, usuarios))
