# BarberApp · Social Media

Material de redes de BarberApp para **videos cortos verticales** (Reels, TikTok y YouTube Shorts) que buscan dos cosas:
que un barbero frene el scroll y que termine probando la app.

> Público: **dueños de barberías y barberos independientes** de Argentina. No hablamos con los clientes de la barbería.

## Qué hay en la carpeta

| Archivo / carpeta | Para qué sirve |
|---|---|
| [01-identidad-visual.md](01-identidad-visual.md) | Cómo se ve y cómo suena la marca en video: colores, tipografía, logo, subtítulos, movimiento, música, tono. |
| [02-estrategia.md](02-estrategia.md) | A quién le hablamos, qué tipos de video hacemos, el embudo de venta, cómo medir. |
| [03-guiones.md](03-guiones.md) | 12 guiones listos para grabar, plano por plano, con texto en pantalla y descripción. |
| [04-ganchos-y-textos.md](04-ganchos-y-textos.md) | 60 ganchos de 3 segundos, descripciones, hashtags y respuestas para mensajes directos. |
| [05-calendario.md](05-calendario.md) | Los primeros 30 días de publicaciones, día por día. |
| [06-perfil-inicial.md](06-perfil-inicial.md) | Las 7 historias destacadas y los 3 primeros posts de carrusel: qué subir, en qué orden y con qué texto. |
| [contenido-perfil.mjs](contenido-perfil.mjs) | Los textos de las historias y los carruseles (se editan acá). |
| [plantillas/](plantillas/) | Plantillas animadas con la marca (HTML). Se exportan a video con un comando. |
| [marca/](marca/) | Logo en SVG. |
| [render.mjs](render.mjs) | El script que convierte las plantillas en videos y PNG. |
| `export/` | Lo que genera el script: `videos/`, `portadas/` y `perfil/`. |

## Cómo se arma un video

Casi todos los videos combinan **una toma real** (el barbero, el local, el celular en la mano) con **piezas de la marca**:

```
[Gancho 0–3 s]  →  [Toma real o demo 3–20 s]  →  [Cierre 2–4 s]
 export/videos/      grabado con el celular        export/videos/
 gancho-*.mp4        o export/videos/demo-*.mp4   cierre-*.mp4
```

Se juntan en CapCut (o en el editor de Instagram / TikTok): subtítulos, música y listo. El detalle de cada uno está en
[03-guiones.md](03-guiones.md).

## Generar los videos y las imágenes

Usa el Chromium que ya está instalado para los tests (o el Chrome / Edge de la compu), así que no hace falta nada nuevo.

```bash
node social-media/render.mjs            # todo (≈ 5 minutos)
node social-media/render.mjs gancho     # solo los que tienen "gancho" en el nombre
node social-media/render.mjs --lista    # ver todos los trabajos
```

- **Con ffmpeg instalado** (`winget install ffmpeg`) sale **MP4**, que sube directo a cualquier red.
- **Sin ffmpeg** sale **WebM** (TikTok y YouTube lo aceptan; para Instagram pasalo por CapCut o instalá ffmpeg).

### Cambiar textos

Cada plantilla toma sus textos de la URL, así que un video nuevo es una línea en la lista `TRABAJOS` de
[render.mjs](render.mjs):

```js
V("gancho-07-sabado", "hook", 3.6, { tag: "Para barberos", texto: "Tu sábado empieza *a las 9*", sub: "No a las 7 contestando mensajes." }),
```

- `*palabra*` pinta en celeste de acento (puede abarcar varias palabras: `*la agenda se llena.*`).
- `|` corta la línea.
- Antes de publicar, cambiá `LINK` en [render.mjs](render.mjs) por el dominio real del link de reservas.

Para ver una plantilla mientras la editás, abrí el HTML en el navegador (por ejemplo
`plantillas/hook.html?texto=Hola%20*barbero*`) con la ventana en 1080 × 1920 desde las herramientas de desarrollo.

| Plantilla | Qué muestra | Duración |
|---|---|---|
| `hook.html` | Frase grande palabra por palabra | 3,6 s |
| `agenda.html` | La agenda del día llenándose con turnos y señas | 7,5 s |
| `notificaciones.html` | Pantalla bloqueada recibiendo turnos, señas y productos | 7 s |
| `antes-despues.html` | Sin BarberApp tachado / con BarberApp | 7,5 s |
| `precio.html` | ¿Cuánto sale? → $0 → 2 cortes por mes → sin comisiones | 10 s |
| `ausencias.html` | La regla de seña contra los que faltan | 7 s |
| `pasos.html` | Los 3 pasos para empezar hoy, con el link | 6,5 s |
| `cierre.html` | Logo, prueba gratis y llamado a la acción | 4 s |
| `portada.html` | Tapa del video para la grilla del perfil (PNG) | — |
| `destacado.html` | Tapas de historias destacadas y foto de perfil (PNG) | — |
| `historia.html` | Historias 9:16: tapa, punto, lista, pregunta y llamado a la acción (PNG) | — |
| `post.html` | Diapositivas de carrusel 4:5 (PNG) | — |

> `export/` se puede regenerar siempre; si no querés subir videos al repo, agregá `social-media/export/` al `.gitignore`.
