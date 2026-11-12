# Perfil inicial: historias destacadas y primeros posts

Todo está generado en `export/`. Los textos se editan en [contenido-perfil.mjs](contenido-perfil.mjs) y se regeneran
con `node social-media/render.mjs historias` o `node social-media/render.mjs posts`.

---

## Historias destacadas

### Cómo subirlas

1. Subí cada imagen como historia, **en orden** (01, 02, 03…), desde `export/historias/<destacado>/`.
2. En la **última historia de cada destacado** (la que dice "Tocá el enlace") agregá el **sticker de enlace** con el
   link de la web (`?utm_source=instagram&utm_medium=historia`) y ubicalo justo debajo de la flecha.
   En **Ayuda**, la última no lleva enlace: dice "Mandanos un mensaje".
3. Cuando estén publicadas, creá el destacado desde el perfil (**+ Nuevo**), elegí esas historias, poné el nombre y como
   tapa la imagen de `export/perfil/destacado-<nombre>.png`.
4. Orden en el perfil (de izquierda a derecha): **Perfil · Agenda · Seña · Precio · Empezar · Clientes · Ayuda**.

| Destacado | Tapa | Historias | Qué cuenta |
|---|---|---|---|
| **Perfil** | `destacado-perfil.png` | `historias/perfil/` (6) | Qué es BarberApp, para quién, lo que hace, que es para el celular y que atienden personas. |
| **Agenda** | `destacado-agenda.png` | `historias/agenda/` (7) | Reservan solos con el link, una agenda por barbero, horarios cortados y bloqueos, avisos, clientes a mano. |
| **Seña** | `destacado-sena.png` | `historias/sena/` (7) | Se cobra al reservar, la plata es tuya, el que falta la pierde, dos ausencias = seña obligatoria, sin comisión. |
| **Precio** | `destacado-precio.png` | `historias/precio/` (5) | $0 el primer mes, después 2 cortes por mes, todo incluido. |
| **Empezar** | `destacado-empezar.png` | `historias/empezar/` (6) | Los 4 pasos: crear la barbería, servicios y equipo, Mercado Pago, compartir el link. |
| **Clientes** | `destacado-clientes.png` | `historias/clientes/` (7) | Cómo reservan tus clientes: sin descargar, eligen todo solos, avisos, productos, calificación. |
| **Ayuda** | `destacado-ayuda.png` | `historias/ayuda/` (8) | 5 preguntas frecuentes, la atención por WhatsApp y una invitación a escribir. |

### Texto de cada historia

**Perfil**
1. *Qué es BarberApp*: **Tu barbería. Una sola agenda.** La app de turnos para barberías y barberos.
2. **Para quién es**: Para el barbero que trabaja solo y para la barbería con equipo.
3. **Lo que hace**: Turnos online con tu link · Señas con Mercado Pago · Agenda de todo el equipo · Avisos al celular · Tienda de productos · Finanzas, comisiones y sueldos.
4. **Desde el celular**: Android, iPhone y compu. Se instala desde el navegador, sin pasar por ninguna tienda.
5. **Atendida por personas**: Si tenés una duda, nos escribís por WhatsApp desde tu panel y te respondemos nosotros, no un bot.
6. **Probala 1 mes gratis**: Sin tarjeta. Tu barbería lista hoy. → *sticker de enlace*

**Agenda**
1. **Todos tus turnos, en una pantalla.** Del día y del mes, con el estado de cada seña.
2. **Reservan solos**: Compartís tu link y tus clientes eligen barbero, servicio y horario, a cualquier hora. *(Instagram · WhatsApp · QR en el local)*
3. **Una agenda por barbero**: Cada uno con sus horarios. Vos ves todo el local junto.
4. **Horarios a tu medida**: Horarios cortados y bloqueos para cuando no atendés.
5. **Te avisa al toque**: Notificación en el celular apenas entra un turno, para vos y para el barbero.
6. **Tus clientes a mano**: Historial y datos de cada cliente, sin buscar en el WhatsApp.
7. **Probala 1 mes gratis** → *sticker de enlace*

**Seña**
1. **La seña, directo a tu Mercado Pago.** Menos turnos que no vienen.
2. **Se cobra al reservar**: El cliente la paga cuando saca el turno. Vos no perseguís transferencias.
3. **La plata es tuya**: Cada barbería vincula su propia cuenta. BarberApp nunca toca esa plata.
4. **El que falta, la pierde**: Si no viene y no avisa, pierde la seña.
5. **Dos ausencias, seña obligatoria**: Después de dos ausencias, solo puede reservar pagando la seña por adelantado.
6. **Sin comisión**: No te cobramos nada por seña ni por turno.
7. **Probala 1 mes gratis** → *sticker de enlace*

**Precio**
1. **¿Cuánto sale?** Sin letra chica.
2. **$0 el primer mes**: Sin tarjeta. Creás tu barbería con tu email y la usás en el momento.
3. **Después, lo que salen 2 cortes**: Si tu corte sale $10.000, pagás $20.000 por mes. *(Transferencia · Mercado Pago · Efectivo)*
4. **Todo, sin extras**: Todo tu equipo · Señas con tu Mercado Pago · Agenda, clientes, tienda y finanzas · Comisiones y sueldos · Sin comisión por turno ni por seña.
5. **Probala 1 mes gratis** → *sticker de enlace*

