# Rediseño "amable" de las tres apps — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el lenguaje visual condensado/pesado por uno amable (Nunito, tickets cupón, estados sólidos con ícono, filas del mismo alto) en cliente-app, motorizado-app y admin-web.

**Architecture:** Cada app móvil tiene su copia de `components/ui.js` y `constants/tema.js` (idénticas salvo `Boton.colorFondo` en motorizado). Se cambia primero la base (fuente, tokens, componentes) en cliente, se copia a motorizado, y después se migran las pantallas. El panel web cambia `styles.css` + pequeños ajustes de JSX.

**Tech Stack:** Expo SDK 57 / React Native 0.86 / react-native-web, `@expo-google-fonts/nunito`, React + Vite, `@fontsource/nunito`.

**Spec:** `docs/superpowers/specs/2026-10-13-rediseno-amable-design.md` (maquetas en `.superpowers/brainstorm/503-1791927867/content/`: `cliente-b-mas-hero-c.html`, `cliente-ticket-cupon.html`, `cliente-seguimiento-v2.html`).

## Global Constraints

- Letra: **Nunito** únicamente (pesos 400/600/700/800), en minúscula normal; ningún `textTransform: 'uppercase'` en títulos, botones, estados ni etiquetas (salvo siglas). Se desinstalan `@expo-google-fonts/barlow-condensed` y `@fontsource/barlow-condensed`.
- Tamaños: títulos de pantalla 20–22 px; nombres 15–17 px; texto de apoyo 12–13 px; etiquetas del seguimiento 10.5 px; el texto debe escalar con el tamaño de letra del sistema (no usar `allowFontScaling={false}`).
- Zonas táctiles ≥ 48 px; estado siempre color + ícono + palabra; WCAG 2.2 AA (contraste 4.5:1 texto, 3:1 bordes de control).
- Paleta: primario `#007cab`, primarioOscuro `#005f84`, acento `#00b2ec`, acentoSuave `#e0f5fd`, fondo `#f3f6f8`, borde `#e3e8ec`. Estados: pendiente/aceptado `#5b6670`, recogido `#b45309`, en camino `#1a5fc4`, entregado `#23744a`, cancelado `#b3261e`.
- Todas las filas/tarjetas de una lista miden lo mismo (líneas fijas con `numberOfLines`, no `height` rígido que corte con letra grande: usar `minHeight` + contenido de estructura idéntica).
- Cupón: línea punteada + dos muescas semicirculares del color de fondo de la pantalla, sin borde propio; tarjeta con sombra muy suave. Número de pedido = texto normal en negrita ("Pedido #N"), sin placa.
- Estados sin inclinación; seguimiento coloreado por el estado actual; la línea termina en el último visto.
- No cambiar lógica de negocio, API, navegación ni el flag `MOSTRAR_PRECIOS`. Sin dependencias nativas nuevas.
- No ejecutar el motor de Impeccable (`scripts/impeccable`) ni `assets.mjs` de taste-skill. No hacer commit ni push salvo que la persona lo pida; cada tarea termina con verificación, no con commit.
- Antes de tocar plugins de Expo, leer las docs v57. `.env` de las tres apps debe quedar apuntando a `https://nelson-express.onrender.com/api` al terminar (para pruebas locales se cambia temporalmente a `http://localhost:8000/api` y se restaura).

## Review Focus

1. Nombre de negocio/dirección muy largos (p. ej. "La Huequita de los Bolones"): la fila/ticket conserva el alto y corta con "…" (Task 3, 4, 6).
2. Tamaño de letra del sistema grande (1.5×): nada se recorta y las filas de una misma lista siguen iguales entre sí (Task 3, 4).
3. Pedido CANCELADO: no hay seguimiento; se ve estado rojo y el motivo en un `Aviso` (Task 4).
4. Entrega sin `costo_envio` (pedidos viejos): el motorizado ve "—", no "$NaN" ni vacío (Task 6).
5. Usuario sin `first_name`: el saludo es "Hola" a secas (Task 3, 6).

---

## File Structure

- Modify (ambas apps móviles): `App.js`, `package.json`, `constants/tema.js`, `components/ui.js`.
- cliente-app: `screens/{Negocios,MisPedidos,PedidoDetalle,Login,Menu,Perfil,ConfirmarPedido,NuevoEncargo,MisDatos,MisDirecciones}Screen.js`, `components/SelectorDireccion.js`.
- motorizado-app: `screens/{Login,MisEntregas,EntregaDetalle,Cuentas,Perfil,EditarPerfil}Screen.js`.
- admin-web: `package.json`, `src/main.jsx`, `src/styles.css`, `src/pages/{Despacho,Ganancias,Login}.jsx`, `src/components/Barra.jsx`.

