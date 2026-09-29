# BarberApp · WebApp PWA (MVP)

App mobile-first y responsive para reservar turnos con seña configurable, gestionar la agenda de los barberos, cobrar en el sillón y vender productos que se retiran durante el corte. Tiene backend propio con base SQLite, así que los datos se comparten entre todos los dispositivos.

Es **multi-barbería**: cada local tiene su equipo, su catálogo, sus clientes y su cuenta de Mercado Pago, aislados del resto. Cada uno comparte su link `/b/<slug>` y por ahí entran sus clientes.

## Stack

- **Next.js 16** (App Router, Route Handlers) + **React 19** + **TypeScript**
- **SQLite** vía `sql.js` (WebAssembly, sin compilación nativa), persistido en `data/ds-studio.db`
- **Tailwind CSS v4** con los tokens del design system *Atelier Urbane* (`src/app/globals.css`)
- **Motion** (`motion/react`, con LazyMotion) para hojas arrastrables, listas animadas y microinteracciones. **React `<ViewTransition>`** para las transiciones entre pantallas.
- **Zustand** como caché del cliente, con actualizaciones optimistas y sincronización con el servidor cada 10 s
- **React Hook Form + Zod**, **Lucide React**
- **PWA**: `public/manifest.json` y un service worker propio (la API nunca se cachea)
- **Layout responsive**: hasta 1023 px es la columna mobile con barra inferior; desde 1024 px (`lg`) pasa a escritorio — navegación lateral, contenido centrado y las hojas se muestran como diálogos centrados

## Arranque

```bash
npm install
npm run dev                  # http://localhost:3000
npm run build && npm start   # producción
```

La base se crea sola la primera vez y arranca **vacía**: la primera pantalla es el ingreso, y desde la solapa **Soy barbero** se crea la barbería. Para levantar la barbería de demostración con datos de ejemplo, arrancá con `SEED_DEMO=1`. Para empezar de cero, borrá la carpeta `data/`.

| Variable | Uso |
|---|---|
| `DATABASE_PATH` | Ruta del archivo SQLite (por defecto `./data/ds-studio.db`) |
| `SECRETS_KEY` | **Obligatoria en producción.** Clave (mínimo 32 caracteres) que cifra en la base las credenciales de Mercado Pago y WhatsApp de cada barbería. Se genera con `openssl rand -base64 32` |
| `ALERT_WEBHOOK_URL` | Webhook de Slack o Discord (o cualquier URL que reciba JSON) al que llegan los errores del servidor |
| `MP_ACCESS_TOKEN` | Credencial de Mercado Pago. Opcional: lo habitual es cargarla desde **Configuración → Pagos**, que la guarda por barbería |
| `MP_WEBHOOK_SECRET` | Clave secreta de la notificación de pagos. Sin ella el webhook rechaza todo |
| `MP_PUBLIC_KEY` | Public key de Mercado Pago (hoy sin uso en el checkout redirigido) |
| `WA_ACCESS_TOKEN`, `WA_PHONE_NUMBER_ID` | Credenciales de WhatsApp Cloud API. Opcionales: lo habitual es cargarlas desde **Configuración → Conexiones** |
| `WA_TEMPLATE`, `WA_LANGUAGE` | Plantilla de autenticación aprobada por Meta y su idioma (por defecto `otp_code` / `es_AR`) |
| `OTP_DEBUG` | **Solo desarrollo.** Con `1` los códigos viajan en la respuesta en vez de enviarse por WhatsApp. En producción la app no arranca con esto |
| `SEED_DEMO` | **Solo desarrollo.** Con `1` crea la barbería de demostración si la base está vacía. En producción la app no arranca con esto |
| `E2E_TEST_MODE` | **Solo tests.** Habilita `OTP_DEBUG` y `SEED_DEMO` en la app compilada, y únicamente contra `localhost` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | Servidor de correo. Uno solo para toda la instalación (ver **Mails**). Sin esto no se envía ningún mail |
| `SMTP_SECURE` | `1` fuerza TLS desde el saludo. Vacío: se deduce del puerto (465 = sí) |
| `MAIL_FROM` | Remitente, por ejemplo `BarberApp <turnos@tudominio.com>` |
| `APP_URL` | Dirección pública de la app. Con esto se arman los links de los mails |
| `BACKUP_DIR`, `BACKUP_KEEP` | Destino y cantidad de copias de `npm run backup` |

