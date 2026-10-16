import json
import logging
import threading
import urllib.request

from django.db import close_old_connections

from .models import Pedido, Usuario

logger = logging.getLogger(__name__)

URL_EXPO = 'https://exp.host/--/api/v2/push/send'
CANAL_ANDROID = 'pedidos'  # el mismo que crea la app de motorizados (services/notificaciones.js)


def es_token_expo(token):
    return token.startswith(('ExponentPushToken[', 'ExpoPushToken[')) and token.endswith(']')


def _enviar(usuario_id, token, titulo, cuerpo, datos):
    """Manda un aviso por el servicio de push de Expo (que lo entrega por Firebase en Android)."""
    mensaje = {
        'to': token, 'title': titulo, 'body': cuerpo, 'data': datos,
        'sound': 'default', 'priority': 'high', 'channelId': CANAL_ANDROID,
    }
    peticion = urllib.request.Request(
        URL_EXPO, data=json.dumps(mensaje).encode(),
        headers={'Content-Type': 'application/json', 'Accept': 'application/json'},
    )
    try:
        with urllib.request.urlopen(peticion, timeout=10) as respuesta:
            ticket = json.load(respuesta).get('data') or {}
        # La app se desinstaló o el token caducó: se borra para no seguir mandándole avisos.
        if ticket.get('status') == 'error' and (ticket.get('details') or {}).get('error') == 'DeviceNotRegistered':
            Usuario.objects.filter(pk=usuario_id, push_token=token).update(push_token='')
    except Exception:
        # Un aviso push que no sale nunca debe romper nada: el motorizado igual ve el pedido en su lista.
        logger.exception('No se pudo enviar el aviso push al usuario %s', usuario_id)
    finally:
        close_old_connections()  # este hilo abrió su propia conexión a la base


def enviar_en_segundo_plano(*args):
    # Hilo aparte: la respuesta al despachador no espera a Expo.
    # ponytail: un hilo por aviso; si llegan a ser cientos por minuto, pasar a una cola (Celery/RQ).
    threading.Thread(target=_enviar, args=args, daemon=True).start()


def avisar_pedido_asignado(pedido_id):
    pedido = Pedido.objects.select_related('motorizado', 'negocio').filter(pk=pedido_id).first()
    if not pedido or not pedido.motorizado or not pedido.motorizado.push_token:
        return
    recogida = pedido.negocio.nombre if pedido.negocio else pedido.recogida_direccion
    enviar_en_segundo_plano(
        pedido.motorizado_id, pedido.motorizado.push_token,
        f'Nuevo pedido #{pedido.pk}', f'Recoger en {recogida}', {'pedido_id': pedido.pk},
    )
