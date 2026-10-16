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


def _corto(texto, largo=60):
    texto = ' '.join(texto.split())
    return texto if len(texto) <= largo else texto[:largo - 1].rstrip() + '…'


def texto_aviso(pedido):
    """Título y cuerpo del aviso "pedido asignado".

    El título dice qué pasó; el cuerpo va de lo más a lo menos importante, una idea por línea, porque
    Android plegado solo muestra la primera: dónde recoger, a dónde llevar, cuánto gana y si debe pagar algo.
    """
    encargo = pedido.tipo == Pedido.Tipo.ENCARGO
    titulo = f'Se te asignó un nuevo {"encargo" if encargo else "pedido"} · #{pedido.pk}'
    if pedido.negocio:
        origen = pedido.negocio.nombre + (f' ({pedido.sucursal.nombre})' if pedido.sucursal else '')
    else:
        origen = pedido.recogida_direccion
    lineas = [f'Recoge en: {_corto(origen)}', f'Entrega en: {_corto(pedido.destino_direccion)}']
    if pedido.costo_envio is not None:
        lineas.append(f'Tu carrera: ${pedido.costo_envio:.2f}')
    if encargo and pedido.pagar_en_recogida and pedido.monto_estimado:
        lineas.append(f'Pagas al recoger: aprox. ${pedido.monto_estimado:.2f}')
    return titulo, '\n'.join(lineas)


def avisar_pedido_asignado(pedido_id):
    pedido = Pedido.objects.select_related('motorizado', 'negocio', 'sucursal').filter(pk=pedido_id).first()
    if not pedido or not pedido.motorizado or not pedido.motorizado.push_token:
        return
    titulo, cuerpo = texto_aviso(pedido)
    enviar_en_segundo_plano(pedido.motorizado_id, pedido.motorizado.push_token, titulo, cuerpo, {'pedido_id': pedido.pk})
