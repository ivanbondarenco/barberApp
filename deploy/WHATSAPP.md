# Avisos por WhatsApp con Evolution API

Guía para conectar **un solo número de WhatsApp de BarberApp** que avise de los cambios de turno a barberos y clientes de todos los locales.

Usa [Evolution API](https://github.com/EvolutionAPI/evolution-api), un servidor open source (Apache 2.0) que maneja un WhatsApp común como si fuera WhatsApp Web y expone una API REST. No tiene costo por mensaje.

> ⚠️ **No es la API oficial de Meta.** Va contra los términos de uso de WhatsApp y el número puede ser bloqueado. Usá un chip dedicado y seguí las [reglas para que no bloqueen el número](#6-reglas-para-que-no-bloqueen-el-número). Si se bloquea, los turnos siguen funcionando: los avisos son de "mejor esfuerzo", igual que el push y los mails.

## Qué mensajes se mandan

| Evento | Quién lo recibe | Texto |
|---|---|---|
| El cliente modifica el turno | Barbero del turno | *Tu cliente {nombre} modificó el turno a {día} {hora}* |
| El barbero modifica el turno | Cliente | *Tu barbero {nombre} modificó tu turno a {día} {hora}* |
| El barbero cancela el turno | Cliente | *Tu barbero {nombre} te canceló el turno del {día} {hora}* |

---

## 1. Antes de empezar

- [ ] **Un chip dedicado** con WhatsApp instalado en un celular. No puede ser tu WhatsApp personal ni el de soporte (`+54 9 11 3096-9716`).
- [ ] Ponele al perfil la foto de BarberApp, el nombre "BarberApp" y una descripción del tipo *"Avisos automáticos de turnos"*.
- [ ] Usalo unos días de forma normal antes de conectarlo: algunos chats, que lo agreguen como contacto. Un número recién creado que manda muchos mensajes es lo que más bloqueos genera.
- [ ] Acceso por SSH al VPS (ver [VPS.md](VPS.md)).

> El celular puede quedar apagado una vez vinculado (funciona como un "dispositivo vinculado"), pero **WhatsApp desvincula los dispositivos si el celular pasa ~14 días sin conectarse**. Prendelo y conectalo a internet de vez en cuando.

## 2. Agregar Evolution API al `docker-compose.yml`

Evolution API v2 necesita una base Postgres propia. Agregá estos dos servicios **debajo de `caddy`** y los volúmenes nuevos al final:

```yaml
  whatsapp:
    # Fijá una versión concreta (mirá la última estable en hub.docker.com/r/evoapicloud/evolution-api).
    # Nunca uses :latest: una actualización puede cambiar la API sin aviso.
    image: evoapicloud/evolution-api:v2.3.0
    restart: unless-stopped
    depends_on:
      - whatsapp-db
    env_file: .env.whatsapp
    volumes:
      - whatsapp-instances:/evolution/instances
    # Solo accesible desde el propio VPS (para el panel vía túnel SSH) y desde la app por la red interna.
    ports:
      - "127.0.0.1:8080:8080"
    logging:
      driver: json-file
      options: { max-size: "10m", max-file: "5" }

  whatsapp-db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: evolution
      POSTGRES_PASSWORD: ${WA_DB_PASSWORD}
      POSTGRES_DB: evolution
    volumes:
      - whatsapp-db:/var/lib/postgresql/data
    logging:
      driver: json-file
      options: { max-size: "10m", max-file: "5" }

volumes:
  barberapp-data:
  caddy-data:
  caddy-config:
  whatsapp-instances:   # sesión de WhatsApp: si se pierde, hay que volver a escanear el QR
  whatsapp-db:
```

> **No publiques el puerto 8080 a internet.** Con `127.0.0.1:8080:8080` solo se llega desde el VPS. La app llega por la red interna de Docker en `http://whatsapp:8080`.

## 3. Variables de entorno

### 3.1. Generar las claves

En el VPS:

```bash
openssl rand -hex 32   # → API key de Evolution
openssl rand -hex 24   # → contraseña de la base
```

### 3.2. Crear `.env.whatsapp` (al lado de `docker-compose.yml`)

```env
# URL con la que Evolution se nombra a sí mismo (interna)
SERVER_URL=http://whatsapp:8080

# Clave que la app manda en el header "apikey". Pegá la primera clave generada.
AUTHENTICATION_API_KEY=PEGAR_API_KEY

# Base de datos
DATABASE_ENABLED=true
DATABASE_PROVIDER=postgresql
DATABASE_CONNECTION_URI=postgresql://evolution:PEGAR_PASSWORD_DB@whatsapp-db:5432/evolution?schema=public
DATABASE_CONNECTION_CLIENT_NAME=barberapp

# Guardar solo lo mínimo: no necesitamos historial de chats ni contactos
DATABASE_SAVE_DATA_INSTANCE=true
DATABASE_SAVE_DATA_NEW_MESSAGE=false
DATABASE_SAVE_MESSAGE_UPDATE=false
DATABASE_SAVE_DATA_CONTACTS=false
DATABASE_SAVE_DATA_CHATS=false

# Sin Redis: caché en memoria alcanza para un solo número
CACHE_REDIS_ENABLED=false
CACHE_LOCAL_ENABLED=true

# Nombre que aparece en "Dispositivos vinculados" del celular
CONFIG_SESSION_PHONE_CLIENT=BarberApp
CONFIG_SESSION_PHONE_NAME=Chrome

LOG_LEVEL=ERROR,WARN
```

### 3.3. Agregar a `.env.production`

```env
# Contraseña de la base de Evolution (la misma de DATABASE_CONNECTION_URI)
WA_DB_PASSWORD=PEGAR_PASSWORD_DB

# Avisos de turnos por WhatsApp (Evolution API)
EVOLUTION_URL=http://whatsapp:8080
EVOLUTION_API_KEY=PEGAR_API_KEY
EVOLUTION_INSTANCE=barberapp
```

> `docker compose` lee `${WA_DB_PASSWORD}` del archivo `.env` de la carpeta, no de `env_file`. Si no la toma, copiala también a un `.env` en la misma carpeta, o escribila directo en `whatsapp-db`.

Agregá `.env.whatsapp` al `.gitignore` y al backup ([backup.sh](backup.sh)), igual que `.env.production`.

## 4. Levantar y vincular el número

### 4.1. Levantar los servicios

```bash
docker compose up -d whatsapp-db whatsapp
docker compose logs -f whatsapp     # esperar a que diga que el servidor arrancó; Ctrl+C para salir
```

### 4.2. Crear la instancia

En el VPS (reemplazá `TU_API_KEY`):

```bash
curl -X POST http://127.0.0.1:8080/instance/create \
  -H "apikey: TU_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"instanceName": "barberapp", "integration": "WHATSAPP-BAILEYS", "qrcode": true}'
```

### 4.3. Escanear el QR

La forma más cómoda es el **panel web** de Evolution, a través de un túnel SSH. Desde tu PC:

```bash
ssh -L 8080:127.0.0.1:8080 usuario@IP_DEL_VPS
```

Con el túnel abierto, entrá en el navegador a **http://localhost:8080/manager** y logueate con la API key. Abrí la instancia `barberapp` → **Get QR Code**.

En el celular del chip dedicado: **WhatsApp → Ajustes → Dispositivos vinculados → Vincular un dispositivo** y escaneá el QR. El QR vence en unos segundos; si vence, pedí otro.

> Sin panel: `curl http://127.0.0.1:8080/instance/connect/barberapp -H "apikey: TU_API_KEY"` devuelve el QR en base64. Pegalo en cualquier visor de "base64 to image".

### 4.4. Verificar la conexión

```bash
curl http://127.0.0.1:8080/instance/connectionState/barberapp -H "apikey: TU_API_KEY"
# → {"instance":{"instanceName":"barberapp","state":"open"}}
```

`"state": "open"` significa conectado.

### 4.5. Mandar un mensaje de prueba

A **tu** número, en formato internacional sin `+` ni espacios. Para celulares de Argentina: `549` + código de área sin 0 + número sin 15, por ejemplo `5491130969716`.

```bash
curl -X POST http://127.0.0.1:8080/message/sendText/barberapp \
  -H "apikey: TU_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"number": "549XXXXXXXXXX", "text": "Prueba de avisos de BarberApp ✂️"}'
```

Si te llega, la conexión está lista.

## 5. Conectarlo con la app (código a implementar)

Lo que falta programar en BarberApp:

1. **`src/server/wa-notify.ts`**: una función `notifyWhatsapp(phone, text)` que:
   - Si falta `EVOLUTION_URL`, no hace nada (igual que el push sin claves VAPID).
   - Normaliza el teléfono con `src/lib/phone.ts` / `onlyDigits`.
   - Hace `POST {EVOLUTION_URL}/message/sendText/{EVOLUTION_INSTANCE}` con header `apikey`.
   - **Nunca tira error hacia afuera**: si falla, lo registra con `reportError("whatsapp-notify", …)` y sigue.
   - Manda de a un mensaje con unos segundos entre cada uno (una cola simple en memoria alcanza).
2. **Enganche en los eventos de turnos**: los mismos que dispara [src/server/push.ts](../src/server/push.ts).
   - Si el cambio lo hizo el cliente, avisar al **barbero del turno**.
   - Si lo hizo el barbero o el dueño, avisar al **cliente**.
3. **Teléfonos**: el barbero necesita tener su teléfono cargado; el cliente ya lo tiene en su perfil.
4. **Opción por local** en Configuración para activar o desactivar los avisos por WhatsApp.
5. Agregar al final de cada mensaje: *"Mensaje automático de BarberApp. Respondé BAJA para no recibir más avisos."*, y respetar las bajas.

## 6. Reglas para que no bloqueen el número

- **Solo avisos de turnos**, a gente que reservó en un local. Nada de promociones ni envíos masivos.
- **Ritmo humano**: de 3 a 10 segundos entre mensajes, no cientos por minuto.
- **Mensajes cortos y personalizados** (con nombre, día y hora), no siempre el mismo texto idéntico.
- **Respetar las bajas**: si alguien responde BAJA, no le escribas más. Que muchos usuarios te reporten como spam es la causa número uno de bloqueos.
- **No mandar links acortados** (bit.ly y similares): suelen marcarse como spam.
- Si el número se bloquea: conseguir otro chip, repetir los pasos [1](#1-antes-de-empezar) y [4](#4-levantar-y-vincular-el-número), y bajar el ritmo de envío.

## 7. Mantenimiento

| Situación | Qué hacer |
|---|---|
| `connectionState` dice `close` o `connecting` | Abrí el panel por el túnel SSH y volvé a escanear el QR |
| El celular estuvo apagado más de ~14 días | WhatsApp desvinculó el dispositivo: volvé a escanear el QR |
| Reinicio del VPS | No hace falta nada: la sesión vive en el volumen `whatsapp-instances` |
| Actualizar Evolution | Cambiá la versión de la imagen, `docker compose up -d whatsapp`, y repetí la prueba del paso 4.5 |
| Ver errores | `docker compose logs --tail=100 whatsapp` |

> **Nunca borres el volumen `whatsapp-instances`** si no querés volver a escanear el QR. Tampoco es crítico: a diferencia de `barberapp-data`, perderlo solo obliga a revincular.

Conviene revisar `connectionState` una vez por día, por ejemplo con un cron que avise por mail si no está en `open`.