---

### Task 1: Nunito como única fuente (cliente + motorizado)

**Files:**
- Modify: `cliente-app/package.json`, `motorizado-app/package.json` (quitar Barlow, agregar `@expo-google-fonts/nunito` con `npx expo install`)
- Modify: `cliente-app/App.js`, `motorizado-app/App.js`, `constants/tema.js` (ambas)

**Interfaces:**
- Produces: `fuente = { normal: 'Nunito_400Regular', media: 'Nunito_600SemiBold', negrita: 'Nunito_700Bold', extra: 'Nunito_800ExtraBold' }` en `constants/tema.js`; `familiaPorPeso(peso: string | number | undefined): string` (mismo archivo) que devuelve `fuente.normal` para undefined/'400'/'normal', `media` para '500'/'600', `negrita` para '700'/'bold', `extra` para '800'/'900'. Se elimina `fuente.display`/`displayMedio`. `opcionesCabecera.headerTitleStyle = { fontFamily: fuente.extra, fontSize: 20 }`.

- [ ] **Step 1: Instalar y desinstalar** — en cada app: `npx expo install @expo-google-fonts/nunito` y `npm uninstall @expo-google-fonts/barlow-condensed`. Run: `npm ls @expo-google-fonts/nunito` → versión listada.
- [ ] **Step 2: `tema.js`** — reemplazar `fuente` y añadir `familiaPorPeso` como arriba; `radio = { chico: 8, medio: 12, grande: 16, pastilla: 999 }`.
- [ ] **Step 3: `App.js`** — `useFonts({ Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold })`; las etiquetas de pestañas con `fontFamily: fuente.negrita, fontSize: 12` y sin `textTransform`.
- [ ] **Step 4: Verificar compilación** — Run: `npx expo export --platform android --output-dir %TEMP%\exp` en cada app. Expected: termina con "Exported:" (fallarán las pantallas que aún importan `fuente.display`; se corrigen en las tareas siguientes, así que aquí basta con que `tema.js` y `App.js` no den error de sintaxis: `node --check` no aplica a JSX → usar el export y aceptar solo errores "fuente.display undefined" como esperados hasta Task 2–6).

### Task 2: Componentes base en `ui.js` (cliente; luego copia a motorizado)

**Files:**
- Modify: `cliente-app/components/ui.js`; después copiar a `motorizado-app/components/ui.js` y reaplicar `Boton.colorFondo`/`botonSobrio`.

**Interfaces:**
- Produces (todos exportados de `ui.js`):
  - `Text({ style, ...props })` — envuelve `react-native` `Text`; lee `StyleSheet.flatten(style).fontWeight`, lo quita y pone `fontFamily: familiaPorPeso(peso)` si el estilo no trae `fontFamily`. **Todas las pantallas importan `Text` de aquí** (no de `react-native`).
  - `Boton` — mismo API; texto `fontFamily: fuente.extra, fontSize: 16`, sin `textTransform`.
  - `Titulo({ children, estilo })` — `fontFamily: fuente.extra, fontSize: 20`, sin mayúsculas.
  - `Insignia({ estado })` — fondo `colorEstado[estado]`, `borderRadius: 8`, sin `skewX`; ícono en círculo blanco 16 px con el glifo del color del estado + palabra (`fuente.negrita`, 13).
  - `NumeroPedido({ numero, estilo })` — `<Text>Pedido #{numero}</Text>` negrita 16, `accessibilityLabel="Pedido número N"`. **Reemplaza `Placa`** (se elimina).
  - `Boleta({ children, pie, estilo, fondo })` — igual API; quitar el borde; muescas de 20 px del color `fondo` centradas sobre el borde izquierdo/derecho; línea punteada; sombra suave (opacity .12, radius 3).
  - `Cabecera({ children, estilo })` — View `primario` con `borderBottomRadius: 26`, `paddingHorizontal: 18`, `paddingBottom: 20`; recibe el safe area top por quien la use.
  - `BotonEncargo({ titulo, subtitulo, onPress })` — degradado visual simple (fondo `primario`, franja inclinada vía `Rayas`), recuadro blanco 38 px con flecha; `accessibilityRole="button"`.
  - `Campo` — input con `fontFamily: fuente.media`.
- Consumes: `fuente`, `familiaPorPeso`, `colores`, `radio` de `tema.js` (Task 1).