Ver `.env.example`. Las credenciales que cargue cada barbería desde la app tienen prioridad sobre las variables de entorno, que quedan como atajo para un deploy de un solo local.

### Cuentas sembradas

Con `SEED_DEMO=1` la base arranca con una barbería de demostración (`/b/ds-studio`) y estas cuentas:

| Rol | Usuario | Contraseña |
|---|---|---|
| Cliente | `tomas.ferreyra@example.com` | `demo1234` |
| Dueño | `admin@dsstudio.com.ar` | `demo1234` |
| Código WhatsApp (recuperar la contraseña) | — | se envía al celular |

Las contraseñas tienen al menos 8 caracteres, sin otras reglas. Después de 5 intentos fallidos, ese usuario queda bloqueado 10 minutos.
La contraseña sembrada se cambia desde **Configuración → Cuenta**; hacelo antes de abrir la app al público.

Los barberos no vienen sembrados: el dueño les da acceso desde **Equipo**, con su email o celular y una contraseña inicial.

Para crear otra barbería: solapa **Soy barbero** → **¿No creaste tu barbería? Creala**, o `POST /api/shops`.

## Arquitectura

```
Pantalla ──run(command)──▶ Zustand (aplica el cambio al instante)
                               │
                               ▼  POST /api/commands
                         Route Handler ──▶ applyCommand (valida reglas y permisos)
                               │              │
                               │              ▼
                               │         SQLite (transacción + escritura atómica)
                               ▼
                   estado confirmado ──▶ reemplaza el caché (o revierte si hubo error)
```

- **`src/lib/commands.ts`**: todas las altas, bajas y modificaciones como comandos puros (`appointment.book`, `service.upsert`, `client.delete`, `settings.hours`…). La misma función corre en el cliente (respuesta inmediata) y en el servidor (fuente de verdad).
- **Permisos**: el servidor decide según la sesión, con lista blanca por rol. Todo ocurre siempre dentro de la barbería de esa sesión.
  - **Cliente**: solo sus turnos y su perfil. Los horarios ocupados de otros le llegan anónimos.
  - **Barbero**: su agenda completa y sus cobros. Los turnos de otros sillones le llegan anónimos, y no toca catálogo, equipo ni configuración.
  - **Dueño**: todo.
  - **Sistema**: el webhook de la pasarela. Lo único que puede hacer es acreditar una seña.
- **Sesiones**: cookie `httpOnly` con token aleatorio (se guarda solo su hash) y contraseña con hash `scrypt`.
- **API**: `GET /api/state`, `POST /api/commands`, `POST /api/auth/{login,register,recover,password,logout}`, `GET|POST /api/auth/verificar`, `POST /api/memberships`, `GET|POST /api/shops`, `POST /api/payments/{checkout,webhook}`, `GET|POST /api/settings/payments`, `POST /api/staff/account`.

## Multi-barbería

Cada barbería es una isla. El aislamiento vive en la capa de datos, no en la UI:

