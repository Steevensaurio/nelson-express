# Rediseño "amable" de las tres apps (cliente, motorizado, panel web)

Fecha: 2026-10-13. Estado: borrador para aprobación.

## Intención y por qué

El rediseño anterior (letra condensada Barlow en mayúsculas, placa negra, tickets con muescas con borde, avisos y estados inclinados) se sintió **pesado, repetitivo y tosco**: "todo se ve igual". Además había tarjetas de negocios con alturas distintas. La persona dueña del proyecto quiere apps **amigables, accesibles, con buena experiencia de usuario y visualmente atractivas**, manteniendo la marca (negro del logo + celeste `#007cab` / `#00b2ec`).

Las decisiones de abajo salieron de maquetas que la persona vio y eligió en el navegador (carpeta `.superpowers/brainstorm/`, no se sube al repo).

## Metas

- Letra única, amable y legible: **Nunito** (pesos 600/700/800/900), en minúscula normal (sin mayúsculas forzadas). La letra condensada deja de usarse en las apps (queda solo dentro de las imágenes del logo).
- Mismo lenguaje visual en las tres apps, adaptado a lo que hace cada una.
- **Todas las tarjetas de una lista miden lo mismo** (nombres largos se cortan con puntos suspensivos o a un número fijo de líneas).
- Accesibilidad WCAG 2.2 AA mantenida: contraste, zonas táctiles de 48 px o más, estado siempre por color + ícono + palabra, texto que crece con el tamaño de letra del sistema, movimiento mínimo que respeta "reducir animaciones".
- Experiencia clara: una frase humana por pantalla importante ("Tu pedido va en camino"), jerarquía simple.

## No-metas

- No se cambia la lógica de negocio, la API ni la navegación.
- No hay modo oscuro.
- No se agregan dependencias nativas nuevas (solo la fuente Nunito).
- No se usa ninguna imagen nueva ni se descargan recursos con las herramientas de las skills (ver "Autorizaciones").

## Anti-metas (sería un fracaso aunque "funcione")

- Que vuelva a verse pesado, todo en mayúsculas o con letra condensada.
- Tarjetas de alturas distintas en una misma lista.
- Cajas negras para el número de pedido, muescas con bordes que parezcan "dos bolas", bloques azules enormes.
- Información que dependa solo del color.

## Restricciones

- Expo SDK 57 (leer las docs versionadas de v57 antes de tocar plugins), React Native 0.86 y react-native-web; panel web con Vite + React.
- Los cambios de fuente y splash de las apps móviles requieren **nuevos APK** (los de cliente y motorizado). El panel web se actualiza solo al hacer push a Netlify.
- Paleta ya verificada para contraste; cualquier color nuevo se comprueba antes de usarse.
- Verificación por etapas con axe + script de contraste; una sola ronda de capturas y una de confirmación como máximo.

## Decisiones tomadas (por la persona)

**Tipografía:** Nunito en toda la app. Tamaños como en la maqueta: títulos de pantalla 20–22 px; nombres 15–17 px; texto de apoyo 12–13 px; el texto escala con la configuración del teléfono.

**Negocios (cliente):** cabecera celeste suave con esquinas inferiores redondeadas, saludo y buscador por nombre (sin filtros por tipo); botón "Pedir un encargo" con degradado celeste, franjas inclinadas y flecha en recuadro blanco (el de la opción C); filas de negocio de **altura fija** (logo cuadrado redondeado, nombre en una línea, "Abierto · N sucursales" con punto verde + palabra, chevron).

**Pedidos (cliente):** cada pedido es un **ticket estilo cupón** de igual alto. Efecto cupón = una línea punteada y dos muescas semicirculares del **mismo color del fondo de la pantalla** a los lados de la línea (sin borde ni sombra propia; la tarjeta usa sombra muy suave). Arriba: "Pedido #N" como **texto normal en negrita** (sin placa ni caja), etiqueta de estado, nombre del negocio ("Encargo" si es encargo), dirección de entrega en una línea. Debajo de la línea: el envío y "Ver detalle".

**Etiquetas de estado:** color sólido + ícono + palabra, con los mismos colores de siempre (`#5b6670` pendiente/aceptado, `#b45309` recogido, `#1a5fc4` en camino, `#23744a` entregado, `#b3261e` cancelado), esquinas redondeadas suaves, **sin inclinación**.

