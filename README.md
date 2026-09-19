# D.S Studio Barbería · WebApp PWA (MVP)

App mobile-first para reservar turnos con **seña fija del 50%**, gestionar la agenda de los barberos, cobrar en el sillón y vender productos que se retiran durante el corte. Tiene backend propio con base SQLite, así que los datos se comparten entre todos los dispositivos.

## Stack

- **Next.js 16** (App Router, Route Handlers) + **React 19** + **TypeScript**
- **SQLite** vía `sql.js` (WebAssembly, sin compilación nativa), persistido en `data/ds-studio.db`
- **Tailwind CSS v4** con los tokens del design system *Atelier Urbane* (`src/app/globals.css`)
- **Motion** (`motion/react`, con LazyMotion) para hojas arrastrables, listas animadas y microinteracciones. **React `<ViewTransition>`** para las transiciones entre pantallas.
- **Zustand** como caché del cliente, con actualizaciones optimistas y sincronización con el servidor cada 10 s
- **React Hook Form + Zod**, **Lucide React**
- **PWA**: `public/manifest.json` y un service worker propio (la API nunca se cachea)

## Arranque

```bash
npm install
npm run dev                  # http://localhost:3000
npm run build && npm start   # producción
```

La base se crea y se siembra sola la primera vez. Para empezar de cero, borrá la carpeta `data/`, o usá **Configuración → Señas → Restablecer datos demo**.

| Variable | Uso |
|---|---|
| `DATABASE_PATH` | Ruta del archivo SQLite (por defecto `./data/ds-studio.db`) |
| `NEXT_PUBLIC_DEMO_MODE` | `0` oculta los accesos rápidos a las cuentas demo en el login |

### Cuentas demo

| Rol | Usuario | PIN |
|---|---|---|
| Cliente | `+54 9 11 5555 0192` | `1234` |
| Barbero / Admin | `admin@dsstudio.com.ar` | `1234` |
| Código WhatsApp (registro, recuperar PIN, acceso con código) | — | `123456` |

Después de 5 PIN incorrectos, ese usuario queda bloqueado 10 minutos.

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

- **`src/lib/commands.ts`**: todas las altas, bajas y modificaciones como comandos puros (`appointment.book`, `service.upsert`, `client.delete`, `cash.close`…). La misma función corre en el cliente (respuesta inmediata) y en el servidor (fuente de verdad).
- **Permisos**: el servidor decide según la sesión. El cliente solo opera sobre sus propios turnos y su perfil. Los horarios ocupados de otros clientes le llegan anónimos.
- **Sesiones**: cookie `httpOnly` con token aleatorio (se guarda solo su hash) y PIN con hash `scrypt`.
- **API**: `GET /api/state`, `POST /api/commands`, `POST /api/auth/{login,otp,register,recover,pin,logout}`.

## ABM disponible

| Entidad | Alta | Modificación | Baja |
|---|---|---|---|
| Turnos | Reserva online / turno manual (crea la ficha si no existe) | Editar servicio, barbero, fecha, hora y nota; reprogramar | Cancelar (seña → crédito) / eliminar cancelados |
| Servicios | ✓ | ✓ (precio, duración, visible, destacado) | ✓ con **Deshacer** |
| Productos | ✓ | ✓ (stock, precio, publicado) | ✓ con **Deshacer** |
| Clientes | ✓ | ✓ (datos, preferencias, nota interna) | ✓ con confirmación (borra su cuenta) |
| Barberos | ✓ | ✓ (sillón, activo) | ✓ con confirmación (se bloquea si tiene turnos próximos) |
| Bloqueos de agenda | ✓ | — | ✓ |
| Horarios, datos del negocio, caja | — | ✓ | — |

## UX y animaciones

- **Una decisión por pantalla.** Reservar es un asistente de 3 pasos: al elegir el servicio se avanza solo, y el selector muestra únicamente los horarios libres.
- **Listas compactas.** El detalle está al tocar, crear se hace con un botón flotante, y borrar está al final del formulario de edición.
- **Hojas inferiores** que se cierran arrastrando, con Escape o con el botón atrás del teléfono. Los diálogos centrados quedan solo para acciones irreversibles.
- **Tiempos de animación de Material 3.** 150 ms al salir y 220 ms al entrar, con resortes en hojas e indicadores. Se respeta la opción del sistema de reducir movimiento.

## Reglas de negocio

- La seña es siempre el 50% (`DEPOSIT_RATE` en `src/lib/pricing.ts`) y no se puede configurar.
- Cancelar o reprogramar sin cargo se permite hasta 3 h antes. Si la seña estaba abonada, queda como crédito a favor, que se puede usar como seña en la próxima reserva.
- La seña en efectivo vence 4 h antes del turno, ajustada al horario del local.
- Los productos agregados a un turno descuentan stock y se suman al saldo del sillón.
- Con la caja cerrada no se puede cobrar.

## Tests

```bash
npm run test:unit       # Vitest: reglas de negocio, horarios, precios, SQLite, permisos (≈1 s)
npm run test:e2e        # Playwright: compila la app y la prueba en un navegador mobile real
npm test                # ambos
npm run test:coverage   # cobertura de src/lib y src/server
npm run test:e2e:ui     # modo interactivo de Playwright
```

- **Unitarios** (`tests/unit`): seña del 50%, cálculo de saldos, disponibilidad de horarios y bloqueos, plazo de la seña en efectivo, todas las altas, bajas y modificaciones con sus validaciones, permisos por rol, crédito a favor, cobros y caja, persistencia y transacciones en SQLite, hash de PIN y datos visibles por rol.
- **E2E** (`tests/e2e`): ingreso, bloqueo por intentos, registro, código y recuperación de PIN; reserva online, en efectivo, rechazada, reprogramación, cancelación con crédito y uso del crédito; tienda y perfil; agenda, turno manual, seña, productos, cobro, bloqueos y cierre de caja; ABM de servicios, productos, clientes y barberos; sincronización entre dispositivos; seguridad de la API.
- **Accesibilidad y usabilidad**: auditoría WCAG 2.1 AA con axe en todas las pantallas y en los formularios; sin scroll horizontal en mobile; controles de al menos 40 px; botón atrás del teléfono y "reducir movimiento".
- Los E2E usan el Chrome instalado (`channel: "chrome"`) y una base descartable en `.test-data/`, sin tocar `data/`.

## Pendiente para producción

1. **Mercado Pago real.** Reemplazar `requestDepositPayment` (`src/lib/payments.ts`) por Checkout Pro más un webhook que ejecute `appointment.deposit` del lado del servidor. Hoy el cobro online es simulado.
2. **OTP real.** Enviar el código por WhatsApp Cloud API o Twilio. Hoy el código es fijo.
3. **Deploy.** Necesita disco persistente: VPS, Railway, Render o Fly con un volumen en `DATABASE_PATH`. Para escalar a varias instancias, migrar a Postgres; `supabase/schema.sql` sirve de guía.
4. **Cuentas de staff por barbero.** Hoy existe un único usuario admin.
