import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

logger = logging.getLogger(__name__)

GRUPO_DESPACHO = 'despacho'


def grupo_usuario(usuario_id):
    return f'usuario_{usuario_id}'


def notificar_pedido(pedido_id, usuarios_ids):
    """Avisa que un pedido cambió: al despacho y a cada usuario involucrado.

    El aviso solo lleva el id: quien lo recibe vuelve a pedir los datos por la API REST,
    que sigue siendo la fuente de verdad (y ya aplica sus propios permisos).
    """
    capa = get_channel_layer()
    if capa is None:
        return
    grupos = {GRUPO_DESPACHO, *(grupo_usuario(u) for u in usuarios_ids if u)}
    try:
        for grupo in grupos:
            async_to_sync(capa.group_send)(grupo, {'type': 'pedido.cambio', 'pedido_id': pedido_id})
    except Exception:
        # Si la capa de tiempo real falla (p. ej. Redis caído), la petición HTTP que guardó
        # el pedido no debe fallar: las apps siguen enterándose por sondeo.
        logger.exception('No se pudo enviar el aviso de tiempo real del pedido %s', pedido_id)
