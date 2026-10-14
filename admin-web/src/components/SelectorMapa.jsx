import { useState } from 'react';
import { useMedia } from '../useMedia.js';
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

// Acepta "-0.2530, -79.1730" (con coma, punto y coma o espacio) y valida los rangos reales.
function leerCoordenadas(texto) {
  const m = texto.trim().match(/^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

function Clics({ onElegir }) {
  useMapEvents({ click: (e) => onElegir(e.latlng.lat, e.latlng.lng) });
  return null;
}

// Mapa para elegir un punto: un clic coloca el marcador (se puede arrastrar después) y autocompleta
// la dirección. También se puede escribir "lat, lng", para quien no use el puntero. onChange recibe
// {lat, lng, direccion}; direccion llega null si falla la búsqueda, para no borrar lo que el
// despachador ya haya escrito a mano.
export default function SelectorMapa({ value, onChange, etiqueta = 'Mapa' }) {
  const [buscando, setBuscando] = useState(false);
  const [texto, setTexto] = useState('');
  const [errorTexto, setErrorTexto] = useState('');
  const idError = `error-coordenadas-${etiqueta.replace(/\s+/g, '-').toLowerCase()}`;
  // En pantallas táctiles un dedo desplaza la página y dos dedos mueven/acercan el mapa (TouchZoom de Leaflet
  // también desplaza); así el mapa no atrapa el scroll. La rueda del ratón tampoco hace zoom: desplaza la página.
  const tactil = useMedia('(pointer: coarse)');

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

  const aplicarTexto = () => {
    if (!texto.trim()) return;
    const punto = leerCoordenadas(texto);
    if (!punto) {
      setErrorTexto('Escribe latitud y longitud separadas por coma, por ejemplo -0.2530, -79.1730.');
      return;
    }
    setErrorTexto('');
    setTexto('');
    elegir(punto.lat, punto.lng);
  };

  return (
    <div className="selector-mapa campo-ancho" role="group" aria-label={etiqueta}>
      <MapContainer
        center={value ?? CENTRO_SANTO_DOMINGO}
        zoom={value ? 16 : 13}
        className="selector-mapa-lienzo"
        dragging={!tactil}
        scrollWheelZoom={false}
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

      <label className="selector-mapa-coordenadas">
        O escribe las coordenadas (latitud, longitud)
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={aplicarTexto}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              aplicarTexto();
            }
          }}
          placeholder="-0.2530, -79.1730"
          inputMode="decimal"
          aria-invalid={errorTexto ? 'true' : undefined}
          aria-describedby={errorTexto ? idError : undefined}
        />
      </label>
      {errorTexto ? <p className="error" id={idError} role="alert">{errorTexto}</p> : null}

      <p className="selector-mapa-ayuda" role="status">
        {value
          ? buscando
            ? 'Buscando la dirección…'
            : `Ubicación marcada: ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)} (arrástrala para ajustar)`
          : `Toca el mapa para marcar el punto.${tactil ? ' Usa dos dedos para mover el mapa.' : ''}`}
      </p>
    </div>
  );
}
