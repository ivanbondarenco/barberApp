-- D.S Studio Barbería · Esquema base para Supabase (PostgreSQL)
-- Refleja los tipos de src/lib/types.ts. Aplicar con: supabase db push  (o SQL editor)

create extension if not exists "pgcrypto";

-- ───────────────────────── Perfiles y roles ─────────────────────────
create type public.user_role as enum ('cliente', 'barbero', 'admin');

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        public.user_role not null default 'cliente',
  full_name   text not null,
  phone       text,
  email       text,
  preferences text,
  notify_reminder boolean not null default true,
  notify_whatsapp boolean not null default true,
  notify_promos   boolean not null default false,
  credit      integer not null default 0 check (credit >= 0),   -- crédito a favor (ARS)
  created_at  timestamptz not null default now()
);

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('barbero', 'admin'));
$$;

-- ───────────────────────── Catálogo ─────────────────────────
create table public.barbers (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid references public.profiles (id),
  name        text not null,
  title       text not null,
  chair       smallint not null unique,
  rating      numeric(3, 2) not null default 5,
  reviews     integer not null default 0,
  phone       text,
  active      boolean not null default true
);

create table public.services (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  description   text not null default '',
  price         integer not null check (price > 0),            -- ARS enteros
  duration_min  smallint not null check (duration_min between 15 and 240),
  category      text not null check (category in ('corte', 'barba', 'combo', 'tratamiento')),
  tag           text,
  featured      boolean not null default false,
  active        boolean not null default true
);

create table public.products (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  subtitle  text not null default '',
  price     integer not null check (price > 0),
  size      text not null,
  stock     integer not null default 0 check (stock >= 0),
  category  text not null check (category in ('ceras', 'barba', 'afeitado', 'cuidado')),
  active    boolean not null default true
);

-- ───────────────────────── Turnos ─────────────────────────
create type public.payment_method as enum ('mercadopago', 'transferencia', 'efectivo', 'credito');
create type public.appointment_status as enum ('confirmado', 'completado', 'cancelado');

create table public.appointments (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid references public.profiles (id),
  client_name      text not null,
  client_phone     text not null,
  barber_id        uuid not null references public.barbers (id),
  service_id       uuid not null references public.services (id),
  service_name     text not null,                 -- snapshot del precio/nombre al reservar
  service_price    integer not null,
  duration_min     smallint not null,
  starts_at        timestamptz not null,
  notes            text,
  -- Regla de negocio crítica: la seña es SIEMPRE el 50% del servicio.
  deposit_amount   integer generated always as (round(service_price * 0.5)::integer) stored,
  deposit_status   text not null default 'pendiente' check (deposit_status in ('pendiente', 'abonada')),
  deposit_method   public.payment_method not null,
  deposit_paid_at  timestamptz,
  balance_amount   integer,
  balance_method   public.payment_method,
  balance_paid_at  timestamptz,
  status           public.appointment_status not null default 'confirmado',
  source           text not null default 'app' check (source in ('app', 'manual')),
  mp_payment_id    text,
  created_at       timestamptz not null default now()
);

-- Evita dos turnos superpuestos en el mismo sillón.
create extension if not exists btree_gist;
alter table public.appointments add constraint no_overlap exclude using gist (
  barber_id with =,
  tstzrange(starts_at, starts_at + make_interval(mins => duration_min)) with &&
) where (status <> 'cancelado');

create table public.appointment_products (
  appointment_id  uuid not null references public.appointments (id) on delete cascade,
  product_id      uuid not null references public.products (id),
  name            text not null,
  unit_price      integer not null,
  qty             smallint not null check (qty > 0),
  primary key (appointment_id, product_id)
);

create table public.time_blocks (
  id         uuid primary key default gen_random_uuid(),
  barber_id  uuid not null references public.barbers (id),
  starts_at  timestamptz not null,
  ends_at    timestamptz not null check (ends_at > starts_at),
  reason     text not null
);