- **Datos**: toda fila de dominio lleva `shop_id` y la clave primaria es `(shop_id, id)`. Dos locales pueden tener los mismos ids sembrados sin pisarse, y cada consulta filtra por barbería.
- **Quién decide la barbería**: sale de la sesión, nunca de la URL ni del cuerpo del pedido. El `Actor` la lleva siempre, así ninguna operación puede cruzarse de local por olvido.
- **Staff**: el dueño y cada barbero trabajan en **una sola** barbería (`users.shop_id`). Su email o celular no puede estar en otra: ni para crear una segunda barbería ni para darle acceso en otro local.
- **Clientes**: tienen **una sola cuenta** (email y contraseña) y se suman a las barberías que quieran (`memberships`). En cada una tienen su ficha, su historial y su crédito. La barbería activa va en la sesión (`sessions.shop_id`) y se cambia desde el encabezado; solo puede ser una de las suyas.
- **Visitantes sin sesión**: el link `/b/<slug>` deja la barbería en una cookie. Quien se registra desde ese link queda sumado a ese local; si no, al terminar elige en `/cliente/barberias`.
- **Plata y avisos**: las credenciales de Mercado Pago y de WhatsApp se guardan por barbería (`secrets.scope`), y el webhook sabe a cuál acreditarle porque la barbería viaja en su `notification_url` y se verifica contra el `external_reference` del pago.
- **Versión de estado**: cada barbería tiene la suya, así la sincronización de un local no despierta a los demás.
- **Barbería nueva**: arranca con el dueño como primer sillón y todo lo demás vacío, **catálogo incluido**: cada local carga sus servicios con sus precios. `demo.reset` solo existe para la barbería de demostración.
- **Credenciales cifradas**: lo que cada barbería carga en `secrets` se guarda con AES-256-GCM y la clave `SECRETS_KEY`, que vive en el entorno y nunca en la base. El valor cifrado queda atado a su barbería y a su nombre: copiarlo a otro local no sirve, porque no descifra.

| Ruta | Para qué |
|---|---|
| `/` | Ingreso: solapas **Soy cliente** (con registro) y **Soy barbero** (con alta de barbería). Con sesión, lleva a su pantalla |
| `/cliente/barberias` | Barberías del cliente: sumarse, dejarlas |
| `/b/<slug>` | **Link público del local.** Fija la barbería y abre su carta |
| `/local` | Carta pública: servicios, precios, equipo, horarios y política de seña, sin necesidad de cuenta |
| `/auth/nueva-barberia` | Alta de una barbería con su dueño |
| `/api/health` | Estado del servicio y métricas de storage, para el monitoreo del hosting |

El dueño encuentra su link en **Configuración → Negocio**, con botones para copiarlo y compartirlo. Es la única forma que tienen sus clientes de llegar a reservar, así que está arriba de todo.

Cada barbería publica **sus** datos: una barbería nueva arranca con la dirección y el WhatsApp que cargó en el alta, nunca con los de otra. El manifiesto de la PWA (`/manifest.webmanifest`) se arma por pedido, así que quien instala la app en el celular ve el nombre de su local.

## Mails

El SMTP es **uno solo para toda la instalación**, por variables de entorno. No va por barbería como Mercado Pago y WhatsApp: los mails de cuenta no son de ningún local en particular, porque la cuenta del cliente sirve para todos. En los mails de turnos el remitente lleva el nombre de la barbería y el "responder a" es su casilla, así el cliente le contesta al local.

| Mail | Cuándo sale | A quién |
|---|---|---|
| Bienvenida | Al crear la cuenta | Cliente |
| Confirmá tu email | Junto con la bienvenida, y cuando lo pide de nuevo desde su perfil | Cliente |
| `<Tu barbería> ya está publicada` | Al registrar una barbería | Dueño, si entró con un email |
| Código para recuperar la contraseña | Al pedir recuperarla | Cliente y staff |
| Turno reservado · Turno cancelado · Recordatorio | Con el comando correspondiente (`appointment.book`, `appointment.cancel`, `appointment.reminderSent`) | Cliente con cuenta |

- **Nada de esto es obligatorio.** Sin SMTP configurado la app funciona igual: no se manda el mail y queda un aviso en el log. Un servidor de correo caído no puede voltear un registro ni una reserva.
- **Confirmar el email** es un link de un solo uso que vence a las 48 horas. Se guarda solo su hash (`email_tokens`).
- El estado del SMTP se ve en `GET /api/health` (`mail: true|false`).
- Los mails van en HTML de una columna con estilos en línea, y `sendMail` deriva la versión en texto plano. Todo lo que viene de la base se escapa: un nombre con `<` no puede inyectar HTML.