- [ ] **Step 1: Editar `ui.js`** con las firmas de arriba; eliminar `Placa` y toda referencia a `fuente.display*`.
- [ ] **Step 2: Copiar a motorizado** — `copy cliente-app\components\ui.js motorizado-app\components\ui.js` y reponer el parche de `Boton` (`colorFondo` → `v = { fondo: colorFondo, presionado: colorFondo, texto: '#fff', borde: colorFondo }`, `botonSobrio: { opacity: 0.88 }`).
- [ ] **Step 3: Verificar** — Run: `grep -rn "fuente.display\|Placa" cliente-app motorizado-app --include=*.js -l` (excluye node_modules). Expected: solo pantallas aún no migradas (se vacía al final de Task 6).

### Task 3: Cliente — Negocios

**Files:** Modify: `cliente-app/screens/NegociosScreen.js`

**Interfaces:**
- Consumes: `Cabecera`, `BotonEncargo`, `Entrada`, `Aviso`, `Icono`, `Text` de `ui.js`; `useAuth`/perfil existente para `first_name` (usar el mismo origen del nombre que ya usa `PerfilScreen`).
- Produces: `NegociosScreen` con: `Cabecera` (saludo `Hola, {first_name}` / `Hola` si no hay nombre, línea "¿qué pedimos hoy?", y un `TextInput` de búsqueda de 48 px con etiqueta de accesibilidad "Buscar restaurante"), `BotonEncargo titulo="Pedir un encargo" subtitulo="Lo que necesites, a tu puerta"`, y `FlatList` de **una columna** de filas (`minHeight: 76`, logo 54 px redondeado `contain`/`cover`, nombre `numberOfLines={1}` 16 px negrita, línea "Abierto · N sucursales" con punto verde + palabra, o "Cerrado" y fila atenuada, chevron). Búsqueda: filtra `negocios` por `nombre` sin tildes ni mayúsculas, en el teléfono. Sin chips por tipo.

- [ ] **Step 1: Escribir el filtro** como función pura `filtrarNegocios(lista, texto)` dentro del archivo y comprobarla con un script de Node temporal en el scratchpad: `filtrarNegocios([{nombre:'La Huequita de los Bolones'}], 'huequita')` → 1 elemento; `'  '` → todos; `'xyz'` → 0. Run: `node <scratchpad>\filtro.mjs`. Expected: `OK`.
- [ ] **Step 2: Reescribir la pantalla** según Interfaces. Estado vacío por búsqueda: `Aviso` "No encontramos ese restaurante".
- [ ] **Step 3: Verificar en web** (preview `cliente-app-web`, token de `admin` minteado, viewport 400×850): ejecutar en la página `[...document.querySelectorAll('[data-testid="fila-negocio"]')].map(e => Math.round(e.getBoundingClientRect().height))` (poner `testID="fila-negocio"` a cada fila). Expected: todos los valores iguales (incluida "La Huequita de los Bolones"). Correr axe: 0 violaciones (ignorar la regla `region`).

### Task 4: Cliente — Mis pedidos y Detalle del pedido

**Files:** Modify: `cliente-app/screens/MisPedidosScreen.js`, `cliente-app/screens/PedidoDetalleScreen.js`

**Interfaces:**
- Consumes: `Boleta`, `NumeroPedido`, `Insignia`, `Aviso`, `Text`; `colorEstado`, `etiquetaEstado` de `constants/estados.js`.
- Produces en `PedidoDetalleScreen.js`: `FRASES = { PENDIENTE: 'Esperando confirmación', ACEPTADO: 'Esperando confirmación', RECOGIDO: 'El motorizado ya tiene tu pedido', EN_CAMINO: 'Tu pedido va en camino', ENTREGADO: '¡Tu pedido ya llegó!' }`; `Seguimiento({ estado })` con color `colorEstado[estado]` aplicado a visitos hechos, conectores hechos y halo del paso actual (halo = mismo color con 20% de opacidad); conector que termina exactamente en el último círculo; etiquetas `fontSize: 10.5`, `fuente.negrita`.
- MisPedidos: pestañas tipo interruptor (fondo `#e6ecf0`, activa blanca con texto `primarioOscuro`), cada pedido = `Boleta` de `minHeight` fijo: fila 1 `NumeroPedido` + `Insignia`; nombre (`numberOfLines={1}`, "Encargo" si `tipo === 'ENCARGO'`); dirección (`numberOfLines={1}`); pie: "Envío $X" (o vacío si `costo_envio` es null) + "Ver detalle". Se conserva `Entrada`.
- Detalle: `Boleta` con `NumeroPedido`, `Insignia`, frase (18 px extra), `Seguimiento`, pie "Pedido hecho el …"; tarjetas planas (`estiloTarjeta`) "Recoger en/Entregar en" y "Productos"; el `Aviso tipo="info"` del precio de la comida siempre al final.