create table public.settings (
  id                 boolean primary key default true check (id),   -- fila única
  allow_cash_deposit boolean not null default true,
  cash_open          boolean not null default false,
  cash_opened_at     timestamptz
);
insert into public.settings default values;

create table public.business_info (
  id              boolean primary key default true check (id),
  name            text not null,
  address         text not null,
  neighborhood    text not null,
  whatsapp        text not null,
  email           text not null,
  instagram       text,
  transfer_alias  text not null,
  transfer_cbu    char(22) not null
);

create table public.business_hours (
  weekday  smallint primary key check (weekday between 0 and 6),   -- 0 = domingo
  opens    time not null,
  closes   time not null check (closes > opens),
  closed   boolean not null default false
);

create table public.cash_closures (
  id             uuid primary key default gen_random_uuid(),
  day            date not null,
  opened_at      time,
  closed_at      timestamptz not null default now(),
  expected_cash  integer not null,
  counted_cash   integer not null,
  digital        integer not null,
  total          integer not null,
  notes          text,
  closed_by      uuid references public.profiles (id)
);

-- ───────────────────────── Row Level Security ─────────────────────────
alter table public.profiles             enable row level security;
alter table public.barbers              enable row level security;
alter table public.services             enable row level security;
alter table public.products             enable row level security;
alter table public.appointments         enable row level security;
alter table public.appointment_products enable row level security;
alter table public.time_blocks          enable row level security;
alter table public.settings             enable row level security;
alter table public.business_info        enable row level security;
alter table public.business_hours       enable row level security;
alter table public.cash_closures        enable row level security;

create policy "perfil propio" on public.profiles
  for select using (id = auth.uid() or public.is_staff());
create policy "editar perfil propio" on public.profiles
  for update using (id = auth.uid());

-- Catálogo público de lectura; escritura solo staff.
create policy "leer barberos" on public.barbers for select using (true);
create policy "leer servicios activos" on public.services for select using (active or public.is_staff());
create policy "leer productos activos" on public.products for select using (active or public.is_staff());
create policy "staff gestiona servicios" on public.services for all using (public.is_staff()) with check (public.is_staff());
create policy "staff gestiona productos" on public.products for all using (public.is_staff()) with check (public.is_staff());
create policy "leer ajustes" on public.settings for select using (true);
create policy "staff ajustes" on public.settings for update using (public.is_staff());
create policy "leer negocio" on public.business_info for select using (true);
create policy "staff negocio" on public.business_info for update using (public.is_staff());
create policy "leer horarios" on public.business_hours for select using (true);
create policy "staff horarios" on public.business_hours for all using (public.is_staff()) with check (public.is_staff());
create policy "staff cierres" on public.cash_closures for all using (public.is_staff()) with check (public.is_staff());

-- Turnos: el cliente ve y crea los suyos; el staff ve y gestiona todos.
create policy "cliente ve sus turnos" on public.appointments
  for select using (client_id = auth.uid() or public.is_staff());
create policy "cliente reserva" on public.appointments
  for insert with check (client_id = auth.uid() and deposit_status = 'pendiente');
create policy "cliente cancela o reprograma" on public.appointments
  for update using (client_id = auth.uid() and status = 'confirmado')
  with check (client_id = auth.uid() and status in ('confirmado', 'cancelado'));
create policy "staff gestiona turnos" on public.appointments
  for all using (public.is_staff()) with check (public.is_staff());

create policy "productos del turno" on public.appointment_products
  for all using (
    exists (select 1 from appointments a where a.id = appointment_id and (a.client_id = auth.uid() or public.is_staff()))
  );

create policy "leer bloqueos" on public.time_blocks for select using (true);
create policy "staff bloquea" on public.time_blocks for all using (public.is_staff()) with check (public.is_staff());

-- La seña digital se marca 'abonada' únicamente desde el webhook de Mercado Pago
-- (service_role), nunca desde el cliente.

-- Realtime para refrescar los sillones en vivo en la agenda.
alter publication supabase_realtime add table public.appointments, public.time_blocks;