## Códigos de verificación

La recuperación de la contraseña se verifica con un código de 6 dígitos. Si la cuenta entra con email y hay SMTP configurado, va por mail; si no, por **WhatsApp Cloud API** con la cuenta de una barbería: la del staff, o para un cliente la primera de las suyas que lo tenga configurado. Siempre al dato de la cuenta, nunca a uno escrito en el formulario.

- **Aleatorio** (`crypto.randomInt`) y **guardado hasheado**: en la base no queda el código.
- **Vence a los 10 minutos**, sirve **una sola vez** y está atado a la cuenta y al trámite.
- **5 intentos** y queda inutilizable. Agotarlos **no** permite pedir otro enseguida — si lo permitiera, el tope no serviría de nada.
- **1 minuto de espera** entre envíos al mismo número.
- Meta no deja mandar texto libre para esto, así que se usa una **plantilla de autenticación aprobada** con el código como único parámetro. El nombre y el idioma se configuran por barbería.
- **Sin mail ni WhatsApp configurados** no se pueden emitir códigos: el cliente tiene que pedirle al local que lo ayude a recuperar el acceso. No hay código fijo de reserva.

Para desarrollo y tests existe `OTP_DEBUG=1`, que devuelve el código en la respuesta en vez de enviarlo. Nunca en producción.

## Cobro de la seña

Cada barbería elige cuánta seña pide desde **Configuración → Señas**: 0% (sin seña), 30%, 50% o 100%. Cambiarla no afecta a los turnos ya reservados, que conservan la seña con la que se confirmaron.

La regla de fondo es una sola: **el navegador nunca decide si entró la plata.** El turno se crea siempre con la seña `pendiente` y solo el servidor la pasa a `abonada`.

| Medio | Qué pasa al reservar | Quién acredita |
|---|---|---|
| Mercado Pago | Turno `pendiente` que retiene el horario 15 min y redirige a Checkout Pro | El webhook, después de consultar el pago contra la API de Mercado Pago |
| Transferencia | Turno `pendiente` con el alias y el CBU a la vista | El staff, cuando la ve acreditada. El aviso del cliente la deja `en_revision`, que **no** es plata |
| Efectivo | Turno `pendiente` con vencimiento 4 h antes | El staff, al cobrarla en el mostrador |
| Crédito a favor | Turno `abonado` al instante | El servidor, que verifica y descuenta el crédito en la misma operación |
| Sin seña (0%) | Turno confirmado al instante | Nada que acreditar: se cobra todo en el sillón |

- **Reserva que vence**: una reserva digital retiene el horario `HOLD_MINUTES` (15). Si no se acredita, se libera sola — el barrido corre al principio de cada comando, sin cron.
- **Webhook**: valida la firma HMAC (`x-signature` + `x-request-id`), consulta el pago con el access token del local y aplica cada notificación una sola vez. Configuralo en Mercado Pago apuntando a `/api/payments/webhook`.
- **Sin credenciales cargadas** la app ofrece solo transferencia y efectivo.

## Ausencias y recordatorios

- **No vino**: se marca desde el turno una vez pasada la hora. La seña abonada queda para el local y **no** vuelve como crédito. Para perdonar la ausencia se cancela el turno, que sí lo devuelve.
- **Ausencias reiteradas**: con 2 ausencias, ese cliente deja de poder reservar con seña en efectivo y tiene que abonarla por adelantado. Es la política que figura en `/politicas`, aplicada por el servidor — no un texto suelto.
- **Recordatorios**: `/admin/recordatorios` arma la cola de las próximas 24 h (turnos confirmados, con seña resuelta y cliente que los pidió). Hoy se mandan con un toque por WhatsApp y se marcan enviados; la cola es una función pura sobre la agenda (`src/lib/reminders.ts`), lista para que un worker la consuma cuando esté la WhatsApp Cloud API.

