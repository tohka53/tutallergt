-- ============================================================================
--  MUNDO GARAGE — esquema de base de datos
--  Proyecto Supabase: mitallergt (ehwgsjbqoczwggkkxfow)
--
--  Este archivo es IDEMPOTENTE: se puede pegar y ejecutar varias veces en el
--  SQL Editor de Supabase sin romper nada. Reutiliza las tablas que ya
--  existían (profiles, vehiculos, servicios) y les agrega lo que falta.
--
--  Modelo de acceso
--  ----------------
--  * MECÁNICO: usuario real de Supabase Auth (correo + contraseña). Todas las
--    tablas tienen RLS y sólo dejan ver/escribir las filas cuyo mecanico_id
--    sea igual a auth.uid().
--  * CLIENTE: NO tiene usuario. Entra sólo con su número de teléfono y
--    únicamente si ya tiene vehículos registrados. No toca las tablas
--    directamente: todo pasa por las funciones portal_* (SECURITY DEFINER),
--    que son las únicas con permiso para el rol anon. Así la llave publicable
--    que viaja en el navegador no sirve para leer la base entera.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Utilidades
-- ---------------------------------------------------------------------------

create extension if not exists pgcrypto;

-- Deja un teléfono en puros dígitos para poder compararlo sin importar
-- guiones, espacios ni el prefijo del país escrito de distintas formas.
create or replace function public.normaliza_telefono(p_telefono text)
returns text
language sql
immutable
as $$
  select regexp_replace(coalesce(p_telefono, ''), '[^0-9]', '', 'g');
$$;

-- Compara dos teléfonos por sus últimos 8 dígitos (el largo de un número
-- guatemalteco). Así "5411-6453", "50254116453" y "+502 5411 6453" son el mismo.
create or replace function public.mismo_telefono(a text, b text)
returns boolean
language sql
immutable
as $$
  select right(public.normaliza_telefono(a), 8) = right(public.normaliza_telefono(b), 8)
     and length(public.normaliza_telefono(a)) >= 8
     and length(public.normaliza_telefono(b)) >= 8;
$$;

create or replace function public.toca_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. profiles — el mecánico. Ya existía; sólo se le agregan columnas.
-- ---------------------------------------------------------------------------

alter table public.profiles add column if not exists telefono text;
alter table public.profiles add column if not exists rol text not null default 'mecanico';

-- Al crearse un usuario en Auth se crea su profile automáticamente. Sin esto
-- habría que insertarlo a mano después de cada registro.
create or replace function public.maneja_usuario_nuevo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nombre, correo, activo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    new.email,
    1
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.maneja_usuario_nuevo();

-- ---------------------------------------------------------------------------
-- 2. taller_config — nombre, logo y datos que salen en el PDF
-- ---------------------------------------------------------------------------

