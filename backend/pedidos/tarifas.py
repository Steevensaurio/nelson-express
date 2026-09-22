"""Cálculo del costo de envío.

Solo depende de la distancia. La medición está aislada en `distancia_por_calles`: para usar OSRM
o Google más adelante basta con cambiar esa función, el resto no se entera.
"""
import math
from decimal import Decimal, ROUND_CEILING
from types import SimpleNamespace

from .models import Tarifa

RADIO_TIERRA_KM = 6371.0088
PASO_REDONDEO = Decimal('0.05')  # el costo sube al siguiente múltiplo de $0.05 (evita precios como $2.83)
CENTAVOS = Decimal('0.01')


def distancia_recta_km(lat1, lng1, lat2, lng2):
    """Distancia en línea recta entre dos coordenadas (fórmula de haversine)."""
    lat1, lng1, lat2, lng2 = (math.radians(float(v)) for v in (lat1, lng1, lat2, lng2))
    a = (
        math.sin((lat2 - lat1) / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin((lng2 - lng1) / 2) ** 2
    )
    return 2 * RADIO_TIERRA_KM * math.asin(math.sqrt(a))


def distancia_por_calles(origen, destino, tarifa):
    """Aproxima la distancia por calles: línea recta × factor. Devuelve Decimal en km."""
    recta = distancia_recta_km(origen[0], origen[1], destino[0], destino[1])
    return (Decimal(str(recta)) * tarifa.factor_calles).quantize(CENTAVOS)


def calcular_envio(sucursal, destino_lat, destino_lng, tarifa=None):
    """Devuelve {'distancia_km', 'costo_envio'} para llevar un pedido desde la sucursal al destino."""
    tarifa = tarifa or Tarifa.actual()
    km = distancia_por_calles((sucursal.lat, sucursal.lng), (destino_lat, destino_lng), tarifa)

    extra = max(km - tarifa.km_incluidos, Decimal(0)) * tarifa.precio_km_extra
    costo = tarifa.minima + extra
    costo = (costo / PASO_REDONDEO).to_integral_value(rounding=ROUND_CEILING) * PASO_REDONDEO
    return {'distancia_km': km, 'costo_envio': costo.quantize(CENTAVOS)}


def opciones_de_envio(negocio, destino_lat, destino_lng):
    """Sucursales abiertas del negocio con su envío, la más cercana al destino primero.

    La más cercana es también la más barata (el costo solo depende de la distancia), así que
    `opciones[0]` es la sucursal que se asigna por defecto. Vacío si no hay ninguna abierta.
    """
    tarifa = Tarifa.actual()
    opciones = [
        {'sucursal': s, **calcular_envio(s, destino_lat, destino_lng, tarifa)}
        for s in negocio.sucursales.filter(abierta=True)
    ]
    return sorted(opciones, key=lambda o: (o['distancia_km'], o['sucursal'].id))


def envio_entre(origen_lat, origen_lng, destino_lat, destino_lng):
    """Envío entre dos puntos cualesquiera (encargos: no hay sucursal, la recogida la indica el cliente)."""
    return calcular_envio(SimpleNamespace(lat=origen_lat, lng=origen_lng), destino_lat, destino_lng)