**Empezar**
1. **Hoy la creás. Hoy recibís turnos.** Unos pasos y un par de minutos.
2. **Creá tu barbería**: Nombre, dirección y WhatsApp. Con tu email, sin tarjeta.
3. **Cargá servicios y equipo**: Precios, duración de cada servicio y los horarios de tus barberos.
4. **Vinculá Mercado Pago**: Si querés cobrar seña, autorizás tu cuenta en un toque.
5. **Compartí tu link**: Y los turnos empiezan a llegar solos. *(Bio de Instagram · WhatsApp · QR en el local)*
6. **Probala 1 mes gratis** → *sticker de enlace*

**Clientes**
1. **Así reservan tus clientes.** Fácil para ellos, ordenado para vos.
2. **Sin descargar nada**: Reservan desde el navegador con tu link. *(Sin tiendas · Sin crear cuenta)*
3. **Eligen todo solos**: Barbero, servicio y horario, a cualquier hora.
4. **No se olvidan**: Les llegan avisos para que no se olviden del turno.
5. **Suman productos**: Agregan la cera o el shampoo a la reserva y lo retiran en el sillón.
6. **Califican el turno**: Después del corte dejan su calificación.
7. **Dales tu link**: Probala 1 mes gratis. → *sticker de enlace*

**Ayuda**
1. **Preguntas frecuentes.** Y si no está acá, escribinos.
2. ¿Necesito tarjeta para la prueba? → No…
3. ¿A quién le llega la plata de las señas? → A vos…
4. ¿Mis clientes tienen que descargar algo? → No…
5. ¿Sirve si trabajo con varios barberos? → Sí…
6. ¿Cuánto cuesta después del mes de prueba? → Lo que salen 2 cortes…
7. **Te responde una persona**: WhatsApp desde tu panel, nada de bots.
8. **¿Otra duda? Escribinos.** → *sin enlace: invita a mandar un mensaje directo*

> Para que no se vean "muertas": a algunas historias sumales, al subirlas, un sticker de **encuesta** o de **pregunta**
> (por ejemplo, en Seña 4: encuesta "¿Te faltaron esta semana? Sí / No"). Quedan guardadas en el destacado.

---

## Primeros 3 posts (carruseles)

Imágenes 4:5 en `export/posts/<post>/`. Subilas como **un solo post con varias fotos**, en orden.

**Orden de publicación:** primero el **03**, después el **02** y por último el **01**, con un día entre cada uno.
Así en la grilla queda arriba a la izquierda el de "Qué es". Después **fijá los tres** en el perfil.

> Cuando empiecen los videos (ver [05-calendario.md](05-calendario.md)), alternalos: los carruseles se guardan y se
> comparten, y los videos traen alcance nuevo.

### Post 01 · Qué es BarberApp
`export/posts/01-que-es/` (6 imágenes): tapa → turnos online → seña con Mercado Pago → todo tu equipo → comisiones y sueldos → probala gratis.

**Descripción:**
```
Tu barbería. Una sola agenda. 💈

Con BarberApp tus clientes reservan solos desde un link, pagan la seña con Mercado Pago y vos ves la agenda de todo tu equipo desde el celular. Las comisiones y los sueldos se calculan solos.

Probala 1 mes gratis, sin tarjeta. Link en la bio 👆

#barberia #barbero #barberargentina #turnosonline #barberapp
```

### Post 02 · 5 señales de que tu barbería necesita turnos online
`export/posts/02-senales/` (7 imágenes): tapa → WhatsApp a las 11 de la noche → clientes que faltan → turnos pisados → fin de mes con calculadora → productos con polvo → ¿te pasan 2 o más?

**Descripción:**
```
¿Cuántas te pasan? Contestá con el número en los comentarios 👇

Si te pasan 2 o más, tu agenda está trabajando en tu contra. BarberApp resuelve las 5: turnos online, seña contra las ausencias, una agenda por barbero, comisiones automáticas y tu tienda adentro de la reserva.

Mandáselo a ese barbero que vive contestando WhatsApp 😅

#barberia #barbero #barberos #emprendedor #barberapp
```

### Post 03 · ¿Cuánto sale BarberApp?
`export/posts/03-precio/` (6 imágenes): tapa → $0 el primer mes → después 2 cortes por mes → qué incluye → sin comisiones → probala gratis.

**Descripción:**
```
Sin letra chica 👇

El primer mes es gratis y no te pide tarjeta. Después pagás por mes lo que salen 2 cortes en tu barbería, por transferencia, Mercado Pago o efectivo.

No cobramos comisión por turno ni por seña: la plata de las señas entra directo a tu Mercado Pago.

¿Dudas? Escribinos por mensaje directo.

#barberia #barbero #barberargentina #negociopropio #barberapp
```

**Primer comentario de la cuenta** (en los tres, para fijarlo): `Comentá AGENDA y te mandamos el link por mensaje 💈`