## Reseñas

El rating de cada barbero **no se carga a mano**: sale de las reseñas reales de sus turnos.

- Solo el cliente califica, solo su propio turno, solo si está `completado` y una sola vez. Ni el dueño ni el barbero pueden calificarse.
- `rating` y `reviews` son campos derivados: se calculan al leer el estado y no se guardan en el JSON del barbero.
- Sin reseñas no se muestra ninguna estrella. Una barbería nueva arranca sin reputación inventada.

## ABM disponible

| Entidad | Alta | Modificación | Baja |
|---|---|---|---|
| Turnos | Reserva online / turno manual (crea la ficha si no existe) | Editar servicio, barbero, fecha, hora y nota; reprogramar; marcar ausente | Cancelar (seña → crédito) / eliminar cancelados |
| Servicios | ✓ | ✓ (precio, duración, visible, destacado) | ✓ con **Deshacer** |
| Productos | ✓ | ✓ (stock, precio, publicado) | ✓ con **Deshacer** |
| Clientes | ✓ | ✓ (datos, preferencias, nota interna) | ✓ con confirmación (borra su cuenta) |
| Barberos | ✓ | ✓ (sillón, activo, acceso a la app y contraseña) | ✓ con confirmación (se bloquea si tiene turnos próximos) |
| Bloqueos de agenda | ✓ | — | ✓ |
| Horarios y datos del negocio | — | ✓ | — |
| Seña del local (0/30/50/100%) | — | ✓ | — |
| Credenciales de Mercado Pago y WhatsApp, contraseña propia | — | ✓ | ✓ (campo vacío) |

## UX y animaciones

- **Una decisión por pantalla.** Reservar es un asistente de 3 pasos: al elegir el servicio se avanza solo, y el selector muestra únicamente los horarios libres.
- **Listas compactas.** El detalle está al tocar, crear se hace con un botón flotante, y borrar está al final del formulario de edición.
- **Hojas inferiores** que se cierran arrastrando, con Escape o con el botón atrás del teléfono. Los diálogos centrados quedan solo para acciones irreversibles.
- **Tiempos de animación de Material 3.** 150 ms al salir y 220 ms al entrar, con resortes en hojas e indicadores. Se respeta la opción del sistema de reducir movimiento.

## Reglas de negocio

- La seña la elige cada barbería (0, 30, 50 o 100% del servicio) en **Catálogo → Seña**. Con 0% no se pide seña y el turno queda confirmado al reservar.
- El cliente reserva por su cuenta hasta **2 semanas** adelante; el staff agenda sin tope. La regla la valida el servidor, no solo la pantalla.
- Cancelar o reprogramar sin cargo se permite hasta 3 h antes. Si la seña estaba abonada, queda como crédito a favor, que se puede usar como seña en la próxima reserva.
- Una seña `en_revision` todavía no entró: al cancelar no genera crédito.
- Si el cliente no se presenta, la seña abonada queda para el local.
- La seña en efectivo vence 4 h antes del turno, ajustada al horario del local.
- Los productos agregados a un turno descuentan stock y se suman al saldo del sillón.

## Operación

