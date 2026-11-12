# Estrategia de videos cortos

## Objetivo

**Conseguir barberías que prueben BarberApp y se queden después del mes gratis.**
Los likes no pagan nada: medimos mensajes, registros y barberías activas.

## A quién le hablamos

| Perfil | Qué le duele | Qué le mostramos |
|---|---|---|
| **Barbero independiente** (1 sillón, a veces a domicilio) | Contesta WhatsApp todo el día, le faltan clientes, cobra todo en efectivo. | Link de reservas, seña con Mercado Pago, avisos. |
| **Dueño de barbería chica** (2 a 5 barberos) | El cuaderno no da más, no sabe quién atiende a quién, las comisiones a fin de mes son un lío. | Agenda del equipo, comisiones y sueldos, finanzas. |
| **Barbero empleado** | No decide, pero influye. Sufre las ausencias. | Contenido para que se lo pase al dueño ("mandáselo a tu jefe"). |

Dónde están: **Instagram primero** (es la vidriera de las barberías en Argentina), TikTok segundo, YouTube Shorts
como repost sin esfuerzo.

## Los 5 pilares de contenido

Cada video entra en uno solo. Rotarlos para no cansar.

| Pilar | % | Objetivo | Ejemplo |
|---|---|---|---|
| **1. El dolor del barbero** (humor, POV, "te pasó") | 30 % | Alcance: que lo compartan entre barberos. | "POV: te dejaron plantado un sábado a las 11." |
| **2. Demo de 15 segundos** | 25 % | Que entiendan qué hace en una mirada. | La agenda llenándose sola con turnos y señas. |
| **3. Romper objeciones** | 20 % | Sacar las excusas para no probar. | "¿Mis clientes tienen que descargar algo? No." |
| **4. Números y plata** | 15 % | Justificar el gasto. | "Un sillón vacío por semana te cuesta más que la app." |
| **5. Barberos reales** | 10 % | Confianza. | Un dueño mostrando su agenda real del sábado. |

## El embudo

```
VEN EL VIDEO ──→ FRENAN ──→ ENTIENDEN ──→ ESCRIBEN ──→ PRUEBAN ──→ PAGAN
   alcance       gancho       demo         CTA          registro    seguimiento
                 0–3 s        3–20 s       cierre       link bio    WhatsApp
```

### El llamado a la acción (CTA)

Alternar dos cierres (las dos placas ya están en `export/videos/`):

1. **"Link en la bio"** → la web, botón *Probar gratis*. Sirve para quien ya está decidido.
2. **"Comentá AGENDA"** → le mandamos el link por mensaje directo. Rinde más: el comentario empuja el video en el
   algoritmo y abre una conversación donde se puede vender.
   - Automatizarlo con **ManyChat** (o la respuesta automática de Meta Business Suite): palabra clave `AGENDA` →
     mensaje con el link y una pregunta ("¿cuántos barberos son en el local?").
   - Respuestas armadas en [04-ganchos-y-textos.md](04-ganchos-y-textos.md#respuestas-para-mensajes-directos).

### Link en la bio con seguimiento

Usar el link de la web con parámetros para saber qué red trae registros:

```
https://<dominio>/?utm_source=instagram&utm_medium=bio
https://<dominio>/?utm_source=tiktok&utm_medium=bio
https://<dominio>/?utm_source=instagram&utm_medium=dm&utm_campaign=agenda
```

## Cómo se ve el perfil

| Elemento | Qué poner |
|---|---|
| Foto | `export/perfil/foto-perfil.png` (el sello). |
| Nombre | **BarberApp · Turnos para barberías** (el nombre se indexa en la búsqueda). |
| Bio | `Turnos online + seña con Mercado Pago 💈` / `Tu barbería, una sola agenda.` / `1 mes gratis, sin tarjeta 👇` |
| Link | La web con `utm_source=instagram&utm_medium=bio`. |
| Destacados | Funciones (`destacado-agenda`), Seña (`destacado-sena`), Precio (`destacado-precio`), Empezar (`destacado-empezar`), Barberías (`destacado-clientes`), Ayuda (`destacado-ayuda`). |
| Fijados | 1) La demo de agenda. 2) El video de precio. 3) Un testimonio en cuanto exista. |
| Grilla | Todas las portadas desde `export/portadas/`: la grilla se ve como una serie ordenada. |

## Frecuencia

- **Mes 1:** 5 videos por semana (lunes a viernes) + historias diarias. Ver [05-calendario.md](05-calendario.md).
- **Desde el mes 2:** 3 a 4 videos por semana, repitiendo los formatos que mejor funcionaron.
- Mismo video en Instagram, TikTok y Shorts, **sin la marca de agua de TikTok** (exportar desde CapCut, no descargar
  de TikTok).
- Mejor horario para barberos: **lunes y martes** (día libre de muchos), **22–23 h** (después de cerrar) y
  **13–14 h** (corte del mediodía). Confirmalo con las estadísticas a las 3 semanas.

## Crecimiento sin pagar

- **Comentar en cuentas de barberías** (con la cuenta de la marca, aportando, nunca con spam del link).
- **Collabs:** publicar videos en colaboración con las barberías que usan la app (el video sale en los dos perfiles).
- **Barbero embajador:** 1 o 2 barberos conocidos de la zona que la usen y graben su sábado real. Pago en meses
  gratis.
- **Dúos / remix:** reaccionar a videos virales de barberos con el problema que la app resuelve.
- **Historias diarias:** encuestas ("¿Cuántos te faltaron esta semana?"), cajas de preguntas, detrás de escena.

## Cuando haya presupuesto para anuncios

- Usar como anuncio **solo los videos que ya funcionaron orgánicos** (más del 30 % de retención a los 3 s y comentarios).
- Público: Argentina, intereses *barbería, peluquería, barber, cuidado masculino*, + personas que interactuaron con el perfil.
- Objetivo: mensajes (a Instagram Direct / WhatsApp) antes que tráfico a la web.
- Arrancar con poco por día, durante 7 días, comparando 3 ganchos distintos sobre el mismo cuerpo de video.

## Cómo medimos (cada lunes)

| Métrica | Qué dice | Meta inicial |
|---|---|---|
| Retención a los 3 s | ¿El gancho funciona? | > 30 % |
| Tiempo de visualización promedio | ¿El video sostiene? | > 50 % del largo |
| Compartidos y guardados | ¿Les sirve a otros barberos? | > 2 % de las vistas |
| Comentarios "AGENDA" / mensajes | Intención de compra | Contarlos por video |
| Visitas a la web desde redes | El link funciona | Por `utm_source` |
| Registros de barberías | **La que importa** | Contar por semana |
| Barberías que pagan al mes 2 | El producto convence | — |

**Regla de decisión:** el gancho que mejor retiene se reutiliza con otro cuerpo; el cuerpo que más mensajes trae se
reutiliza con otro gancho. Lo que no supera el 20 % de retención a los 3 s no se repite.