- [ ] **Step 1: Test de lógica del seguimiento** — extraer `anchoLinea(pasoActual: number, total: number): number` (fracción 0..1 = `pasoActual / (total - 1)`) y `colorPaso(estado)`; comprobar con script Node temporal: `anchoLinea(3, 4) === 1`, `anchoLinea(0, 4) === 0`, `anchoLinea(2, 4)` ≈ 0.6667. Expected: `OK`.
- [ ] **Step 2: Reescribir ambas pantallas** según Interfaces; pedido `CANCELADO`: sin `Seguimiento`, estado rojo, `Aviso tipo="error"` "Motivo: …" si existe `motivo_cancelacion`.
- [ ] **Step 3: Verificar en web** con 4 pedidos de prueba (uno por estado, creados por la API local y borrados después): capturar el detalle de cada estado y comprobar con JS que el color de los visitos hechos coincide con `colorEstado` (leer `getComputedStyle(...).backgroundColor`); que la altura de todos los tickets de la lista es igual; y con `document.documentElement.style.fontSize='24px'` (simula letra grande) que no hay texto recortado (`scrollWidth <= clientWidth` en el nombre). Axe: 0 violaciones.

### Task 5: Cliente — resto de pantallas

**Files:** Modify: `LoginScreen.js`, `MenuScreen.js`, `PerfilScreen.js`, `ConfirmarPedidoScreen.js`, `NuevoEncargoScreen.js`, `MisDatosScreen.js`, `MisDireccionesScreen.js`, `components/SelectorDireccion.js` (todo en `cliente-app/`).

**Interfaces:**
- Consumes: `Text`, `Titulo`, `Boton`, `Campo`, `Aviso`, `Rayas`, `Cabecera`, `Boleta` y los tokens nuevos.
- Produces: pantallas sin `fuente.display*`, sin `textTransform: 'uppercase'`, sin `fontWeight` con fuente fuera de `Text` envuelto; `import { Text } from '../components/ui'` en cada una.
- Login: se conserva el encabezado celeste con logo y rayas; titular "Tu comida a tu puerta" (`fuente.extra`, 34, minúscula normal); tarjeta del formulario superpuesta como ahora.
- Precios en Menú/Confirmar: `fuente.extra`, tamaños 20–24 (no 30+); selector de cantidad 28.

- [ ] **Step 1: Migrar cada archivo** (cambiar imports de `Text`, reemplazar tokens de fuente, quitar mayúsculas, ajustar tamaños a Global Constraints).
- [ ] **Step 2: Verificar** — `grep -rn "fuente.display\|textTransform: 'uppercase'" cliente-app --include=*.js` (sin node_modules) → sin resultados. `npx expo export --platform android` en cliente-app → "Exported:".
- [ ] **Step 3: Verificar visual/axe** de Login, Menú, Perfil, Confirmar y Nuevo encargo en web (400×850): 0 violaciones axe; sin desbordes horizontales (`document.documentElement.scrollWidth === innerWidth`).

### Task 6: Motorizado — todas las pantallas

**Files:** Modify: `motorizado-app/screens/{Login,MisEntregas,EntregaDetalle,Cuentas,Perfil,EditarPerfil}Screen.js`

**Interfaces:**
- Consumes: componentes de `ui.js` (Task 2), `colorEstado`, `etiquetaEstado`, `colorAccion`, `textoAccion`, `siguienteEstado` de `constants/estados.js`.
- Produces: `MisEntregas`: `Cabecera` con "Hola, {first_name}" (o "Hola") y "{N} entregas en curso" (el nombre sale de `GET /perfil/`, ya usado en `PerfilScreen`), pestañas tipo interruptor, y cada entrega = `Boleta` de igual alto: `NumeroPedido` ("Entrega #N") + `Insignia`; "Recoger en" (nombre, `numberOfLines={1}`) y "Entregar en" (dirección, `numberOfLines={1}`); pie "Tu carrera" + valor en `fuente.extra` 26, o "—" si `costo_envio == null`. `EntregaDetalle`: `Boleta` con número, estado, "Tu carrera" grande y pie con fecha; tarjetas planas; avisos con `Aviso`; botón de acción fijo abajo conservando `colorAccion` y 60 px. `Cuentas`: `Boleta` de liquidación (entregas, total, "Debes entregar (25%)" en naranja, y pie "Te quedas tú" en verde grande). `Login`: titular "Hola, motorizado" (minúscula normal), verificación `es_motorizado` intacta. `Perfil`/`EditarPerfil`: tarjetas planas y letra nueva; la placa del vehículo se muestra como texto en recuadro blanco con borde (es dato del vehículo, no el número de pedido).

