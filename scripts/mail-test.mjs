// Prueba el SMTP configurado mandando un mail de verdad.
// Uso: node scripts/mail-test.mjs alguien@ejemplo.com
import fs from "node:fs";
import path from "node:path";
import nodemailer from "nodemailer";

// Las variables viven en .env.local (Next las carga solo; un script suelto, no).
for (const file of [".env.local", ".env"]) {
  const full = path.join(import.meta.dirname, "..", file);
  if (!fs.existsSync(full)) continue;
  for (const line of fs.readFileSync(full, "utf8").split("\n")) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

const to = process.argv[2];
if (!to) {
  console.error("Uso: node scripts/mail-test.mjs tu@email.com");
  process.exit(1);
}
const { SMTP_HOST, SMTP_PORT = "587", SMTP_USER, SMTP_PASSWORD, SMTP_SECURE, MAIL_FROM } = process.env;
if (!SMTP_HOST || !(MAIL_FROM || SMTP_USER)) {
  console.error("Falta configurar SMTP_HOST y MAIL_FROM en .env.local");
  process.exit(1);
}

const transport = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT),
  secure: SMTP_SECURE ? SMTP_SECURE === "1" : Number(SMTP_PORT) === 465,
  auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASSWORD } : undefined,
});

console.log(`Conectando a ${SMTP_HOST}:${SMTP_PORT}…`);
await transport.verify();
const info = await transport.sendMail({
  from: MAIL_FROM || SMTP_USER,
  to,
  subject: "Prueba de envío",
  text: "Si estás leyendo esto, el SMTP de la app quedó bien configurado.",
});
console.log(`Enviado a ${to} (${info.messageId}). Revisá también la carpeta de spam.`);
