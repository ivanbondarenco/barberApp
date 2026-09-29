# Publicar BarberApp en el VPS de Hostinger

Guía para el VPS **KVM 2** (`srv1360579.hstgr.cloud`, IP `187.77.37.11`). La app corre en Docker
con dos contenedores: la app y **Caddy**, que atiende tu dominio y saca y renueva solo el
certificado HTTPS. Todo lo que se hace en el servidor está en este repo:

| Archivo | Para qué |
|---|---|
| `docker-compose.yml` | Los dos contenedores y el volumen donde vive la base |
| `deploy/Caddyfile` | El dominio y el proxy HTTPS |
| `.env.production.example` | Plantilla de las variables (claves, dominio, mails) |
| `deploy/backup.sh` | Backup diario, dentro y fuera del VPS |
| `deploy/update.sh` | Publicar una versión nueva |

Los comandos van en el VPS, por SSH (`ssh root@187.77.37.11`), salvo que diga lo contrario.

---

## 0. Antes de empezar: qué hay hoy en el VPS

El VPS se creó con la plantilla **Ubuntu 24.04 with Easypanel**. Easypanel usa los puertos 80 y
443 para su propio proxy, y esta app los necesita para HTTPS: **no pueden convivir**, así que
Easypanel se saca en el paso 1.

El panel marca **84 % de memoria** y **40 GB de disco** usados, que es mucho para un servidor
recién creado. Antes de borrar nada, fijate qué está corriendo:

```bash
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
free -h
```

Si aparece algo tuyo además de Easypanel, resolvelo antes de seguir: el paso 1 lo borra.

## 1. Sacar Easypanel

**Opción recomendada: reinstalar el sistema limpio.** El servidor es nuevo y es lo más prolijo.

1. En hPanel → tu VPS → **Snapshots y backups** → creá un snapshot (por las dudas).
2. hPanel → tu VPS → **Sistema operativo** → cambiar a **Ubuntu 24.04** (la plantilla simple, sin
   panel). **Borra todo el disco.**
3. Te va a pedir una contraseña de root nueva.

**Alternativa: sacarlo sin reinstalar.** Easypanel corre como servicios de Docker Swarm:

```bash
docker service ls                 # identificá los de Easypanel (easypanel, traefik…)
docker service rm <servicio> ...  # borralos
docker swarm leave --force
rm -rf /etc/easypanel
```

Después, `ss -tlnp | grep -E ':80|:443|:3000'` no tiene que mostrar nada.

> Mientras Easypanel siga instalado, su panel está publicado en `http://187.77.37.11:3000`, sin
> HTTPS. Es otra razón para sacarlo pronto.

## 2. Seguridad básica del servidor

**Firewall** (hPanel → tu VPS → **Reglas del firewall**; hoy tenés 0 reglas). Creá un firewall
que acepte solo:

| Protocolo | Puerto | Para qué |
|---|---|---|
| TCP | 22 | SSH |
| TCP | 80 | HTTP (Caddy lo redirige a HTTPS y lo usa para sacar el certificado) |
| TCP | 443 | HTTPS |
| UDP | 443 | HTTP/3 (opcional) |

**Clave SSH en vez de contraseña.** En tu PC: `ssh-keygen -t ed25519` y cargá la clave pública
(`~/.ssh/id_ed25519.pub`) en hPanel → **Clave SSH → Administrar**.

**Actualizaciones automáticas de seguridad:**

```bash
apt update && apt upgrade -y
apt install -y unattended-upgrades
```

## 3. Apuntar el dominio

En el panel donde está tu dominio (en hPanel: **Dominios → DNS**), creá un registro:

| Tipo | Nombre | Apunta a |
|---|---|---|
| A | `turnos` (o `@` si es el dominio entero) | `187.77.37.11` |

Esperá a que responda (puede tardar de minutos a unas horas):

```bash
ping turnos.tudominio.com   # tiene que mostrar 187.77.37.11
```

**Sin esto Caddy no puede sacar el certificado.** Hacelo antes del paso 6.

## 4. Instalar Docker

Si reinstalaste con la plantilla simple de Ubuntu:

```bash
curl -fsSL https://get.docker.com | sh
docker compose version   # tiene que responder
```

## 5. Bajar el código

Primero, **en tu PC**, subí la rama:

```bash
git push -u origin preparar-produccion
```

En el VPS:

```bash
git clone https://github.com/ivanbondarenco/barberApp.git /opt/barberapp
cd /opt/barberapp
git checkout preparar-produccion   # o main, cuando la mergees
```

Si el repositorio es **privado**, GitHub va a pedir usuario y contraseña. Usá un token: GitHub →
Settings → Developer settings → **Fine-grained tokens**, solo para este repo, con permiso de
lectura de *Contents*. Ese token va como contraseña.

## 6. Configurar y levantar

