/** Detección de la app instalada (PWA). Sin "use client": la usa también la landing del servidor. */

/**
 * ¿Corre como app instalada (PWA)? `display-mode` cubre Android y escritorio; iOS expone
 * `navigator.standalone`.
 */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.matchMedia?.("(display-mode: fullscreen)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Corre antes de pintar la landing: si es la app instalada, salta al ingreso sin mostrarla.
 * Hace falta porque iOS abre la app en la URL desde la que se instaló ("/"), sin mirar el
 * `start_url` del manifiesto. El ingreso ya manda a su pantalla a quien tiene sesión.
 */
export const STANDALONE_REDIRECT_SCRIPT = `(function(){try{var s=window.matchMedia&&(matchMedia("(display-mode: standalone)").matches||matchMedia("(display-mode: fullscreen)").matches)||navigator.standalone===true;if(s){document.documentElement.style.visibility="hidden";location.replace("/auth/login");}}catch(e){}})();`;
