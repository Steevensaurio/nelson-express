import { useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';

// El empaquetador no resuelve solo los íconos por defecto de Leaflet; hay que indicarlos a mano.
// Sin borrar este método, Leaflet sigue calculando su propia ruta y la pega delante de la nuestra
// (queda algo como ".../images//node_modules/.../marker-icon.png"), rompiendo la imagen.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

// Centro inicial del mapa: Santo Domingo, donde están los negocios.
const CENTRO_SANTO_DOMINGO = { lat: -0.253, lng: -79.173 };

// Dirección aproximada a partir de coordenadas, con Nominatim (OpenStreetMap): gratis, sin clave.
// Uso liviano y ocasional (un clic humano a la vez); para más volumen habría que alojar un servidor propio.
async function direccionDesdeCoordenadas(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=0`;
  const respuesta = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!respuesta.ok) throw new Error('reverse geocode failed');
  const datos = await respuesta.json();
  return datos.display_name ?? '';
}

function Clics({ onElegir }) {
  useMapEvents({ click: (e) => onElegir(e.latlng.lat, e.latlng.lng) });
  return null;
}

// Mapa para elegir un punto: un clic coloca el marcador (se puede arrastrar después) y autocompleta
// la dirección. onChange recibe {lat, lng, direccion}; direccion llega null si falla la búsqueda,
// para no borrar lo que el despachador ya haya escrito a mano.
export default function SelectorMapa({ value, onChange }) {
  const [buscando, setBuscando] = useState(false);

  const elegir = async (lat, lng) => {
    onChange({ lat, lng, direccion: null });
    setBuscando(true);
    try {
      onChange({ lat, lng, direccion: await direccionDesdeCoordenadas(lat, lng) });
    } catch {
      // sin conexión con Nominatim: el punto queda puesto, la dirección se escribe a mano
    } finally {
      setBuscando(false);
    }
  };

  return (
    <div className="selector-mapa campo-ancho">
      <MapContainer
        center={value ?? CENTRO_SANTO_DOMINGO}
        zoom={value ? 16 : 13}
        style={{ height: 220, width: '100%', borderRadius: 10 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Clics onElegir={elegir} />
        {value ? (
          <Marker
            position={value}
            draggable
            eventHandlers={{ dragend: (e) => { const p = e.target.getLatLng(); elegir(p.lat, p.lng); } }}
          />
        ) : null}
      </MapContainer>
      <p className="selector-mapa-ayuda">
        {value
          ? buscando
            ? 'Buscando la dirección…'
            : `Ubicación marcada: ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)} (arrástrala para ajustar)`
          : 'Toca el mapa para marcar el punto.'}
      </p>
    </div>
  );
}
