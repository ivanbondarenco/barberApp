/**
 * Textos de las historias destacadas y de los posts de carrusel.
 * Editá acá y corré `node social-media/render.mjs historias` o `node social-media/render.mjs posts`.
 *
 * *palabra* = color acento · | = salto de línea (en items/chips separa elementos).
 * Íconos disponibles: agenda sena precio empezar ayuda clientes tijera campana link porcentaje bolsa
 * escudo reloj celular mensaje prohibido candado recibo grafico estrella qr perfil (el sello).
 */

const CTA = { tipo: "cta", titulo: "Probala *1 mes gratis*", sub: "Sin tarjeta. Tu barbería lista hoy.", flecha: "Tocá el enlace" };

/** Historias destacadas: una carpeta por destacado, una imagen por historia, en orden. */
export const HISTORIAS = {
  perfil: [
    { tipo: "tapa", icono: "perfil", etiqueta: "Qué es BarberApp", titulo: "Tu barbería. *Una sola agenda.*", sub: "La app de turnos para barberías y barberos." },
    { tipo: "punto", icono: "clientes", titulo: "Para quién es", texto: "Para el barbero que trabaja solo y para la barbería con equipo.", chips: "Barbero independiente|Barbería con equipo" },
    { tipo: "lista", etiqueta: "Todo en un lugar", titulo: "Lo que *hace*", items: "Turnos online con tu link|Señas con Mercado Pago|Agenda de todo el equipo|Avisos al celular|Tienda de productos|Finanzas, comisiones y sueldos" },
    { tipo: "punto", icono: "celular", titulo: "Desde el celular", texto: "Android, iPhone y compu. Se instala desde el navegador, sin pasar por ninguna tienda." },
    { tipo: "punto", icono: "mensaje", titulo: "Atendida por personas", texto: "Si tenés una duda, nos escribís por WhatsApp desde tu panel y te respondemos nosotros, no un bot." },
    CTA,
  ],

  agenda: [
    { tipo: "tapa", icono: "agenda", etiqueta: "Agenda", titulo: "Todos tus turnos, *en una pantalla.*", sub: "Del día y del mes, con el estado de cada seña." },
    { tipo: "punto", icono: "link", num: "01", titulo: "Reservan solos", texto: "Compartís tu link y tus clientes eligen barbero, servicio y horario, a cualquier hora.", chips: "Instagram|WhatsApp|QR en el local" },
    { tipo: "punto", icono: "clientes", num: "02", titulo: "Una agenda por barbero", texto: "Cada uno con sus horarios. Vos ves todo el local junto." },
    { tipo: "punto", icono: "reloj", num: "03", titulo: "Horarios a tu medida", texto: "Horarios cortados y bloqueos para cuando no atendés. Nadie reserva donde no querés." },
    { tipo: "punto", icono: "campana", num: "04", titulo: "Te avisa al toque", texto: "Notificación en el celular apenas entra un turno, para vos y para el barbero." },
    { tipo: "punto", icono: "clientes", num: "05", titulo: "Tus clientes a mano", texto: "Historial y datos de cada cliente, sin buscar en el WhatsApp." },
    CTA,
  ],

  sena: [
    { tipo: "tapa", icono: "sena", etiqueta: "Seña", titulo: "La seña, *directo a tu Mercado Pago.*", sub: "Menos turnos que no vienen." },
    { tipo: "punto", icono: "sena", num: "01", titulo: "Se cobra al reservar", texto: "El cliente la paga cuando saca el turno. Vos no perseguís transferencias." },
    { tipo: "punto", icono: "escudo", num: "02", titulo: "La plata es tuya", texto: "Cada barbería vincula su propia cuenta de Mercado Pago. BarberApp nunca toca esa plata." },
    { tipo: "punto", icono: "prohibido", num: "03", titulo: "El que falta, la pierde", texto: "Si no viene y no avisa, pierde la seña. Tu tiempo no se regala." },
    { tipo: "punto", icono: "candado", num: "04", titulo: "Dos ausencias, seña obligatoria", texto: "Después de dos ausencias, solo puede reservar pagando la seña por adelantado." },
    { tipo: "punto", icono: "porcentaje", num: "05", titulo: "Sin comisión", texto: "No te cobramos nada por seña ni por turno." },
    CTA,
  ],

  precio: [
    { tipo: "tapa", icono: "precio", etiqueta: "Precio", titulo: "¿Cuánto *sale?*", sub: "Sin letra chica." },
    { tipo: "punto", icono: "empezar", titulo: "$0 el primer mes", texto: "Sin tarjeta. Creás tu barbería con tu email y la usás en el momento." },
    { tipo: "punto", icono: "tijera", titulo: "Después, *lo que salen 2 cortes*", texto: "Si tu corte sale $10.000, pagás $20.000 por mes.", chips: "Transferencia|Mercado Pago|Efectivo" },
    { tipo: "lista", etiqueta: "Incluye", titulo: "Todo, *sin extras*", items: "Todo tu equipo de barberos|Señas con tu Mercado Pago|Agenda, clientes, tienda y finanzas|Comisiones y sueldos|Sin comisión por turno ni por seña" },
    CTA,
  ],

  empezar: [
    { tipo: "tapa", icono: "empezar", etiqueta: "Empezar", titulo: "Hoy la creás. *Hoy recibís turnos.*", sub: "Unos pasos y un par de minutos." },
    { tipo: "punto", icono: "tijera", num: "01", titulo: "Creá tu barbería", texto: "Nombre, dirección y WhatsApp. Con tu email, sin tarjeta." },
    { tipo: "punto", icono: "clientes", num: "02", titulo: "Cargá servicios y equipo", texto: "Precios, duración de cada servicio y los horarios de tus barberos." },
    { tipo: "punto", icono: "sena", num: "03", titulo: "Vinculá Mercado Pago", texto: "Si querés cobrar seña: autorizás tu cuenta en un toque y las señas entran ahí." },
    { tipo: "punto", icono: "qr", num: "04", titulo: "Compartí tu link", texto: "Y los turnos empiezan a llegar solos.", chips: "Bio de Instagram|WhatsApp|QR en el local" },
    CTA,
  ],

  clientes: [
    { tipo: "tapa", icono: "clientes", etiqueta: "Tus clientes", titulo: "Así reservan *tus clientes.*", sub: "Fácil para ellos, ordenado para vos." },
    { tipo: "punto", icono: "celular", num: "01", titulo: "Sin descargar nada", texto: "Reservan desde el navegador con tu link. Android, iPhone o compu.", chips: "Sin tiendas|Sin crear cuenta" },
    { tipo: "punto", icono: "agenda", num: "02", titulo: "Eligen todo solos", texto: "Barbero, servicio y horario, a cualquier hora. Aunque sean las 2 de la mañana." },
    { tipo: "punto", icono: "campana", num: "03", titulo: "No se olvidan", texto: "Les llegan avisos para que no se olviden del turno." },
    { tipo: "punto", icono: "bolsa", num: "04", titulo: "Suman productos", texto: "Agregan la cera o el shampoo a la reserva y lo retiran en el sillón." },
    { tipo: "punto", icono: "estrella", num: "05", titulo: "Califican el turno", texto: "Después del corte dejan su calificación. Sabés cómo les fue." },
    { tipo: "cta", titulo: "Dales *tu link*", sub: "Probala 1 mes gratis, sin tarjeta.", flecha: "Tocá el enlace" },
  ],

  ayuda: [
    { tipo: "tapa", icono: "ayuda", etiqueta: "Ayuda", titulo: "Preguntas *frecuentes.*", sub: "Y si no está acá, escribinos." },
    { tipo: "pregunta", pregunta: "¿Necesito tarjeta para la prueba?", respuesta: "No. Creás tu barbería con tu email y empezás a usarla en el momento." },
    { tipo: "pregunta", pregunta: "¿A quién le llega la plata de las señas?", respuesta: "A vos. Cada barbería vincula su propia cuenta de Mercado Pago y las señas entran directo ahí." },
    { tipo: "pregunta", pregunta: "¿Mis clientes tienen que descargar algo?", respuesta: "No. Reservan desde el navegador con tu link y, si quieren, la instalan en el celular sin pasar por ninguna tienda." },
    { tipo: "pregunta", pregunta: "¿Sirve si trabajo con varios barberos?", respuesta: "Sí. Cada barbero tiene su agenda y sus horarios, y vos ves todo el local junto." },
    { tipo: "pregunta", pregunta: "¿Cuánto cuesta después del mes de prueba?", respuesta: "Lo que salen 2 cortes de tu barbería por mes. Sin comisiones por turno ni por seña." },
    { tipo: "punto", icono: "mensaje", titulo: "Te responde una persona", texto: "Desde el menú de tu panel nos escribís por WhatsApp y te respondemos nosotros, no un bot." },
    { tipo: "cta", titulo: "¿Otra duda? *Escribinos.*", sub: "Respondemos por mensaje directo.", flecha: "Mandanos un mensaje" },
  ],
};