- [ ] **Step 1: Migrar las seis pantallas** según Interfaces.
- [ ] **Step 2: Verificar** — `grep -rn "fuente.display\|Placa\|textTransform: 'uppercase'" motorizado-app --include=*.js` (sin node_modules) → sin resultados; `npx expo export --platform android` → "Exported:".
- [ ] **Step 3: Verificar en web** (puerto 8082, token de `moto1`): una entrega con `costo_envio` y una sin él (pedido antiguo): el pie dice "$X" o "—"; alturas de boletas iguales; axe sin violaciones (ignorar `region`).

### Task 7: Panel web (admin-web)

**Files:** Modify: `admin-web/package.json`, `src/main.jsx`, `src/styles.css`, `src/pages/Despacho.jsx`, `src/pages/Ganancias.jsx`, `src/pages/Login.jsx`, `src/components/Barra.jsx`

**Interfaces:**
- Produces: `main.jsx` importa `@fontsource/nunito/{400,600,700,800}.css` (se desinstala `@fontsource/barlow-condensed`); en `styles.css`: `--fuente: 'Nunito', system-ui, sans-serif` aplicada a `body`, `button`, `input`, `select`, `textarea`; se eliminan `--display` y todo `text-transform: uppercase`; `h1,h2` en 800 sin mayúsculas (20–24 px); `.placa` deja de ser caja negra: texto en negrita 15 px; `.insignia` = color sólido + ícono circular + palabra, `border-radius: 8px`, sin `clip-path`; barra superior blanca con subrayado en el enlace activo (ya existe) en Nunito 15 px; `.resumen` (tira de filtros) con `.activa` relleno celeste; filas de tabla de altura uniforme (`td { height: 64px; vertical-align: middle }` y textos largos con `text-overflow: ellipsis` + `title`); el login conserva fondo celeste con la franja, titular `Panel de despacho` en minúscula.
- JSX: en `Despacho.jsx` el `<span className="placa">#{p.id}</span>` pasa a `<strong>Pedido #{p.id}</strong>` y `<span className={\`insignia ${p.estado}\`}>` incluye `<span aria-hidden="true" className="insignia-icono">` con el glifo (✓ entregado, ➜ en camino, • otros) + palabra.

- [ ] **Step 1: Instalar/desinstalar fuentes** — `npm i @fontsource/nunito` y `npm rm @fontsource/barlow-condensed`; actualizar `main.jsx`.
- [ ] **Step 2: Reescribir CSS y ajustar JSX** según Interfaces.
- [ ] **Step 3: Verificar** — `npm run build` → "built in"; en el navegador (token de `despachador`, viewport 1280 y 400): `[...document.querySelectorAll('tbody tr')].map(r => Math.round(r.getBoundingClientRect().height))` → todos iguales; axe en `/`, `/ganancias`, `/encargo`, `/login`: 0 violaciones; `getComputedStyle(document.body).fontFamily` contiene `Nunito`.

### Task 8: Cierre

**Files:** Modify: `.env` de las tres apps (restaurar), memoria del proyecto.

- [ ] **Step 1: Barrido global** — `grep -rni "barlow" cliente-app motorizado-app admin-web --include=*.js --include=*.jsx --include=*.json --include=*.css -l` (excluir `node_modules` y lockfiles) → sin resultados.
- [ ] **Step 2: Compilar todo** — `expo export` ×2 y `vite build` → sin errores.
- [ ] **Step 3: Una ronda final batched** de capturas (móvil 400×850: Negocios, Mis pedidos, Detalle en 2 estados, Entregas, Cuentas; panel a 1280) más axe en todas; corregir lo que salga en un solo lote; como máximo una ronda de confirmación.
- [ ] **Step 4: Restaurar `.env`** a la URL de Render, detener servidores de preview, borrar pedidos de prueba y el token de `sessionStorage`.
- [ ] **Step 5: Actualizar memoria** (`project_nelson_express.md`) con este rediseño (reemplaza la entrada del rediseño Barlow) y avisar a la persona: hacen falta **nuevos APK** de cliente y motorizado; el panel se actualiza con el push a Netlify; ofrecer commit/push.