- **Health check**: `GET /api/health` devuelve estado, cantidad de barberías y métricas de storage. No expone datos de ningún local.
- **Backups**: `npm run backup` copia el archivo de la base con fecha y rota las últimas `BACKUP_KEEP` (14 por defecto). Pensado para un cron diario: `0 3 * * * cd /app && npm run backup`. La app escribe con temporal + rename, así que la copia siempre toma una versión consistente.
- **Avisos de errores**: todo error del servidor (una API que devuelve 500, un webhook de pago que falla, un mail que no sale, Mercado Pago o WhatsApp respondiendo mal) se loguea y, con `ALERT_WEBHOOK_URL`, llega a ese canal. El mismo error no se repite más de una vez cada 10 minutos. Nunca viajan datos de clientes: solo qué falló y dónde.
- **Chequeo de arranque**: en producción la app se niega a arrancar si falta `SECRETS_KEY` o si quedaron prendidos `OTP_DEBUG` o `SEED_DEMO`, y avisa en el log lo que falta pero no es grave (https, SMTP, alertas). Ver `src/server/config.ts`.
- **Baja de una barbería**: `node scripts/remove-shop.mjs <slug>` muestra qué se borraría; con `--yes` la borra entera (agenda, clientes, catálogo, staff, credenciales), dejando antes una copia de la base. Las cuentas de clientes que también se atienden en otra barbería se conservan.
- **Docker**: hay `Dockerfile` listo. La base va en el volumen `/data`; si `DATABASE_PATH` queda dentro del contenedor, cada deploy borra los turnos.

### El techo de storage, medido

Con `sql.js` cada comando reescribe **el archivo entero**. Medido sobre datos reales: **573 bytes por turno**, o sea unos 5 MB al año por barbería con 30 turnos diarios.

Las escrituras que caen juntas se juntan en una sola (`persist()` en `src/server/db.ts`), así que una ráfaga de N comandos cuesta dos escrituras y no N, y el guardado es asíncrono para no bloquear el event loop. Eso corre el techo, pero no lo elimina: el costo por escritura sigue creciendo con el total de datos.

**El número a vigilar es `storage.lastWriteMs` en `/api/health`.** Mientras esté en pocos milisegundos no hay problema; cuando empiece a subir (estimado entre 20 y 50 barberías activas), toca migrar. Las dos salidas reales:

1. **Postgres.** Es la que recomiendo: el modelo ya está particionado por `shop_id` y `supabase/schema.sql` sirve de guía. Además destraba correr en más de una instancia.
2. **SQLite nativo** (`better-sqlite3`), que escribe incremental en vez del archivo completo. Se probó y el binario precompilado **segfaultea** en Node 22 sobre Windows, así que quedaría atado a compilar en el server.

## Tests

```bash
npm run test:unit       # Vitest: reglas de negocio, horarios, precios, SQLite, permisos (≈1 s)
npm run test:e2e        # Playwright: compila la app y la prueba en un navegador mobile real
npm test                # ambos
npm run test:coverage   # cobertura de src/lib y src/server
npm run test:e2e:ui     # modo interactivo de Playwright
```

- **Unitarios** (`tests/unit`): seña del 50%, cálculo de saldos, disponibilidad de horarios y bloqueos, plazo de la seña en efectivo, todas las altas, bajas y modificaciones con sus validaciones, permisos por rol, crédito a favor, cobros, persistencia y transacciones en SQLite, hash de contraseñas y datos visibles por rol. Además: que el cliente no pueda acreditarse la seña, vencimiento de la reserva sin pagar, transferencia en revisión, ausencias y su efecto sobre reservas futuras, cola de recordatorios, códigos de verificación (unicidad, vencimiento, intentos, cooldown, hash), plantillas de los mails y el link de confirmación (un solo uso, vencimiento, sin SMTP no se manda nada), seña configurable por barbería, reseñas y aislamiento entre barberías (estado, ids repetidos, versiones, cuentas, credenciales). Además, la cuenta única de cliente en varias barberías, las migraciones de bases anteriores (incluida la unión de cuentas de cliente repetidas) y que en producción la base arranque vacía.
- **E2E** (`tests/e2e`): ingreso con solapas, bloqueo por intentos, registro y recuperación de contraseña; reserva con transferencia y su confirmación por el staff, seña en efectivo, reprogramación, cancelación con crédito y uso del crédito; tienda y perfil; agenda, turno manual, seña, productos, cobro y bloqueos; ABM de servicios, productos, clientes y barberos; cuentas de barbero y su aislamiento; ausencias y recordatorios; carga de credenciales de Mercado Pago; alta de barberías, un barbero en una sola barbería, cliente sumado a varias barberías y cambio entre ellas, link público, carta pública y aislamiento entre locales; el dueño copiando su link; reseñas del cliente reflejadas en la carta; códigos de un solo uso y bloqueo por intentos; sincronización entre dispositivos; seguridad de la API.
- **Accesibilidad y usabilidad**: auditoría WCAG 2.1 AA con axe en todas las pantallas y en los formularios; sin scroll horizontal en mobile; controles de al menos 40 px; botón atrás del teléfono y "reducir movimiento".
- Los E2E usan el Chrome instalado (`channel: "chrome"`) y una base descartable en `.test-data/`, sin tocar `data/`.

