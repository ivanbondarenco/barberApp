export const OAUTH_COOKIE = "mp_oauth";

/** Resultado que la pantalla de Conexiones muestra al volver de Mercado Pago. */
export type OAuthOutcome = "conectado" | "cancelado" | "error" | "no-disponible";

export const settingsUrl = (base: string, outcome: OAuthOutcome) => `${base}/admin/configuracion?tab=integraciones&mp=${outcome}`;
