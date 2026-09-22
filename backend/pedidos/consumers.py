"""Canal de tiempo real: ws://<host>/ws/pedidos/

Protocolo (JSON):
  cliente -> servidor   {"type": "auth", "token": "<JWT de acceso>"}   (primer mensaje, obligatorio)
  servidor -> cliente   {"type": "auth_ok"}  |  {"type": "auth_error"} y cierre con código 4401
  cliente -> servidor   {"type": "ping"}      servidor -> cliente   {"type": "pong"}
  servidor -> cliente   {"type": "pedido_cambio", "pedido_id": 123}

El token viaja en el primer mensaje y no en la URL para que no quede en logs ni en historiales.
Como sin token válido no se recibe nada, no hace falta validar el origen de la conexión.
"""
import asyncio

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

from .models import Usuario
from .realtime import GRUPO_DESPACHO, grupo_usuario

SEGUNDOS_PARA_AUTENTICAR = 5
CODIGO_NO_AUTORIZADO = 4401


@database_sync_to_async
def usuario_desde_token(token):
    if not isinstance(token, str) or not token:
        return None
    try:
        usuario_id = AccessToken(token)['user_id']
        return Usuario.objects.get(pk=usuario_id, is_active=True)
    except (TokenError, KeyError, ValueError, Usuario.DoesNotExist):
        return None


class PedidosConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.grupos = []
        self.autenticado = False
        await self.accept()
        self.vigilante = asyncio.create_task(self._cerrar_si_no_se_autentica())

    async def _cerrar_si_no_se_autentica(self):
        await asyncio.sleep(SEGUNDOS_PARA_AUTENTICAR)
        if not self.autenticado:
            await self.close(code=CODIGO_NO_AUTORIZADO)

    async def disconnect(self, code):
        self.vigilante.cancel()
        for grupo in self.grupos:
            await self.channel_layer.group_discard(grupo, self.channel_name)

    async def receive_json(self, contenido, **kwargs):
        if not isinstance(contenido, dict):
            return
        tipo = contenido.get('type')
        if tipo == 'auth' and not self.autenticado:
            await self._autenticar(contenido.get('token'))
        elif tipo == 'ping' and self.autenticado:
            await self.send_json({'type': 'pong'})

    async def _autenticar(self, token):
        usuario = await usuario_desde_token(token)
        if usuario is None:
            await self.send_json({'type': 'auth_error'})
            await self.close(code=CODIGO_NO_AUTORIZADO)
            return

        self.autenticado = True
        self.vigilante.cancel()
        self.grupos = [grupo_usuario(usuario.pk)]
        if usuario.es_despachador:
            self.grupos.append(GRUPO_DESPACHO)
        for grupo in self.grupos:
            await self.channel_layer.group_add(grupo, self.channel_name)
        await self.send_json({'type': 'auth_ok'})

    async def pedido_cambio(self, evento):
        await self.send_json({'type': 'pedido_cambio', 'pedido_id': evento['pedido_id']})
