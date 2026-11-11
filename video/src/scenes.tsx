import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import {
  Banknote,
  CalendarCheck,
  Check,
  Clock,
  Link2,
  Loader2,
  MessageCircle,
  MoonStar,
  Scissors,
  Sparkles,
  UserX,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { at } from "./timing";
import { C, lin, LogoMark, Phone, PHONE_W, sp, Sticker, Tap, useT } from "./ui";

const SHOP = "Barbería Don Tito";
const center: React.CSSProperties = { alignItems: "center" };
const phoneTop: React.CSSProperties = { position: "absolute", top: 210, left: (1080 - PHONE_W) / 2 };

/* ───────────── 1. Gancho: el WhatsApp explotado ───────────── */

const CHAT: [string, string, string][] = [
  ["Martín", "¿Tenés lugar hoy?", "#53bdeb"],
  ["Lucas", "Hola! mañana a las 18 puede ser?", "#ff8f6b"],
  ["Sofi", "¿Cuánto sale corte + barba?", "#c792ea"],
  ["Juan", "Llego 15 min tarde, perdón", "#ffd166"],
  ["Fede", "¿A las 20 atendés?", "#06d6a0"],
  ["Martín", "Hola???", "#53bdeb"],
  ["Nahuel", "Cambio el turno para el viernes", "#f78c6c"],
  ["Lucas", "Dale, confirmame", "#ff8f6b"],
  ["Tomi", "¿La seña cómo te la paso?", "#82aaff"],
  ["Sofi", "Holaaa", "#c792ea"],
  ["Juan", "Ya estoy afuera", "#ffd166"],
  ["Nahuel", "¿Me pasás el alias?", "#f78c6c"],
  ["Fede", "?", "#06d6a0"],
  ["Tomi", "Hola, ¿hay turno hoy?", "#82aaff"],
];

export const Hook: React.FC = () => {
  const t = useT();
  const msgAt = (i: number) => 0.15 + i * 0.21;
  const count = CHAT.filter((_, i) => t >= msgAt(i)).length;
  const shake = t > 1.8 ? Math.sin(t * 46) * 1.4 * lin(t, 1.8, 2.1) : 0;
  const badge = Math.round(interpolate(t, [0.15, 3.3], [1, 99], { extrapolateRight: "clamp" }));
  return (
    <AbsoluteFill>
      <div style={{ ...phoneTop, transform: `rotate(${shake}deg)` }}>
        <Phone bg="#0b141a" dark time="23:47">
          <div style={{ position: "absolute", top: 74, left: 0, right: 0, height: 110, background: "#1f2c34", display: "flex", alignItems: "center", gap: 18, padding: "0 30px" }}>
            <div style={{ width: 64, height: 64, borderRadius: 99, background: "#2a3942", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Users size={34} color="#aebac1" />
            </div>
            <div>
              <div style={{ color: "#e9edef", fontSize: 30, fontWeight: 700 }}>Clientes</div>
              <div style={{ color: "#8696a0", fontSize: 21 }}>escribiendo…</div>
            </div>
          </div>
          <div style={{ position: "absolute", top: 184, bottom: 30, left: 22, right: 22, display: "flex", flexDirection: "column", justifyContent: "flex-end", overflow: "hidden", gap: 12 }}>
            {CHAT.map(([name, text, color], i) => {
              const p = sp(t, msgAt(i), { damping: 16, stiffness: 260 });
              if (p <= 0) return null;
              return (
                <div key={i} style={{ maxHeight: p * 140, transform: `scale(${0.6 + p * 0.4})`, transformOrigin: "left bottom", opacity: p }}>
                  <div style={{ background: "#202c33", borderRadius: "6px 22px 22px 22px", padding: "12px 20px", maxWidth: 420, display: "inline-block" }}>
                    <div style={{ color, fontWeight: 700, fontSize: 21 }}>{name}</div>
                    <div style={{ color: "#e9edef", fontSize: 26 }}>{text}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Phone>
        <div
          style={{
            position: "absolute",
            top: -30,
            right: -40,
            minWidth: 120,
            height: 120,
            padding: "0 22px",
            borderRadius: 99,
            background: "#ef4444",
            color: "#fff",
            fontSize: 56,
            fontWeight: 800,
            display: count ? "flex" : "none",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 18px 40px rgba(239,68,68,.55)",
            transform: `scale(${1 + 0.12 * Math.max(0, Math.sin(t * 20))})`,
          }}
        >
          {badge >= 99 ? "99+" : badge}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ───────────── 2. El problema ───────────── */

const PROBLEMS = [
  { at: 3.74, icon: UserX, title: "No vino", sub: "Silla vacía y 45 minutos perdidos" },
  { at: 5.25, icon: MoonStar, title: "23:47 hs", sub: "«¿Mañana tenés lugar?»" },
  { at: 7.15, icon: Banknote, title: "Seña: pendiente", sub: "La prometieron… nunca llegó" },
];

export const Problems: React.FC = () => {
  const t = useT();
  return (
    <AbsoluteFill style={{ ...center, justifyContent: "center", gap: 44, paddingBottom: 380 }}>
      <div style={{ color: C.red, fontSize: 34, fontWeight: 800, letterSpacing: 8, opacity: lin(t, 3.6, 3.9) }}>EL PROBLEMA</div>
      {PROBLEMS.map((p, i) => {
        const s = sp(t, p.at, { damping: 13 });
        const next = PROBLEMS[i + 1];
        const dim = next ? 1 - 0.45 * lin(t, next.at, next.at + 0.3) : 1;
        const Icon = p.icon;
        return (
          <div
            key={i}
            style={{
              width: 900,
              padding: "36px 40px",
              borderRadius: 40,
              background: C.nightSoft,
              border: `2px solid ${C.nightLine}`,
              borderLeft: `10px solid ${C.red}`,
              display: "flex",
              alignItems: "center",
              gap: 34,
              opacity: Math.min(1, s * 1.5) * dim,
              transform: `translateX(${(1 - s) * 700}px) rotate(${(1 - s) * 8}deg)`,
              boxShadow: "0 30px 60px rgba(0,0,0,.35)",
            }}
          >
            <div style={{ width: 120, height: 120, borderRadius: 32, background: "rgba(255,107,107,.14)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon size={64} color={C.red} strokeWidth={2.2} />
            </div>
            <div>
              <div style={{ color: "#fff", fontSize: 60, fontWeight: 800, lineHeight: 1.1 }}>{p.title}</div>
              <div style={{ color: C.nightMuted, fontSize: 34, marginTop: 8 }}>{p.sub}</div>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/* ───────────── 3. Eso se terminó ───────────── */

export const Ending: React.FC = () => {
  const t = useT();
  const flash = 1 - lin(t, 9.05, 9.35);
  const logo = sp(t, 9.1, { damping: 12 });
  return (
    <AbsoluteFill style={{ ...center, justifyContent: "center", gap: 60, paddingBottom: 200 }}>
      <div style={{ transform: `scale(${logo}) rotate(${(1 - logo) * -20}deg)` }}>
        <LogoMark size={340} draw={lin(t, 9.15, 9.9)} />
      </div>
      <div style={{ textAlign: "center", color: "#fff", fontWeight: 800, fontSize: 150, lineHeight: 1, letterSpacing: -4 }}>
        <div style={{ opacity: lin(t, 9.17, 9.3), transform: `translateY(${(1 - sp(t, 9.17)) * 60}px)` }}>ESO SE</div>
        <div style={{ color: C.accent, opacity: lin(t, 9.65, 9.8), transform: `scale(${0.6 + 0.4 * sp(t, 9.65, { damping: 9 })})` }}>
          TERMINÓ.
        </div>
      </div>
      <AbsoluteFill style={{ background: "#fff", opacity: flash * 0.9 }} />
    </AbsoluteFill>
  );
};

/* ───────────── 4. Reserva desde el link ───────────── */

const DAYS = [
  ["Lun", "10"],
  ["Mar", "11"],
  ["Mié", "12"],
  ["Jue", "13"],
  ["Vie", "14"],
];
const SLOTS = ["9:00", "9:45", "10:30", "11:15", "12:00", "16:00", "16:45", "17:30", "18:15"];

export const Booking: React.FC = () => {
  const t = useT();
  const dayTap = at("dia", 15.5);
  const slotTap = at("horario", 15.5) + 0.25;
  const done = at("y", 17.2);
  const sheet = sp(t, done, { damping: 15 });
  const enter = sp(t, 10.65, { damping: 16 });
  return (
    <AbsoluteFill>
      <div style={{ ...phoneTop, transform: `translateY(${(1 - enter) * 500}px)` }}>
        <Phone>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 250, background: `linear-gradient(160deg, ${C.night}, #1a2550)`, padding: "100px 34px 0", display: "flex", gap: 20, alignItems: "center" }}>
            <div style={{ width: 92, height: 92, borderRadius: 26, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Scissors size={48} color={C.night} strokeWidth={2.4} />
            </div>
            <div>
              <div style={{ color: "#fff", fontSize: 32, fontWeight: 800 }}>{SHOP}</div>
              <div style={{ color: "#7ee2b8", fontSize: 22, fontWeight: 600, marginTop: 4 }}>● Abierto ahora</div>
            </div>
          </div>
          <div style={{ position: "absolute", top: 250, left: 0, right: 0, bottom: 0, padding: "28px 30px", color: C.ink }}>
            <Label>Servicio</Label>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderRadius: 22, background: C.primaryFixed, border: `2px solid ${C.primary}`, fontSize: 26, fontWeight: 700 }}>
              <span>Corte + barba</span>
              <span style={{ color: C.primary }}>$15.000</span>
            </div>
            <Label style={{ marginTop: 30 }}>Elegí el día</Label>
            <div style={{ display: "flex", gap: 10 }}>
              {DAYS.map(([d, n], i) => {
                const sel = i === 3 && t >= dayTap;
                return (
                  <div key={d} style={{ position: "relative", flex: 1, height: 112, borderRadius: 22, background: sel ? C.primary : "#fff", border: `2px solid ${sel ? C.primary : C.surfaceContainer}`, color: sel ? "#fff" : C.ink, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", transform: `scale(${sel ? 1 + 0.08 * (1 - lin(t, dayTap, dayTap + 0.3)) : 1})` }}>
                    <span style={{ fontSize: 20, fontWeight: 600, opacity: 0.75 }}>{d}</span>
                    <span style={{ fontSize: 36, fontWeight: 800 }}>{n}</span>
                    {i === 3 && <Tap t={t} at={dayTap} />}
                  </div>
                );
              })}
            </div>
            <Label style={{ marginTop: 30, opacity: lin(t, dayTap + 0.1, dayTap + 0.3) }}>Horarios disponibles</Label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {SLOTS.map((s, i) => {
                const p = sp(t, dayTap + 0.15 + i * 0.04, { damping: 15, stiffness: 240 });
                const sel = s === "10:30" && t >= slotTap;
                return (
                  <div key={s} style={{ position: "relative", height: 74, borderRadius: 18, background: sel ? C.primary : C.surfaceLow, color: sel ? "#fff" : C.ink, fontSize: 27, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", opacity: p, transform: `scale(${0.7 + 0.3 * p})` }}>
                    {s}
                    {s === "10:30" && <Tap t={t} at={slotTap} />}
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 330, background: "#fff", borderRadius: "40px 40px 0 0", boxShadow: "0 -20px 50px rgba(16,28,54,.22)", transform: `translateY(${(1 - sheet) * 360}px)`, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 36 }}>
            <div style={{ width: 104, height: 104, borderRadius: 99, background: C.mint, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${sp(t, done + 0.1, { damping: 9 })})` }}>
              <Check size={60} color={C.mintInk} strokeWidth={3.4} />
            </div>
            <div style={{ fontSize: 36, fontWeight: 800, color: C.ink, marginTop: 18 }}>¡Turno reservado!</div>
            <div style={{ fontSize: 24, color: C.muted, marginTop: 6 }}>Jue 13 · 10:30 hs · con Nico</div>
          </div>
        </Phone>
      </div>
      <Sticker t={t} at={11.0} rotate={-7} style={{ top: 120, left: 70, background: C.accent }}>
        <Link2 size={42} strokeWidth={2.8} /> mibarberia.live/dontito
      </Sticker>
      <Sticker t={t} at={at("solos", 11)} until={dayTap - 0.3} rotate={6} style={{ top: 560, right: 40 }}>
        <Zap size={40} color={C.primary} fill={C.primary} /> Reservan solos
      </Sticker>
      <Sticker t={t} at={at("cuenta", 13) - 0.6} until={dayTap - 0.3} rotate={-5} style={{ top: 860, left: 40 }}>
        <Check size={40} color={C.mintInk} strokeWidth={3.4} /> Sin crear cuenta
      </Sticker>
    </AbsoluteFill>
  );
};

const Label: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ fontSize: 22, fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: 2, marginBottom: 14, ...style }}>{children}</div>
);

/* ───────────── 5. Seña con Mercado Pago ───────────── */

export const Deposit: React.FC = () => {
  const t = useT();
  const tap = at("mercado", 18) + 0.1;
  const ok = 19.72;
  const loading = t >= tap + 0.15 && t < ok;
  const okP = sp(t, ok, { damping: 11 });
  return (
    <AbsoluteFill>
      <div style={phoneTop}>
        <Phone>
          <div style={{ position: "absolute", inset: 0, padding: "120px 34px 0", color: C.ink }}>
            <div style={{ fontSize: 40, fontWeight: 800 }}>Confirmá tu turno</div>
            <div style={{ fontSize: 24, color: C.muted, marginTop: 6 }}>{SHOP}</div>
            <div style={{ marginTop: 34, borderRadius: 30, background: "#fff", border: `2px solid ${C.surfaceContainer}`, padding: "16px 28px", boxShadow: "0 12px 30px rgba(16,28,54,.08)" }}>
              {[
                ["Servicio", "Corte + barba"],
                ["Día", "Jue 13 · 10:30 hs"],
                ["Barbero", "Nico"],
                ["Total", "$15.000"],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "18px 0", borderBottom: `2px solid ${C.surfaceLow}`, fontSize: 26 }}>
                  <span style={{ color: C.muted }}>{k}</span>
                  <span style={{ fontWeight: 700 }}>{v}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "22px 0 12px", fontSize: 32, fontWeight: 800 }}>
                <span>Seña</span>
                <span style={{ color: C.primary }}>$5.000</span>
              </div>
            </div>
            <div style={{ position: "relative", marginTop: 40, height: 96, borderRadius: 24, background: C.mp, color: "#fff", fontSize: 28, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 14, transform: `scale(${t >= tap && t < tap + 0.15 ? 0.95 : 1})`, boxShadow: "0 16px 30px rgba(0,158,227,.35)" }}>
              {loading ? (
                <Loader2 size={40} style={{ transform: `rotate(${t * 720}deg)` }} />
              ) : (
                <>
                  <Wallet size={34} /> Pagar seña con Mercado Pago
                </>
              )}
              <Tap t={t} at={tap} color="rgba(255,255,255,.45)" />
            </div>
          </div>
          <AbsoluteFill style={{ background: "rgba(248,249,255,.97)", opacity: Math.min(1, okP * 1.4), display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
            <Confetti t={t} at={ok} />
            <div style={{ width: 200, height: 200, borderRadius: 999, background: C.green, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${okP})`, boxShadow: "0 20px 50px rgba(34,197,94,.45)" }}>
              <Check size={120} color="#fff" strokeWidth={3.4} />
            </div>
            <div style={{ fontSize: 44, fontWeight: 800, color: C.ink, marginTop: 40 }}>¡Turno asegurado!</div>
            <div style={{ fontSize: 26, color: C.muted, marginTop: 10 }}>Seña acreditada · $5.000</div>
          </AbsoluteFill>
        </Phone>
      </div>
    </AbsoluteFill>
  );
};

const Confetti: React.FC<{ t: number; at: number }> = ({ t, at: start }) => {
  if (t < start) return null;
  const k = lin(t, start, start + 1.1);
  const colors = [C.accent, C.green, C.amber, C.mp, "#ff8fab"];
  return (
    <>
      {Array.from({ length: 26 }).map((_, i) => {
        const a = (i / 26) * Math.PI * 2 + i;
        const r = 120 + (i % 5) * 45;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: "50%",
              top: "42%",
              width: 16,
              height: 26,
              borderRadius: 4,
              background: colors[i % colors.length],
              opacity: 1 - lin(t, start + 0.7, start + 1.2),
              transform: `translate(${Math.cos(a) * r * k}px, ${Math.sin(a) * r * k + k * k * 160}px) rotate(${i * 40 + k * 300}deg)`,
            }}
          />
        );
      })}
    </>
  );
};

/* ───────────── 6. Recordatorio por WhatsApp ───────────── */

export const Reminder: React.FC = () => {
  const t = useT();
  const notif = sp(t, 22.2, { damping: 15 });
  const stats = 25.6;
  const dim = lin(t, stats - 0.2, stats + 0.2);
  const missed = Math.round(interpolate(t, [stats + 0.1, stats + 0.8], [8, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const occ = interpolate(t, [26.61, 27.4], [62, 94], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      <div style={{ ...phoneTop, transform: `scale(${1 - dim * 0.06})`, filter: `brightness(${1 - dim * 0.55})` }}>
        <Phone bg="linear-gradient(170deg,#1a2a6c 0%, #2b1a55 55%, #0a1020 100%)" dark time="20:00">
          <div style={{ position: "absolute", top: 150, left: 0, right: 0, textAlign: "center", color: "#fff" }}>
            <div style={{ fontSize: 26, fontWeight: 600, opacity: 0.85 }}>miércoles 12 de noviembre</div>
            <div style={{ fontSize: 150, fontWeight: 300, letterSpacing: -4, lineHeight: 1.05 }}>20:00</div>
          </div>
          <div style={{ position: "absolute", top: 420, left: 22, right: 22, borderRadius: 34, background: "rgba(255,255,255,.2)", backdropFilter: "blur(20px)", padding: "22px 24px", color: "#fff", transform: `translateY(${(1 - notif) * -380}px)`, opacity: Math.min(1, notif * 1.5) }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 50, height: 50, borderRadius: 14, background: C.wa, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <MessageCircle size={32} color="#fff" fill="#fff" />
              </div>
              <div style={{ flex: 1, fontSize: 22, fontWeight: 700, opacity: 0.9 }}>WhatsApp</div>
              <div style={{ fontSize: 20, opacity: 0.7 }}>ahora</div>
            </div>
            <div style={{ fontSize: 25, fontWeight: 800, marginTop: 14 }}>{SHOP}</div>
            <div style={{ fontSize: 24, lineHeight: 1.35, marginTop: 4, opacity: 0.95 }}>
              Hola Juan! Te recordamos que mañana tenés turno a las 10:30 hs en {SHOP} con Nico (Corte + barba).
            </div>
          </div>
        </Phone>
      </div>
      <Sticker t={t} at={at("automatico", 22) - 0.1} rotate={5} style={{ top: 160, right: 60, background: C.wa, color: "#fff" }}>
        <Clock size={40} strokeWidth={2.8} /> Automático
      </Sticker>
      <div style={{ position: "absolute", top: 520, left: 90, right: 90, display: "flex", flexDirection: "column", gap: 40 }}>
        <StatCard t={t} at={stats}>
          <div style={{ fontSize: 34, color: C.nightMuted, fontWeight: 700 }}>Faltazos por mes</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 24, marginTop: 6 }}>
            <span style={{ fontSize: 150, fontWeight: 800, color: missed > 3 ? C.red : C.green, lineHeight: 1 }}>{missed}</span>
            <span style={{ fontSize: 40, color: C.green, fontWeight: 800 }}>{t > stats + 0.8 ? "−87%" : ""}</span>
          </div>
        </StatCard>
        <StatCard t={t} at={26.61}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 34, color: C.nightMuted, fontWeight: 700 }}>
            <span>Sillas ocupadas</span>
            <span style={{ color: "#fff", fontSize: 52, fontWeight: 800 }}>{Math.round(occ)}%</span>
          </div>
          <div style={{ marginTop: 22, height: 34, borderRadius: 99, background: C.nightLine, overflow: "hidden" }}>
            <div style={{ width: `${occ}%`, height: "100%", borderRadius: 99, background: `linear-gradient(90deg, ${C.primaryBright}, ${C.accent})` }} />
          </div>
        </StatCard>
      </div>
    </AbsoluteFill>
  );
};

const StatCard: React.FC<{ t: number; at: number; children: React.ReactNode }> = ({ t, at: start, children }) => {
  const p = sp(t, start, { damping: 13 });
  return (
    <div style={{ borderRadius: 40, padding: "34px 44px", background: "rgba(18,26,46,.92)", border: `2px solid ${C.nightLine}`, boxShadow: "0 30px 70px rgba(0,0,0,.5)", opacity: Math.min(1, p * 1.5), transform: `translateY(${(1 - p) * 120}px) scale(${0.9 + 0.1 * p})` }}>
      {children}
    </div>
  );
};

/* ───────────── 7. Panel: equipo, horarios, sueldos y redes ───────────── */

export const Admin: React.FC = () => {
  const t = useT();
  const story = at("contenido", 32.5) - 0.35;
  const away = lin(t, story - 0.1, story + 0.4);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", top: 150, width: "100%", textAlign: "center", color: C.accent, fontSize: 34, fontWeight: 800, letterSpacing: 8, opacity: lin(t, 28.2, 28.5) }}>
        TODO EN UN SOLO LUGAR
      </div>
      <div style={{ position: "absolute", top: 300, left: 90, right: 90, display: "flex", flexDirection: "column", gap: 40, transform: `scale(${1 - away * 0.12})`, opacity: 1 - away * 0.75, filter: `blur(${away * 4}px)` }}>
        <PanelCard t={t} at={28.3} title="Equipo" icon={<Users size={34} color={C.accent} />}>
          <div style={{ display: "flex", gap: 20 }}>
            {[
              ["N", "Nico", "Dueño"],
              ["L", "Lucas", "Barbero"],
              ["M", "Mati", "Barbero"],
            ].map(([i, n, r]) => (
              <div key={n} style={{ flex: 1, display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 66, height: 66, borderRadius: 99, background: C.primary, color: "#fff", fontSize: 30, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{i}</div>
                <div>
                  <div style={{ color: "#fff", fontSize: 28, fontWeight: 700 }}>{n}</div>
                  <div style={{ color: C.nightMuted, fontSize: 21 }}>{r}</div>
                </div>
              </div>
            ))}
          </div>
        </PanelCard>
        <PanelCard t={t} at={at("horarios", 29) - 0.6} title="Horarios" icon={<Clock size={34} color={C.accent} />}>
          {["Lun a Vie", "Sábado"].map((d, row) => (
            <div key={d} style={{ display: "flex", alignItems: "center", gap: 18, marginTop: row ? 14 : 0 }}>
              <span style={{ width: 150, color: C.nightMuted, fontSize: 24 }}>{d}</span>
              <div style={{ position: "relative", flex: 1, height: 44, borderRadius: 12, background: C.nightLine }}>
                {(row ? [[0, 0.55, "9 – 15"]] : [[0, 0.38, "9 – 13"], [0.55, 1, "16 – 20"]]).map(([a, b, label]) => (
                  <div key={String(label)} style={{ position: "absolute", top: 0, bottom: 0, left: `${Number(a) * 100}%`, width: `${(Number(b) - Number(a)) * 100 * lin(t, at("horarios", 29), at("horarios", 29) + 0.5)}%`, borderRadius: 12, background: C.primaryBright, color: "#fff", fontSize: 21, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", whiteSpace: "nowrap" }}>
                    {label} hs
                  </div>
                ))}
              </div>
            </div>
          ))}
        </PanelCard>
        <PanelCard t={t} at={at("sueldos", 29) - 0.5} title="Sueldos" icon={<Wallet size={34} color={C.accent} />}>
          {[
            ["Lucas", "50% comisión", 412000],
            ["Mati", "50% comisión", 365500],
          ].map(([n, c, v], i) => {
            const val = Math.round(Number(v) * lin(t, at("sueldos", 29), at("sueldos", 29) + 0.8));
            return (
              <div key={String(n)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: i ? 14 : 0 }}>
                <span style={{ color: "#fff", fontSize: 28, fontWeight: 700 }}>
                  {n} <span style={{ color: C.nightMuted, fontSize: 22, fontWeight: 500 }}>· {c}</span>
                </span>
                <span style={{ color: C.green, fontSize: 32, fontWeight: 800 }}>${val.toLocaleString("es-AR")}</span>
              </div>
            );
          })}
        </PanelCard>
      </div>
      <StoryCard t={t} at={story} />
    </AbsoluteFill>
  );
};

const PanelCard: React.FC<{ t: number; at: number; title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ t, at: start, title, icon, children }) => {
  const p = sp(t, start, { damping: 14 });
  return (
    <div style={{ borderRadius: 36, padding: "30px 36px", background: C.nightSoft, border: `2px solid ${C.nightLine}`, boxShadow: "0 24px 60px rgba(0,0,0,.4)", opacity: Math.min(1, p * 1.5), transform: `translateY(${(1 - p) * 140}px)` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
        {icon}
        <span style={{ color: "#fff", fontSize: 34, fontWeight: 800 }}>{title}</span>
      </div>
      {children}
    </div>
  );
};

const StoryCard: React.FC<{ t: number; at: number }> = ({ t, at: start }) => {
  const p = sp(t, start, { damping: 13 });
  if (p <= 0) return null;
  return (
    <div style={{ position: "absolute", top: 290, right: 110, width: 520, height: 924, borderRadius: 44, background: `linear-gradient(170deg, #13204a, ${C.night})`, border: `3px solid ${C.accent}`, boxShadow: "0 50px 100px rgba(0,0,0,.6), 0 0 80px rgba(143,174,255,.25)", transform: `translateX(${(1 - p) * 700}px) rotate(${4 - (1 - p) * 20}deg)`, display: "flex", flexDirection: "column", alignItems: "center", padding: "70px 40px", color: "#fff", textAlign: "center" }}>
      <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: 6, color: C.accent }}>TURNOS DISPONIBLES</div>
      <div style={{ fontSize: 46, fontWeight: 800, marginTop: 24, lineHeight: 1.1 }}>{SHOP}</div>
      <div style={{ fontSize: 28, color: C.nightMuted, marginTop: 14 }}>Hoy · jueves 13</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 50, width: "100%" }}>
        {["16:00", "16:45", "17:30", "18:15"].map((s, i) => (
          <div key={s} style={{ height: 84, borderRadius: 20, background: "rgba(143,174,255,.14)", border: `2px solid rgba(143,174,255,.4)`, fontSize: 34, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", opacity: lin(t, start + 0.3 + i * 0.1, start + 0.5 + i * 0.1) }}>
            {s}
          </div>
        ))}
      </div>
      <div style={{ marginTop: "auto", fontSize: 24, color: C.nightMuted }}>Reservá en mibarberia.live</div>
      <div style={{ position: "absolute", top: -40, left: -50, padding: "16px 26px", borderRadius: 24, background: C.amber, color: C.night, fontSize: 30, fontWeight: 800, display: "flex", gap: 10, alignItems: "center", transform: `rotate(-8deg) scale(${sp(t, start + 0.35, { damping: 10 })})`, boxShadow: "0 16px 40px rgba(0,0,0,.4)" }}>
        <Sparkles size={32} /> Listo para tus redes
      </div>
    </div>
  );
};

/* ───────────── 8. Vos dedicate a cortar ───────────── */

export const Cut: React.FC = () => {
  const t = useT();
  const b = 36.25;
  const outA = lin(t, b - 0.1, b + 0.25);
  const inB = sp(t, b, { damping: 14 });
  return (
    <AbsoluteFill style={{ ...center, justifyContent: "center", paddingBottom: 200 }}>
      <div style={{ position: "absolute", display: "flex", flexDirection: "column", alignItems: "center", opacity: 1 - outA, transform: `translateY(${-outA * 300}px)` }}>
        <div style={{ transform: `scale(${sp(t, 34.75, { damping: 9 })}) rotate(${Math.sin(t * 14) * 14}deg)` }}>
          <Scissors size={300} color={C.accent} strokeWidth={1.8} />
        </div>
        <div style={{ color: "#fff", fontWeight: 800, fontSize: 132, lineHeight: 1, textAlign: "center", marginTop: 50, letterSpacing: -3 }}>
          <div style={{ opacity: lin(t, 34.77, 34.9) }}>VOS,</div>
          <div style={{ opacity: lin(t, 35.1, 35.25) }}>DEDICATE</div>
          <div style={{ color: C.accent, transform: `scale(${0.6 + 0.4 * sp(t, 35.55, { damping: 9 })})`, opacity: lin(t, 35.55, 35.65) }}>A CORTAR.</div>
        </div>
      </div>
      <div style={{ position: "absolute", display: "flex", flexDirection: "column", alignItems: "center", opacity: Math.min(1, inB * 1.5), transform: `translateY(${(1 - inB) * 300}px)` }}>
        <CalendarCheck size={260} color={C.green} strokeWidth={1.8} />
        <div style={{ color: "#fff", fontWeight: 800, fontSize: 112, lineHeight: 1.02, textAlign: "center", marginTop: 50, letterSpacing: -3 }}>
          <div>DE LA AGENDA,</div>
          <div style={{ opacity: lin(t, 37.0, 37.15) }}>NOS ENCARGAMOS</div>
          <div style={{ color: C.green, opacity: lin(t, 37.6, 37.7), transform: `scale(${0.6 + 0.4 * sp(t, 37.6, { damping: 9 })})` }}>NOSOTROS.</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ───────────── 9. Cierre ───────────── */

export const CTA: React.FC = () => {
  const t = useT();
  const url = "mibarberia.live";
  const typed = url.slice(0, Math.round(lin(t, 39.5, 40.4, 0, url.length, (x) => x)));
  const logo = sp(t, 38.55, { damping: 11 });
  const pulse = 1 + 0.04 * Math.sin(t * 7) * lin(t, 40.6, 40.9);
  return (
    <AbsoluteFill style={{ ...center, justifyContent: "center", paddingBottom: 220 }}>
      <div style={{ position: "absolute", width: 900, height: 900, borderRadius: 999, background: "radial-gradient(circle, rgba(37,99,235,.45), transparent 65%)", transform: `scale(${0.6 + logo * 0.6})` }} />
      <div style={{ transform: `scale(${logo}) rotate(${(1 - logo) * 30}deg)`, filter: "drop-shadow(0 30px 60px rgba(0,0,0,.5))" }}>
        <LogoMark size={260} draw={lin(t, 38.6, 39.3)} />
      </div>
      <div style={{ color: "#fff", fontSize: 104, fontWeight: 800, letterSpacing: -3, marginTop: 40, opacity: lin(t, 38.8, 39.1), transform: `translateY(${(1 - sp(t, 38.8)) * 40}px)` }}>
        MiBarbería
      </div>
      <div style={{ color: C.nightMuted, fontSize: 40, fontWeight: 600, marginTop: 8, opacity: lin(t, 39.0, 39.3) }}>Turnos, señas y recordatorios</div>
      <div style={{ marginTop: 70, padding: "34px 60px", borderRadius: 999, background: "#fff", color: C.ink, fontSize: 76, fontWeight: 800, letterSpacing: -1, minWidth: 700, textAlign: "center", opacity: lin(t, 39.3, 39.5), transform: `scale(${pulse})`, boxShadow: "0 30px 80px rgba(143,174,255,.35)" }}>
        {typed}
        <span style={{ color: C.primary, opacity: Math.sin(t * 12) > 0 || typed.length < url.length ? 1 : 0 }}>|</span>
      </div>
      <div style={{ marginTop: 50, color: C.accent, fontSize: 52, fontWeight: 800, opacity: lin(t, 40.5, 40.8), transform: `translateY(${(1 - sp(t, 40.5)) * 40}px)` }}>
        Probala hoy →
      </div>
    </AbsoluteFill>
  );
};
