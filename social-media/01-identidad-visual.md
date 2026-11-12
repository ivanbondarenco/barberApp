# Identidad visual en video

La marca en redes es la misma que la app: **"Medianoche y blanco"**. Navy profundo, cobalto, un celeste de acento y
blanco. Seria, prolija, de herramienta profesional. Lo opuesto al flyer de barbería con dorados, calaveras y fuego:
ahí es donde nos diferenciamos.

> Regla de oro: **si el video podría ser de cualquier app, falta marca. Si parece una publicidad, sobra.**
> Tiene que parecer un barbero mostrando su celular, con la firma de BarberApp.

---

## 1. Colores

| Rol | Nombre | HEX | Uso en video |
|---|---|---|---|
| Fondo principal | Medianoche | `#0A1020` | Fondo de todas las placas (gancho, demo, cierre). |
| Fondo de tarjetas | Medianoche suave | `#121A2E` | Cajas y tarjetas sobre el fondo. |
| Líneas | Línea noche | `#1E2842` | Bordes de tarjetas, separadores. |
| Texto secundario | Gris noche | `#A3AEC7` | Subtítulo, aclaraciones, letra chica. |
| **Acento** | Celeste | `#8FAEFF` | La palabra que importa del título. Una por frase. |
| **Acción** | Cobalto | `#2563EB` | Botones, barras, lo que se toca. |
| Éxito | Menta | `#6EE7B7` | "Seña pagada", checks, la etiqueta de arriba. |
| Fondo claro | Blanco / Pizarra | `#FFFFFF` / `#F8F9FF` | Tarjetas de la app, la mitad "con BarberApp". |
| Texto sobre claro | Tinta | `#101C36` | Nunca negro puro. |
| Espera | Ámbar | `#FDEED3` / `#8A5A00` | Solo para "seña a verificar". |
| Error | Coral | `#FF8A80` | Solo para tachar lo de "antes". |

**Prohibido:** negro puro (`#000`), dorados, degradados, neón, rojo como color de marca.

**Proporción en pantalla:** 70 % medianoche · 20 % blanco · 10 % acento (celeste + cobalto + menta juntos).

## 2. Tipografía

**Plus Jakarta Sans** (gratis en Google Fonts, es la de la app). En CapCut: *Plus Jakarta Sans* si la cargaste;
si no, **Inter** o **Montserrat** en ExtraBold como reemplazo.

| Uso | Peso | Tamaño en 1080 × 1920 | Detalle |
|---|---|---|---|
| Título del gancho | ExtraBold 800 | 110–124 px | Interletrado −4 %, interlineado 1.0 |
| Título de escena | ExtraBold 800 | 80–88 px | Máximo 2 líneas |
| Subtítulo | Medium 500 | 40–44 px | Gris noche |
| Etiqueta superior | ExtraBold 800 | 30–32 px | Píldora menta: "Para barberos" |
| Subtítulos hablados | Bold 700 | 54–60 px | Ver punto 5 |
| Horarios / números de paso | Monoespaciada | 22–40 px | Como en la agenda: `10:00`, `01` |

**Una palabra en celeste por frase**, la que carga el sentido: "¿Seguís anotando turnos en un *cuaderno?*".
Nunca dos colores de acento en la misma frase.

## 3. Logo

- **Sello** ([marca/logo-sello.svg](marca/logo-sello.svg)): el calendario con la tijera y el check menta.
- **Firma de los videos:** sello de 56 px + "BarberApp" en ExtraBold, arriba a la izquierda, al 90 %. Siempre presente,
  nunca protagonista.
- **Cierre:** sello grande (300 px) centrado con el nombre debajo.
- **No:** deformarlo, cambiarle los colores, ponerlo sobre una foto sin su fondo navy, girarlo, animarlo con rebotes.

## 4. Formato y zona segura

- **1080 × 1920 (9:16)**, 30 fps.
- Duración ideal: **15–30 s**. Nunca más de 45 s para vender; los tutoriales pueden llegar a 60 s.
- Las interfaces de Reels / TikTok tapan partes de la pantalla. **Todo lo importante va dentro de:**

```
┌───────────────────────────┐
│   220 px arriba: nada     │  ← nombre de usuario, "Reels"
│ ┌─────────────────────┐   │
│ │                     │ 150 px a la derecha:
│ │   ZONA SEGURA       │   │  ← botones de like, comentar, compartir
│ │   72 px de margen   │   │
│ │   a la izquierda    │   │
│ └─────────────────────┘   │
│  440 px abajo: nada       │  ← descripción, música, botón
└───────────────────────────┘
```

