/*
 * Ayudante común de las plantillas.
 *
 * 1. Variante: ?tipo=x pone <body data-tipo="x">; cada plantilla muestra solo sus bloques .t-x.
 * 2. Textos por URL: cada elemento con data-p="clave" toma el valor de ?clave=... ("|" = salto de línea,
 *    *palabra* = color acento). Si el parámetro viene vacío, el elemento se quita.
 * 3. Listas: data-list="clave" arma un <li> por cada parte de ?clave=a|b|c (sin el parámetro, se quita).
 * 4. Íconos: data-icono dibuja ?icono= con el trazo de Lucide, como en la app. "perfil" pone el sello.
 * 5. Palabra por palabra: los elementos con data-words se parten en palabras que entran de a una,
 *    desde data-start (ms) cada data-step (ms).
 *
 * Todo se anima con CSS para que render.mjs pueda congelar cada cuadro y exportar el video exacto.
 */
(function () {
  const ICONOS = {
    agenda: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>',
    sena: '<rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20M6 15h4"/>',
    precio: '<path d="M12 2H2v10l9.29 9.29a1 1 0 0 0 1.41 0l8.59-8.59a1 1 0 0 0 0-1.41Z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    empezar: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
    ayuda: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
    clientes: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    tijera: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12"/>',
    campana: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    porcentaje: '<path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
    bolsa: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/>',
    escudo: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    reloj: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    celular: '<rect width="14" height="20" x="5" y="2" rx="2"/><path d="M12 18h.01"/>',
    mensaje: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    prohibido: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
    candado: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    recibo: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8M12 17.5v-11"/>',
    grafico: '<path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/>',
    estrella: '<path d="M11.5 2.3a.53.53 0 0 1 .95 0l2.31 4.68a2.12 2.12 0 0 0 1.6 1.16l5.16.76a.53.53 0 0 1 .3.9l-3.74 3.64a2.12 2.12 0 0 0-.61 1.88l.88 5.14a.53.53 0 0 1-.77.56l-4.62-2.43a2.12 2.12 0 0 0-1.97 0L6.4 21.01a.53.53 0 0 1-.77-.56l.88-5.14a2.12 2.12 0 0 0-.61-1.88L2.16 9.8a.53.53 0 0 1 .3-.9l5.16-.76a2.12 2.12 0 0 0 1.6-1.16z"/>',
    qr: '<rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3M21 21v.01M12 7v3a2 2 0 0 1-2 2H7M3 12h.01M12 3h.01M12 16v.01M16 12h1M21 12v.01M12 21v-1"/>',
  };

  const q = new URLSearchParams(location.search);

  if (q.get("tipo")) document.body.dataset.tipo = q.get("tipo");

  document.querySelectorAll("[data-p]").forEach((el) => {
    const v = q.get(el.dataset.p);
    if (v === null) return;
    if (v === "") { el.remove(); return; }
    let html = escapeHtml(v).replace(/\|/g, "<br>");
    // En los textos palabra por palabra el acento lo resuelve el paso 5.
    if (!("words" in el.dataset)) html = html.replace(/\*([^*]+)\*/g, '<span class="accent">$1</span>');
    el.innerHTML = html;
  });

  document.querySelectorAll("[data-list]").forEach((el) => {
    const v = q.get(el.dataset.list);
    if (!v) { el.remove(); return; }
    el.innerHTML = v.split("|").map((s) => `<li>${escapeHtml(s.trim())}</li>`).join("");
  });

  document.querySelectorAll("[data-icono]").forEach((el) => {
    const k = q.get("icono");
    if (!k || (k !== "perfil" && !ICONOS[k])) { el.remove(); return; }
    if (k === "perfil") {
      el.classList.add("is-seal");
      el.innerHTML = '<img src="../marca/logo-sello.svg" alt="">';
    } else {
      el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONOS[k]}</svg>`;
    }
  });

  document.querySelectorAll("[data-words]").forEach((el) => {
    let t = Number(el.dataset.start || 200);
    const step = Number(el.dataset.step || 140);
    const lines = el.innerHTML.split(/<br\s*\/?>/i);
    let inAccent = false; // el acento puede abarcar varias palabras: *la agenda se llena.*
    el.innerHTML = lines
      .map((line) =>
        line
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .map((w) => {
            const stars = (w.match(/\*/g) || []).length;
            const accent = inAccent || stars > 0;
            if (stars % 2 === 1) inAccent = !inAccent;
            const word = w.replace(/\*/g, "");
            const html = `<span class="rise${accent ? " accent" : ""}" style="display:inline-block;animation-delay:${t}ms">${word}</span>`;
            t += step;
            return html;
          })
          .join(" "),
      )
      .join("<br>");
  });

  function escapeHtml(s) {
    return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  }
})();