create table if not exists public.taller_config (
  mecanico_id      uuid primary key references public.profiles(id) on delete cascade,
  nombre           text        not null default 'Mundo Garage',
  eslogan          text        not null default 'Donde el mundo se pone en marcha',
  logo_url         text        not null default '',
  correo           text        not null default '',
  telefono         text        not null default '',
  direccion        text        not null default '',
  nit              text        not null default '',
  moneda           text        not null default 'Q',
  max_subida_mb    integer     not null default 5,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. clientes — no existía. El teléfono es la llave con la que entra al portal.
-- ---------------------------------------------------------------------------

create table if not exists public.clientes (
  id           uuid primary key default gen_random_uuid(),
  mecanico_id  uuid        not null references public.profiles(id) on delete cascade,
  nombre       text        not null,
  apellido     text        not null default '',
  nit          text        not null default 'CF',
  telefono     text        not null,
  whatsapp     text        not null default '',
  correo       text        not null default '',
  direccion    text        not null default '',
  notas        text        not null default '',
  activo       boolean     not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Columna normalizada + índice único: dos clientes no pueden compartir número,
-- porque el número ES la credencial de acceso al portal.
alter table public.clientes
  add column if not exists telefono_norm text
  generated always as (right(regexp_replace(coalesce(telefono,''), '[^0-9]', '', 'g'), 8)) stored;

create unique index if not exists clientes_telefono_norm_uniq
  on public.clientes (telefono_norm)
  where activo;

create index if not exists clientes_mecanico_idx on public.clientes (mecanico_id);

drop trigger if exists clientes_updated_at on public.clientes;
create trigger clientes_updated_at before update on public.clientes
  for each row execute function public.toca_updated_at();

-- ---------------------------------------------------------------------------
-- 4. vehiculos — ya existía (mecanico_id, placa, marca, modelo, anio, duenio,
--    tipo). Se le agregan las columnas que faltaban.
--
--    Ojo con los nombres, porque en Guatemala se usan al revés que en el
--    código en inglés:  MARCA = Honda ·  LÍNEA = CR-V LX 4WD ·  MODELO = 2011.
--    Para no romper lo que ya estaba, la columna `modelo` se sigue usando como
--    nombre de la línea y `anio` como el año; `linea` es el texto largo que
--    sale en el PDF.
-- ---------------------------------------------------------------------------

alter table public.vehiculos add column if not exists cliente_id   uuid references public.clientes(id) on delete set null;
alter table public.vehiculos add column if not exists linea        text    not null default '';
alter table public.vehiculos add column if not exists cilindrada   text    not null default '';
alter table public.vehiculos add column if not exists color        text    not null default '';
alter table public.vehiculos add column if not exists vin          text    not null default '';
alter table public.vehiculos add column if not exists motor        text    not null default '';
alter table public.vehiculos add column if not exists combustible  text    not null default 'Gasolina';
alter table public.vehiculos add column if not exists transmision  text    not null default 'Automática';
alter table public.vehiculos add column if not exists kilometraje  integer not null default 0;
alter table public.vehiculos add column if not exists procedencia  text    not null default 'agencia';
alter table public.vehiculos add column if not exists pais_origen  text    not null default '';
alter table public.vehiculos add column if not exists notas        text    not null default '';
alter table public.vehiculos add column if not exists activo       boolean not null default true;

-- Tarjeta de circulación: un archivo por vehículo, así que va en columnas de
-- la misma fila en vez de una tabla aparte. El archivo vive en el bucket
-- privado "documentos".
alter table public.vehiculos add column if not exists doc_ruta      text;
alter table public.vehiculos add column if not exists doc_nombre    text;
alter table public.vehiculos add column if not exists doc_mime      text;
alter table public.vehiculos add column if not exists doc_tamano    integer;
alter table public.vehiculos add column if not exists doc_subido_en timestamptz;

create index if not exists vehiculos_cliente_idx  on public.vehiculos (cliente_id);
create index if not exists vehiculos_mecanico_idx on public.vehiculos (mecanico_id);

drop trigger if exists vehiculos_updated_at on public.vehiculos;
create trigger vehiculos_updated_at before update on public.vehiculos
  for each row execute function public.toca_updated_at();

-- ---------------------------------------------------------------------------
-- 5. catalogo_items — repuestos y trabajos con costo base y precio sugerido
-- ---------------------------------------------------------------------------

create table if not exists public.catalogo_items (
  id              uuid primary key default gen_random_uuid(),
  mecanico_id     uuid        not null references public.profiles(id) on delete cascade,
  codigo          text        not null default '',
  nombre          text        not null,
  descripcion     text        not null default '',
  categoria       text        not null default 'General',
  tipo            text        not null default 'part',   -- part | material | lubricant | labor | other
  costo_sugerido  numeric(12,2) not null default 0,      -- lo que le cuesta al taller
  precio_sugerido numeric(12,2) not null default 0,      -- lo que se le cobra al cliente
  marcas          text[]      not null default '{}',
  modelos         text[]      not null default '{}',
  activo          boolean     not null default true,
  created_at      timestamptz not null default now()
);

create index if not exists catalogo_mecanico_idx on public.catalogo_items (mecanico_id);

-- ---------------------------------------------------------------------------
-- 6. cotizaciones + cotizacion_items
--
--    Cada línea guarda DOS números: costo_unitario (lo que paga el taller por
--    el repuesto) y precio_unitario (lo que se le cobra al cliente). La mano
--    de obra no tiene costo base: su costo es 0 y todo su precio es ganancia.
--    En el PDF y en el portal del cliente sólo se muestra precio_unitario.
-- ---------------------------------------------------------------------------

create table if not exists public.cotizaciones (
  id                  uuid primary key default gen_random_uuid(),
  mecanico_id         uuid        not null references public.profiles(id) on delete cascade,
  cliente_id          uuid        not null references public.clientes(id) on delete restrict,
  vehiculo_id         uuid        not null references public.vehiculos(id) on delete restrict,
  numero              text        not null,
  fecha               timestamptz not null default now(),
  validez_dias        integer     not null default 15,
  kilometraje         integer     not null default 0,
  metodo_pago         text        not null default 'Efectivo / Transferencia',
  notas               text        not null default '',
  consideraciones     text        not null default '',
  anticipo            numeric(12,2) not null default 0,
  -- calculados y guardados para no tener que recomputarlos en cada consulta
  subtotal_repuestos  numeric(12,2) not null default 0,
  subtotal_mano_obra  numeric(12,2) not null default 0,
  descuento_total     numeric(12,2) not null default 0,
  subtotal            numeric(12,2) not null default 0,  -- repuestos + mano de obra
  costo_total         numeric(12,2) not null default 0,  -- lo que se gastó
  ganancia            numeric(12,2) not null default 0,  -- subtotal - costo_total
  total               numeric(12,2) not null default 0,  -- subtotal - anticipo
  estado              text        not null default 'draft', -- draft|sent|accepted|converted|void
  aceptada_en         timestamptz,
  servicio_id         uuid,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create unique index if not exists cotizaciones_numero_uniq on public.cotizaciones (mecanico_id, numero);
create index if not exists cotizaciones_cliente_idx  on public.cotizaciones (cliente_id);
create index if not exists cotizaciones_vehiculo_idx on public.cotizaciones (vehiculo_id);
create index if not exists cotizaciones_fecha_idx    on public.cotizaciones (mecanico_id, fecha);

drop trigger if exists cotizaciones_updated_at on public.cotizaciones;
create trigger cotizaciones_updated_at before update on public.cotizaciones
  for each row execute function public.toca_updated_at();

create table if not exists public.cotizacion_items (
  id              uuid primary key default gen_random_uuid(),
  cotizacion_id   uuid        not null references public.cotizaciones(id) on delete cascade,
  orden           integer     not null default 0,
  tipo            text        not null default 'part',
  codigo          text        not null default '',
  descripcion     text        not null,
  nota            text        not null default '',
  cantidad        numeric(12,2) not null default 1,
  costo_unitario  numeric(12,2) not null default 0,
  precio_unitario numeric(12,2) not null default 0,
  descuento       numeric(12,2) not null default 0,
  subtotal        numeric(12,2) not null default 0
);

create index if not exists cotizacion_items_cot_idx on public.cotizacion_items (cotizacion_id, orden);

-- ---------------------------------------------------------------------------
-- 7. servicios — ya existía (mecanico_id, vehiculo_id, placa, nombre,
--    descripcion, fecha_creacion, trabajos jsonb). Se amplía.
-- ---------------------------------------------------------------------------

alter table public.servicios add column if not exists cliente_id       uuid references public.clientes(id) on delete set null;
alter table public.servicios add column if not exists cotizacion_id    uuid references public.cotizaciones(id) on delete set null;
alter table public.servicios add column if not exists numero           text    not null default '';
alter table public.servicios add column if not exists estado           text    not null default 'received';
alter table public.servicios add column if not exists kilometraje      integer not null default 0;
alter table public.servicios add column if not exists nivel_combustible text   not null default '';
alter table public.servicios add column if not exists diagnostico      text    not null default '';
alter table public.servicios add column if not exists trabajo_solicitado text  not null default '';
alter table public.servicios add column if not exists trabajo_realizado  text  not null default '';
alter table public.servicios add column if not exists notas_internas   text    not null default '';
alter table public.servicios add column if not exists notas_cliente    text    not null default '';
alter table public.servicios add column if not exists mecanico_nombre  text    not null default '';
alter table public.servicios add column if not exists entrega_estimada timestamptz;
alter table public.servicios add column if not exists entrega_real     timestamptz;
alter table public.servicios add column if not exists total            numeric(12,2) not null default 0;
alter table public.servicios add column if not exists costo_total      numeric(12,2) not null default 0;
alter table public.servicios add column if not exists historial        jsonb   not null default '[]'::jsonb;
alter table public.servicios add column if not exists updated_at       timestamptz not null default now();

create index if not exists servicios_cliente_idx  on public.servicios (cliente_id);
create index if not exists servicios_mecanico_idx on public.servicios (mecanico_id, fecha_creacion);

drop trigger if exists servicios_updated_at on public.servicios;
create trigger servicios_updated_at before update on public.servicios
  for each row execute function public.toca_updated_at();

-- ---------------------------------------------------------------------------
-- 8. servicio_fotos — evidencia de cómo se encontró la pieza (máx. 3 por orden)
-- ---------------------------------------------------------------------------

create table if not exists public.servicio_fotos (
  id           uuid primary key default gen_random_uuid(),
  servicio_id  uuid        not null references public.servicios(id) on delete cascade,
  mecanico_id  uuid        not null references public.profiles(id) on delete cascade,
  nota         text        not null default '',
  ruta         text        not null,          -- ruta dentro del bucket "evidencias"
  nombre       text        not null default '',
  tamano       integer     not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists servicio_fotos_servicio_idx on public.servicio_fotos (servicio_id);

-- ---------------------------------------------------------------------------
-- 9. Correlativos (COT-0001 / ORD-0001) generados en el servidor
-- ---------------------------------------------------------------------------

create table if not exists public.correlativos (
  mecanico_id uuid not null references public.profiles(id) on delete cascade,
  tipo        text not null,          -- 'cotizacion' | 'servicio'
  valor       integer not null default 0,
  primary key (mecanico_id, tipo)
);

create or replace function public.siguiente_correlativo(p_tipo text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_valor integer;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  insert into public.correlativos (mecanico_id, tipo, valor)
  values (auth.uid(), p_tipo, 1)
  on conflict (mecanico_id, tipo)
    do update set valor = public.correlativos.valor + 1
  returning valor into v_valor;

  return v_valor;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. RLS — el mecánico sólo ve lo suyo. El rol anon no ve NADA directamente.
-- ---------------------------------------------------------------------------

alter table public.profiles         enable row level security;
alter table public.taller_config    enable row level security;
alter table public.clientes         enable row level security;
alter table public.vehiculos        enable row level security;
alter table public.catalogo_items   enable row level security;
alter table public.cotizaciones     enable row level security;
alter table public.cotizacion_items enable row level security;
alter table public.servicios        enable row level security;
alter table public.servicio_fotos   enable row level security;
alter table public.correlativos     enable row level security;

drop policy if exists "profiles propio" on public.profiles;
create policy "profiles propio" on public.profiles
  for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "config propia" on public.taller_config;
create policy "config propia" on public.taller_config
  for all to authenticated using (mecanico_id = auth.uid()) with check (mecanico_id = auth.uid());

drop policy if exists "clientes propios" on public.clientes;
create policy "clientes propios" on public.clientes
  for all to authenticated using (mecanico_id = auth.uid()) with check (mecanico_id = auth.uid());

drop policy if exists "vehiculos propios" on public.vehiculos;
create policy "vehiculos propios" on public.vehiculos
  for all to authenticated using (mecanico_id = auth.uid()) with check (mecanico_id = auth.uid());

drop policy if exists "catalogo propio" on public.catalogo_items;
create policy "catalogo propio" on public.catalogo_items
  for all to authenticated using (mecanico_id = auth.uid()) with check (mecanico_id = auth.uid());

drop policy if exists "cotizaciones propias" on public.cotizaciones;
create policy "cotizaciones propias" on public.cotizaciones
  for all to authenticated using (mecanico_id = auth.uid()) with check (mecanico_id = auth.uid());

drop policy if exists "items de cotizaciones propias" on public.cotizacion_items;
create policy "items de cotizaciones propias" on public.cotizacion_items
  for all to authenticated
  using (exists (select 1 from public.cotizaciones c
                 where c.id = cotizacion_items.cotizacion_id and c.mecanico_id = auth.uid()))
  with check (exists (select 1 from public.cotizaciones c
                 where c.id = cotizacion_items.cotizacion_id and c.mecanico_id = auth.uid()));

drop policy if exists "servicios propios" on public.servicios;
create policy "servicios propios" on public.servicios
  for all to authenticated using (mecanico_id = auth.uid()) with check (mecanico_id = auth.uid());

drop policy if exists "fotos propias" on public.servicio_fotos;
create policy "fotos propias" on public.servicio_fotos
  for all to authenticated using (mecanico_id = auth.uid()) with check (mecanico_id = auth.uid());

drop policy if exists "correlativos propios" on public.correlativos;
create policy "correlativos propios" on public.correlativos
  for all to authenticated using (mecanico_id = auth.uid()) with check (mecanico_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 11. Portal del cliente
--
--     El cliente NO tiene sesión. Estas funciones son SECURITY DEFINER: se
--     saltan RLS pero sólo devuelven las filas del teléfono que reciben, y
--     nunca devuelven costo_unitario ni ganancia. Son lo único que el rol
--     anon puede ejecutar.
-- ---------------------------------------------------------------------------

-- Entrada al portal. Devuelve null si el teléfono no existe O si el cliente
-- no tiene ningún vehículo registrado (regla pedida: sin vehículos, no entra).
create or replace function public.portal_login(p_telefono text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente public.clientes%rowtype;
  v_vehiculos integer;
begin
  select * into v_cliente
  from public.clientes
  where activo
    and telefono_norm = right(public.normaliza_telefono(p_telefono), 8)
    and length(public.normaliza_telefono(p_telefono)) >= 8
  limit 1;

  if not found then
    return null;
  end if;

  select count(*) into v_vehiculos
  from public.vehiculos
  where cliente_id = v_cliente.id and activo;

  if v_vehiculos = 0 then
    return jsonb_build_object('sin_vehiculos', true);
  end if;

  return jsonb_build_object(
    'cliente', jsonb_build_object(
      'id', v_cliente.id,
      'nombre', v_cliente.nombre,
      'apellido', v_cliente.apellido,
      'nit', v_cliente.nit,
      'telefono', v_cliente.telefono,
      'whatsapp', v_cliente.whatsapp,
      'correo', v_cliente.correo,
      'direccion', v_cliente.direccion
    ),
    'vehiculos', v_vehiculos
  );
end;
$$;

-- Todo lo que ve el cliente en su portal, en una sola llamada.
create or replace function public.portal_datos(p_telefono text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente_id uuid;
  v_taller jsonb;
begin
  select id into v_cliente_id
  from public.clientes
  where activo
    and telefono_norm = right(public.normaliza_telefono(p_telefono), 8)
    and length(public.normaliza_telefono(p_telefono)) >= 8
  limit 1;

  if v_cliente_id is null then
    return null;
  end if;

  select to_jsonb(t) into v_taller
  from (
    select tc.nombre, tc.eslogan, tc.logo_url, tc.correo, tc.telefono, tc.direccion, tc.nit, tc.moneda
    from public.taller_config tc
    join public.clientes c on c.mecanico_id = tc.mecanico_id
    where c.id = v_cliente_id
  ) t;

  return jsonb_build_object(
    'taller', coalesce(v_taller, '{}'::jsonb),
    'vehiculos', coalesce((
      select jsonb_agg(to_jsonb(v) order by v.created_at desc)
      from public.vehiculos v
      where v.cliente_id = v_cliente_id and v.activo
    ), '[]'::jsonb),
    'servicios', coalesce((
      select jsonb_agg(s order by s.fecha_creacion desc) from (
        select sv.id, sv.numero, sv.vehiculo_id, sv.placa, sv.nombre, sv.descripcion,
               sv.estado, sv.fecha_creacion, sv.entrega_estimada, sv.entrega_real,
               sv.kilometraje, sv.diagnostico, sv.trabajo_solicitado, sv.trabajo_realizado,
               sv.notas_cliente, sv.total, sv.trabajos, sv.historial,
               coalesce((
                 select jsonb_agg(jsonb_build_object('id', f.id, 'nota', f.nota, 'ruta', f.ruta)
                                  order by f.created_at)
                 from public.servicio_fotos f where f.servicio_id = sv.id
               ), '[]'::jsonb) as fotos
        from public.servicios sv
        where sv.cliente_id = v_cliente_id
      ) s
    ), '[]'::jsonb),
    'cotizaciones', coalesce((
      select jsonb_agg(q order by q.fecha desc) from (
        select co.id, co.numero, co.vehiculo_id, co.fecha, co.validez_dias, co.kilometraje,
               co.metodo_pago, co.notas, co.consideraciones, co.estado,
               co.subtotal_repuestos, co.subtotal_mano_obra, co.descuento_total,
               co.subtotal, co.anticipo, co.total,
               coalesce((
                 -- OJO: aquí NO va costo_unitario. El cliente nunca ve el costo.
                 select jsonb_agg(jsonb_build_object(
                          'id', i.id, 'tipo', i.tipo, 'codigo', i.codigo,
                          'descripcion', i.descripcion, 'nota', i.nota,
                          'cantidad', i.cantidad, 'precio_unitario', i.precio_unitario,
                          'descuento', i.descuento, 'subtotal', i.subtotal)
                        order by i.orden)
                 from public.cotizacion_items i where i.cotizacion_id = co.id
               ), '[]'::jsonb) as items
        from public.cotizaciones co
        where co.cliente_id = v_cliente_id and co.estado <> 'draft' and co.estado <> 'void'
      ) q
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.portal_login(text)  from public;
revoke all on function public.portal_datos(text)  from public;
grant execute on function public.portal_login(text) to anon, authenticated;
grant execute on function public.portal_datos(text) to anon, authenticated;
grant execute on function public.siguiente_correlativo(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 12. Catálogo inicial (se copia una sola vez por mecánico)
-- ---------------------------------------------------------------------------

create or replace function public.sembrar_catalogo()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  select count(*) into v_n from public.catalogo_items where mecanico_id = auth.uid();
  if v_n > 0 then
    return 0;
  end if;

  insert into public.catalogo_items (mecanico_id, codigo, nombre, categoria, tipo, costo_sugerido, precio_sugerido)
  values
    (auth.uid(), 'FRE-PAS-007', 'Pastillas de freno delanteras',        'Frenos',      'part',      210,  320),
    (auth.uid(), 'FRE-PAS-008', 'Pastillas de freno traseras',          'Frenos',      'part',      195,  295),
    (auth.uid(), 'FRE-DIS-009', 'Disco de freno delantero',             'Frenos',      'part',      280,  420),
    (auth.uid(), 'FRE-CAB-010', 'Cable de freno de mano',               'Frenos',      'part',      390,  610),
    (auth.uid(), 'FIL-AC-001',  'Filtro de aceite',                     'Filtros',     'part',       32,   55),
    (auth.uid(), 'FIL-AIR-002', 'Filtro de aire',                       'Filtros',     'part',       58,   95),
    (auth.uid(), 'FIL-COM-003', 'Filtro de combustible',                'Filtros',     'part',       75,  130),
    (auth.uid(), 'FIL-CAB-004', 'Filtro de cabina',                     'Filtros',     'part',       62,  110),
    (auth.uid(), 'LUB-5W30-005','Aceite sintético 5W-30 (litro)',       'Lubricantes', 'lubricant',  52,   78),
    (auth.uid(), 'LUB-10W40-006','Aceite semisintético 10W-40 (litro)', 'Lubricantes', 'lubricant',  38,   62),
    (auth.uid(), 'SUS-AMO-011', 'Amortiguador delantero',               'Suspensión',  'part',      430,  650),
    (auth.uid(), 'SUS-AMO-012', 'Amortiguador trasero',                 'Suspensión',  'part',      395,  590),
    (auth.uid(), 'SUS-ROT-013', 'Rótula de suspensión',                 'Suspensión',  'part',      180,  290),
    (auth.uid(), 'SUS-TER-014', 'Terminal de dirección',                'Suspensión',  'part',      165,  265),
    (auth.uid(), 'MOT-BUJ-015', 'Bujía de encendido',                   'Motor',       'part',       45,   78),
    (auth.uid(), 'MOT-BAN-016', 'Banda de accesorios',                  'Motor',       'part',      140,  225),
    (auth.uid(), 'MOT-BOM-017', 'Bomba de agua',                        'Motor',       'part',      520,  790),
    (auth.uid(), 'ELE-BAT-018', 'Batería 12V 60Ah',                     'Eléctrico',   'part',      520,  750),
    (auth.uid(), 'ELE-ALT-019', 'Alternador reconstruido',              'Eléctrico',   'part',      780, 1150),
    (auth.uid(), 'ELE-MAR-020', 'Motor de arranque reconstruido',       'Eléctrico',   'part',      690, 1020),
    (auth.uid(), 'ENF-RAD-021', 'Radiador',                             'Enfriamiento','part',      620,  940),
    (auth.uid(), 'ENF-TER-022', 'Termostato',                           'Enfriamiento','part',       85,  145),
    (auth.uid(), 'ENF-REF-023', 'Refrigerante (galón)',                 'Enfriamiento','material',   95,  150),
    (auth.uid(), 'LLA-BAL-024', 'Balanceo por llanta',                  'Llantas',     'other',      25,   45),
    (auth.uid(), 'MAT-LIM-025', 'Limpiador de inyectores',              'Materiales',  'material',   55,   95),
    (auth.uid(), 'MAT-EMP-026', 'Empaque de cárter',                    'Materiales',  'material',   38,   65),
    (auth.uid(), 'MO-CAMB-030', 'MO Cambio de aceite y filtro',         'Mano de obra','labor',       0,  120),
    (auth.uid(), 'MO-FRE-031',  'MO Cambio de frenos',                  'Mano de obra','labor',       0,  250),
    (auth.uid(), 'MO-FRE-035',  'MO Cambio de cable de freno de mano',  'Mano de obra','labor',       0,  450),
    (auth.uid(), 'MO-DIAG-032', 'MO Diagnóstico con escáner',           'Mano de obra','labor',       0,  175),
    (auth.uid(), 'MO-SUS-034',  'MO Cambio de amortiguadores',          'Mano de obra','labor',       0,  400),
    (auth.uid(), 'MO-MOT-036',  'MO Afinamiento completo',              'Mano de obra','labor',       0,  550),
    (auth.uid(), 'MO-ELE-037',  'MO Revisión de sistema eléctrico',     'Mano de obra','labor',       0,  200),
    (auth.uid(), 'MO-ENF-038',  'MO Cambio de radiador',                'Mano de obra','labor',       0,  480);

  return 34;
end;
$$;

grant execute on function public.sembrar_catalogo() to authenticated;

-- ---------------------------------------------------------------------------
-- 13. Almacenamiento de archivos
--
--     evidencias  → público (fotos de piezas; el cliente las abre sin sesión)
--     documentos  → privado (tarjeta de circulación: dato personal, sólo el
--                   mecánico, con enlace firmado)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('evidencias', 'evidencias', true)
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do nothing;

drop policy if exists "evidencias lectura publica" on storage.objects;
create policy "evidencias lectura publica" on storage.objects
  for select to anon, authenticated using (bucket_id = 'evidencias');

drop policy if exists "evidencias escribe el mecanico" on storage.objects;
create policy "evidencias escribe el mecanico" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'evidencias' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "evidencias borra el mecanico" on storage.objects;
create policy "evidencias borra el mecanico" on storage.objects
  for delete to authenticated
  using (bucket_id = 'evidencias' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "documentos del mecanico" on storage.objects;
create policy "documentos del mecanico" on storage.objects
  for all to authenticated
  using (bucket_id = 'documentos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'documentos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================================
--  Fin. Después de ejecutar esto:
--   1. Authentication → Users → Add user: correo y contraseña del mecánico.
--      (o registrarse desde la propia app)
--   2. Entrar a la app con ese correo; el catálogo se copia solo.
--   3. Crear clientes y vehículos. El cliente ya puede entrar con su teléfono.
-- ============================================================================