/** Posts de carrusel (4:5). Una carpeta por post, una imagen por diapositiva. */
export const POSTS = {
  "01-que-es": [
    { tipo: "tapa", etiqueta: "Para barberías", titulo: "Tu barbería. *Una sola agenda.*", sub: "Lo que hace BarberApp, en 4 deslizadas." },
    { tipo: "punto", icono: "link", num: "01", titulo: "Turnos online", texto: "Compartís un link y tus clientes eligen barbero, servicio y horario, a cualquier hora." },
    { tipo: "punto", icono: "sena", num: "02", titulo: "Seña con *Mercado Pago*", texto: "Se cobra al reservar y entra directo a tu cuenta. Menos turnos que no vienen." },
    { tipo: "punto", icono: "clientes", num: "03", titulo: "Todo tu equipo", texto: "Cada barbero con su agenda. Vos ves todo el local junto y les llega el aviso a los dos." },
    { tipo: "punto", icono: "porcentaje", num: "04", titulo: "Comisiones y sueldos", texto: "Porcentaje o monto fijo por servicio. Liquidás el período en un toque, con los adelantos descontados." },
    { tipo: "cta", titulo: "Probala *1 mes gratis*", sub: "Sin tarjeta. Sin comisión por turno ni por seña.", boton: "Link en la bio" },
  ],

  "02-senales": [
    { tipo: "tapa", etiqueta: "Hacé el test", titulo: "5 señales de que tu barbería *necesita turnos online*", sub: "¿Cuántas te pasan?" },
    { tipo: "punto", icono: "mensaje", num: "1", titulo: "Contestás turnos a las 11 de la noche", texto: "Si tu WhatsApp es tu agenda, nunca terminás de trabajar." },
    { tipo: "punto", icono: "prohibido", num: "2", titulo: "Te faltan clientes sin avisar", texto: "Y ese sillón vacío no lo recuperás." },
    { tipo: "punto", icono: "agenda", num: "3", titulo: "Se te pisan los turnos", texto: "Dos clientes, mismo horario, un solo barbero." },
    { tipo: "punto", icono: "recibo", num: "4", titulo: "Fin de mes con calculadora", texto: "Comisiones, adelantos y papelitos que nunca cierran." },
    { tipo: "punto", icono: "bolsa", num: "5", titulo: "Tus productos juntan polvo", texto: "Nadie los ofrece en el apuro del sábado." },
    { tipo: "cta", titulo: "¿Te pasan *2 o más?*", sub: "BarberApp resuelve las 5. Probala 1 mes gratis.", boton: "Link en la bio" },
  ],

  "03-precio": [
    { tipo: "tapa", etiqueta: "Precio", titulo: "¿Cuánto sale *BarberApp?*", sub: "Sin letra chica." },
    { tipo: "punto", icono: "empezar", titulo: "$0 el primer mes", texto: "Sin tarjeta. Creás tu barbería con tu email y la usás en el momento." },
    { tipo: "punto", icono: "tijera", titulo: "Después, *lo que salen 2 cortes*", texto: "Si tu corte sale $10.000, pagás $20.000 por mes.", chips: "Transferencia|Mercado Pago|Efectivo" },
    { tipo: "lista", etiqueta: "Incluye", titulo: "Todo, *sin extras*", items: "Todo tu equipo de barberos|Señas con tu Mercado Pago|Agenda, clientes, tienda y finanzas|Comisiones y sueldos" },
    { tipo: "punto", icono: "escudo", titulo: "Sin comisiones", texto: "Ni por turno ni por seña. La plata de las señas entra a tu Mercado Pago y es tuya." },
    { tipo: "cta", titulo: "Probala *1 mes gratis*", sub: "Sin tarjeta para empezar.", boton: "Link en la bio" },
  ],
};