- **Portada en la grilla:** Instagram la recorta a 3:4 al centro. Por eso en `portada.html` el texto vive en la franja
  del medio.

## 5. Subtítulos (los videos se miran sin sonido)

Todos los videos llevan subtítulos. Estilo único:

- Plus Jakarta Sans Bold, 54–60 px, **blanco**, sin borde ni sombra pesada.
- Fondo: caja **medianoche al 85 %** con esquinas redondeadas (radio 20 px) y 16 px de aire.
- Palabra clave en **celeste `#8FAEFF`**.
- **2 a 4 palabras por bloque**, aparecen de golpe (sin efecto máquina de escribir, sin rebotes).
- Posición: a 1150–1250 px desde arriba (encima de la descripción, debajo de la cara).
- En CapCut: *Texto → Subtítulos automáticos*, después aplicá el estilo y guardalo como **Plantilla "BarberApp"**.

## 6. Movimiento

Las plantillas ya lo traen; para lo que edites a mano:

| Qué | Cómo |
|---|---|
| Textos que entran | Suben 60 px y aparecen en 0,5 s. Desaceleran al final. |
| Tarjetas, turnos, botones | Escalan de 82 % a 100 % con un rebote chico, una sola vez. |
| Notificaciones | Bajan desde arriba, como en el celular. |
| Entre escenas | Corte seco o salida hacia arriba en 0,35 s. **Nada de transiciones de CapCut** (giros, glitch, zoom). |
| Ritmo | Algo nuevo en pantalla cada **1,5–2 s**. Si pasan 3 s sin cambio, se pierde gente. |

## 7. Tomas reales: cómo se graban

- **Celular vertical, cámara de atrás**, 1080p o 4K a 30 fps. Limpiá el lente.
- **Luz:** de frente o de costado (la ventana del local o el aro de luz). Nunca a contraluz.
- **Pantalla del celular:** grabación de pantalla nativa (no filmar la pantalla con otra cámara), modo no molestar,
  batería y hora prolijas. Agrandá el texto del sistema para que se lea.
- **Manos en cuadro:** el celular en la mano del barbero, con el sillón o la capa de fondo, vende más que la pantalla sola.
- **Sonido:** micrófono corbatero si habla a cámara; si no, voz en off grabada aparte en un lugar sin eco.
- **Datos de prueba:** usá una barbería de demo con nombres inventados. **Nunca** muestres teléfonos ni datos de
  clientes reales.

## 8. Música y sonido

- Audios en tendencia **solo** en el feed de la red (no se pueden usar en anuncios pagos).
- Para anuncios: música libre (biblioteca comercial de TikTok / Meta Sound Collection).
- Estilo: beats urbanos tranquilos, lo-fi, boom bap suave. Nada épico ni cinematográfico.
- **Sonidos de marca:** un "tic" suave cuando entra un turno y el sonido de notificación cuando cae una seña.
  Volumen de la música al 15–25 % cuando hay voz.

## 9. Tono de voz

Hablamos como un colega del rubro, no como una empresa de software.

| Sí | No |
|---|---|
| Voseo: "probala", "cargá", "compartí" | "Pruébela", "descargue" |
| "Turno", "seña", "sillón", "fade", "el sábado a full" | "Cita", "depósito", "slot", "solución integral" |
| Frases cortas. Una idea por frase. | Párrafos, listas de funciones |
| Números concretos: "2 cortes por mes", "3 minutos" | "Precios accesibles", "rápido y fácil" |
| "Probar gratis" | "Demo", "Solicitar información" |
| Humor del día a día del barbero | Burlarse del cliente o de otros barberos |
| Lo que la app hace hoy | Prometer funciones que no existen |

**Frases de marca** (usarlas tal cual):

- *Tu barbería. Una sola agenda.*
- *Probala 1 mes gratis. Después, lo que salen dos cortes.*
- *Sin comisión por turno ni por seña.*
- *La seña entra directo a tu Mercado Pago.*
- *Hoy la creás. Hoy recibís turnos.*

## 10. Checklist antes de publicar

- [ ] Los primeros 3 s tienen texto grande y una pregunta o problema del barbero.
- [ ] Hay subtítulos con el estilo de la marca.
- [ ] Nada importante queda en la zona que tapan los botones.
- [ ] La firma de BarberApp aparece arriba a la izquierda en las placas.
- [ ] Termina con la placa de cierre (link en la bio o "comentá AGENDA").
- [ ] Cero datos reales de clientes en pantalla.
- [ ] Portada cargada desde `export/portadas/`.
- [ ] El precio y la prueba coinciden con la web (1 mes gratis, 2 cortes por mes).