**Detalle del pedido (cliente):** ticket arriba (número, estado, frase clara, seguimiento de 4 pasos, y bajo la línea "Pedido hecho el …"); tarjetas planas con borde fino para "Recoger en / Entregar en" y "Productos"; el aviso celeste "El precio de la comida se paga al recibir…" **siempre visible** al final, como antes.

**Seguimiento de 4 pasos:** los visitos, la línea y el halo del paso actual toman el **color del estado actual** (gris → naranja → azul → verde); lo ya recorrido se pinta de ese color; la línea termina exactamente en el último visto; etiquetas de 10.5 px, negrita media; el paso actual lleva un halo suave del mismo color.

**Las otras dos apps:** mismo estilo (Nunito, cabecera celeste suave, tickets cupón, estados sólidos con ícono, avisos celestes, tarjetas planas), adaptado:
- **Motorizado:** "Mis entregas" con cabecera celeste y saludo; cada entrega es un ticket cupón del mismo alto (Entrega #N, estado, "Recoger en", "Entregar en", y bajo la línea "Tu carrera $X" en grande); detalle con ticket arriba y botón de acción fijo abajo del color del siguiente paso; Cuentas como ticket de liquidación (entregas, total, "Debes entregar", y "Te quedas tú" bajo la línea); Perfil sencillo con datos en tarjetas.
- **Panel web (despacho):** barra superior blanca con logo y navegación con subrayado en el enlace activo; tira de filtros del despacho (el filtro activo con relleno celeste); las tablas siguen siendo tablas (es un panel de trabajo), con filas de igual alto, número de pedido en negrita normal, estados sólidos con ícono, y el celeste solo en acciones principales y selección.

## Lo que queda a criterio de quien construya (marcado como llamada mía)

- **Login de las dos apps móviles y del panel:** conservar el encabezado celeste con el logo y las rayas, pero con titular en Nunito 800 y en minúscula ("Tu comida a tu puerta", "Hola, motorizado"). *Mi llamada.*
- **Menú de productos, perfil, formularios, selector de direcciones, asistente de encargo:** misma receta (tarjetas planas con borde fino, botones azules grandes, campos con etiqueta visible). Mantienen su estructura actual; solo cambia letra, tamaños, radios y avisos. *Mi llamada.*
- **Saludo "Hola, {nombre}":** usa `first_name`; si no existe, solo "Hola". *Mi llamada.*
- **Estado "Abierto" de un negocio:** abierto si al menos una sucursal está abierta (ya existe el dato); si no, "Cerrado" con la tarjeta atenuada. *Mi llamada.*
- **No se muestra tiempo estimado de llegada** (en la maqueta aparecía "llega en unos 15 min", pero no existe ese dato). Las frases por estado son: Pendiente "Esperando confirmación", Recogido "El motorizado ya tiene tu pedido", En camino "Tu pedido va en camino", Entregado "¡Tu pedido ya llegó!". *Mi llamada.*
- **Buscador de Negocios:** filtra por nombre en el teléfono (sin cambios en el servidor). *Mi llamada.*
- **Entrada de listas:** el efecto suave actual (`Entrada`) se conserva, una sola vez por pantalla.
- Se **quitan** de las apps `@expo-google-fonts/barlow-condensed` y `@fontsource/barlow-condensed` y se instalan `@expo-google-fonts/nunito` y `@fontsource/nunito`.

## Resuelto con la persona

- **Sin filtros por tipo en Negocios** (decidido): solo el buscador por nombre. Los chips "Pollo / Típico / Mariscos" de la maqueta **no se construyen**, y no se agrega ninguna categoría al servidor.

## Autorizaciones

- No se ejecuta el motor de Impeccable (descarga un binario) ni `assets.mjs` de taste-skill (descarga imágenes). Si se quisieran usar (detector automático, modo en vivo, banco de imágenes), hay que pedir permiso explícito antes.
- Las skills de diseño (impeccable, emil-design-eng/animate, ui-ux-pro-max) se usan como guía manual; superpowers define el proceso (diseño → plan → ejecución → verificación).

## Verificación esperada

- Compilar las tres (`expo export` ×2, `vite build`).
- axe en todas las pantallas y script de contraste para los pares de color nuevos.
- Una ronda de capturas (móvil 400×850; panel a 1280 y 400) y, si hace falta, una de confirmación.
- Revisar con tamaño de letra grande que las filas iguales no se rompan.