## Publicar en producción

**Guía paso a paso para un VPS (la que usamos en Hostinger): [`deploy/VPS.md`](deploy/VPS.md).** Usa `docker-compose.yml`: la app más Caddy, que saca y renueva solo el certificado HTTPS.

Lo que hay que resolver una vez, antes de que un local cobre de verdad:

1. **Hosting con disco persistente y una sola instancia.** La base es un archivo (`sql.js`), así que **no sirve Vercel ni ningún serverless**: cada deploy borraría los turnos. Sirve el `Dockerfile` con un volumen en `/data` (Railway, Fly.io, Render con disco, o un VPS). Una sola instancia: dos procesos escribiendo el mismo archivo se pisan.
2. **Variables de entorno** (en el panel del hosting, nunca en un archivo dentro de la imagen):
   - `SECRETS_KEY` — obligatoria. Guardala también fuera del servidor (un gestor de contraseñas): sin ella, las credenciales cargadas no se pueden leer y cada barbería tendría que volver a cargarlas.
   - `APP_URL` con `https://` y tu dominio.
   - `SMTP_*` y `MAIL_FROM`, con el dominio autorizado por SPF y DKIM (si no, los mails caen en spam).
   - `ALERT_WEBHOOK_URL`, para enterarte de los errores.
   - `DATABASE_PATH=/data/ds-studio.db` (ya viene así en el `Dockerfile`).
3. **Backups fuera del servidor.** `npm run backup` copia al mismo disco: si se pierde el servidor, se pierden con él. Programalo por cron y sincronizá `BACKUP_DIR` con un almacenamiento externo (S3, Backblaze, Google Drive).
4. **Cada barbería, en Configuración**: sus credenciales de Mercado Pago **con la clave secreta del webhook** (sin ella ninguna seña online se acredita) y, si recupera contraseñas por WhatsApp, las de WhatsApp Cloud API.
5. **Probar el arranque**: si la app no levanta, el log dice exactamente qué variable falta. `GET /api/health` tiene que responder `ok`.

## Pendiente para producción

1. **Migrar el storage cuando toque.** Ver *El techo de storage* más arriba: mirar `storage.lastWriteMs` en `/api/health` y migrar a Postgres antes de que empiece a subir.
2. **Monitoreo más fino.** Los errores ya avisan por `ALERT_WEBHOOK_URL`. Si más adelante se quiere agrupar errores, ver tendencias o trazas, Sentry se engancha en `src/instrumentation.ts` (`onRequestError`) y en `reportError` de `src/server/monitor.ts`.
3. **Recordatorios automáticos.** Hoy se mandan con un toque desde `/admin/recordatorios`. Para que salgan solos hacen falta un proceso que despierte (cron) y una plantilla de WhatsApp aprobada para recordatorios — la de autenticación no sirve para eso.
4. **Promociones.** El switch de "novedades" se quitó porque no había nada detrás. Si se quiere marketing a clientes, es una función nueva: segmentación, plantilla aprobada y control de frecuencia.
5. **Dominio por barbería.** Hoy cada local se comparte con `/b/<slug>`. Si en algún momento quieren `sunombre.tuapp.com`, alcanza con resolver la barbería desde el subdominio en lugar de la cookie: el resto del modelo no cambia.