```bash
cd /opt/barberapp
cp .env.production.example .env.production
openssl rand -base64 32          # copiá el resultado: es tu SECRETS_KEY
nano .env.production             # completá DOMAIN, APP_URL, SECRETS_KEY, mails…
chmod 600 .env.production        # que solo root lo pueda leer
```

> **Guardá la `SECRETS_KEY` también fuera del servidor** (un gestor de contraseñas). Si se
> pierde, cada barbería tiene que volver a cargar sus credenciales de Mercado Pago y WhatsApp.

Levantá todo (la primera vez compila, tarda unos minutos):

```bash
docker compose up -d --build
docker compose logs -f app       # Ctrl+C para salir
```

En los logs, las líneas `[config]` avisan lo que falta. Si falta algo **obligatorio** (por ejemplo
`SECRETS_KEY`), la app no arranca y el log dice exactamente qué. Corregí `.env.production` y
repetí `docker compose up -d`.

Abrí `https://turnos.tudominio.com`: tiene que aparecer el ingreso, con candado. Desde **Soy
barbero** creás tu barbería.

## 7. Mercado Pago (una vez por barbería)

1. En Mercado Pago → **Tus integraciones** → tu aplicación → **Webhooks**: URL
   `https://turnos.tudominio.com/api/payments/webhook`, evento **Pagos**. Guardá y copiá la
   **clave secreta**.
2. En la app → **Configuración → Pagos**: access token de producción y esa clave secreta.

Sin la clave secreta, el webhook rechaza todo y **ninguna seña online se acredita sola**.

## 8. Backups

La base está en el volumen de Docker. `deploy/backup.sh` hace tres copias: dentro del volumen,
en `/opt/barberapp/backups` y, si configurás rclone, **fuera del VPS**, que es la que importa: si
se pierde el servidor, las otras dos se pierden con él.

**Copia fuera del VPS con rclone** (por ejemplo, a Google Drive):

```bash
apt install -y rclone
rclone config            # creá un remote, por ejemplo "gdrive"
```

En `.env.production`: `RCLONE_REMOTE=gdrive:barberapp`. Probalo:

```bash
/opt/barberapp/deploy/backup.sh
```

**Programalo todos los días a las 3:00** (`crontab -e` y agregá la línea):

```
0 3 * * * /opt/barberapp/deploy/backup.sh >> /var/log/barberapp-backup.log 2>&1
```

Además, Hostinger guarda **snapshots del VPS entero** (hPanel → Snapshots y backups). Son un
buen complemento, pero no reemplazan el backup diario: son menos frecuentes y restaurarlos
vuelve atrás todo el servidor.

**Restaurar un backup:**

```bash
cd /opt/barberapp
docker compose exec -u root app sh -c 'ls /data/backups'
docker compose exec -u root app sh -c \
  'cp /data/backups/ds-studio-FECHA.db /data/ds-studio.db && chown node:node /data/ds-studio.db'
docker compose restart app
```

Para un backup que está fuera del volumen (en `backups/` o bajado de rclone), primero copialo
adentro: `docker compose cp backups/ds-studio-FECHA.db app:/data/backups/`.

## 9. Publicar una versión nueva

Subí los cambios a GitHub desde tu PC y en el VPS:

```bash
/opt/barberapp/deploy/update.sh
```

Hace un backup, baja el código, recompila, reinicia y espera a que la app responda. Si algo sale
mal, `git log` muestra las versiones: `git checkout <commit>` y volvé a correrlo.

---

## Comandos útiles

| Qué | Comando (en `/opt/barberapp`) |
|---|---|
| Ver si está todo arriba | `docker compose ps` |
| Logs de la app | `docker compose logs app --tail 100` |
| Logs del certificado | `docker compose logs caddy --tail 50` |
| Estado de la app | `curl -s https://turnos.tudominio.com/api/health` |
| Reiniciar la app | `docker compose restart app` |
| Uso de memoria de los contenedores | `docker stats --no-stream` |
| Dar de baja una barbería | `docker compose exec app node scripts/remove-shop.mjs <slug>` (con `--yes` la borra; después, `docker compose restart app`) |

## Si algo no anda

- **El navegador dice que el certificado no es válido o no carga**: el dominio no apunta todavía
  a `187.77.37.11` (paso 3), o el firewall no deja pasar el 80 y el 443 (paso 2). Mirá
  `docker compose logs caddy`.
- **La app se reinicia sola**: `docker compose logs app` muestra `[config]` con lo que falta en
  `.env.production`.
- **`docker compose up` dice que el puerto 80 o 443 está en uso**: Easypanel sigue instalado (paso 1).
- **No llegan los mails**: revisá `SMTP_*` y que `MAIL_FROM` sea una casilla de tu dominio. Los
  errores de envío aparecen en los logs y, si configuraste `ALERT_WEBHOOK_URL`, te llegan como aviso.
