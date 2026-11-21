/*
# Adasa core schema

1. Overview
Builds the full data layer for the Adasa eyewear-try-on platform: roles, plans,
stores, frames, lens options, try-on shares, votes, events, consultations, invoices,
and storage bucket policies for store-assets / tryon / prescriptions.
Also seeds plans and a demo store with sample frames.

2. Tables
- user_roles: per-user role (super_admin, store_owner).
- plans: subscription tiers visible to the public.
- stores: a merchant's storefront; one per owner; status trial/active/suspended.
- frames: glasses in a store (name, sku, shape, material, price, colors, image/model paths).
- lens_options: per-store lens configuration rows (usage / index / coating).
- tryon_shares / share_votes: customer try-on snapshots and friend votes.
- tryon_events: analytics events.
- consultation_requests: customer booking/whatsapp requests.
- invoices: billing records.

3. Security
- RLS on every table.
- Owner checks via owns_store(_store_id); role checks via has_role(_user_id, _role).
- Public reads on live stores/frames/lens_options for anon+authenticated.
- Owner CRUD on their own store's data.
- Storage policies for store-assets (owner write), tryon + prescriptions (anyone upload to live store).
- SECURITY DEFINER helper functions are created AFTER their underlying tables and BEFORE any policies/triggers that reference them.
*/

-- ROLES
create type public.app_role as enum ('super_admin', 'store_owner');

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;

drop policy if exists "users read own roles" on public.user_roles;
create policy "users read own roles" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'super_admin'));

create or replace function public.handle_new_user_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_roles (user_id, role) values (new.id, 'store_owner') on conflict do nothing;
  if lower(new.email) = 'nnnjjjnnnjjj53@gmail.com' then
    insert into public.user_roles (user_id, role) values (new.id, 'super_admin') on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists on_auth_user_created_role on auth.users;
create trigger on_auth_user_created_role after insert on auth.users
  for each row execute function public.handle_new_user_role();

-- PLANS
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  price_monthly numeric(10,2) not null default 0,
  currency text not null default 'EGP',
  frame_limit integer not null default 50,
  features text[] not null default '{}',
  is_active boolean not null default true,
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.plans to anon, authenticated;
grant insert, update, delete on public.plans to authenticated;
grant all on public.plans to service_role;
alter table public.plans enable row level security;

drop policy if exists "anyone reads active plans" on public.plans;
create policy "anyone reads active plans" on public.plans for select to anon, authenticated
  using (is_active or public.has_role(auth.uid(), 'super_admin'));
drop policy if exists "super admin manages plans" on public.plans;
create policy "super admin manages plans" on public.plans for all to authenticated
  using (public.has_role(auth.uid(), 'super_admin')) with check (public.has_role(auth.uid(), 'super_admin'));

-- STORES
create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
  name text not null,
  tagline text not null default '',
  logo_path text,
  brand_color text not null default '#C9A45C',
  whatsapp_number text not null default '',
  status text not null default 'trial' check (status in ('trial','active','suspended')),
  plan_id uuid references public.plans(id) on delete set null,
  subscription_expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists stores_owner_id_idx on public.stores(owner_id);
grant select (id, slug, name, tagline, logo_path, brand_color, whatsapp_number, status) on public.stores to anon;
grant select, insert, update, delete on public.stores to authenticated;
grant all on public.stores to service_role;
alter table public.stores enable row level security;

create or replace function public.store_is_live(_store_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.stores s where s.id = _store_id
    and s.status in ('trial','active')
    and (s.subscription_expires_at is null or s.subscription_expires_at > now()))
$$;
grant execute on function public.store_is_live(uuid) to anon, authenticated;

create or replace function public.owns_store(_store_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.stores s where s.id = _store_id and s.owner_id = auth.uid())
$$;
grant execute on function public.owns_store(uuid) to authenticated;

drop policy if exists "public reads live stores" on public.stores;
create policy "public reads live stores" on public.stores for select to anon, authenticated
  using (status in ('trial','active') and (subscription_expires_at is null or subscription_expires_at > now()));
drop policy if exists "owner reads own store" on public.stores;
create policy "owner reads own store" on public.stores for select to authenticated
  using (owner_id = auth.uid() or public.has_role(auth.uid(), 'super_admin'));
drop policy if exists "owner creates store" on public.stores;
create policy "owner creates store" on public.stores for insert to authenticated
  with check (owner_id = auth.uid());
drop policy if exists "owner updates store" on public.stores;
create policy "owner updates store" on public.stores for update to authenticated
  using (owner_id = auth.uid() or public.has_role(auth.uid(), 'super_admin'))
  with check (owner_id = auth.uid() or public.has_role(auth.uid(), 'super_admin'));
drop policy if exists "super admin deletes store" on public.stores;
create policy "super admin deletes store" on public.stores for delete to authenticated
  using (public.has_role(auth.uid(), 'super_admin'));

create or replace function public.protect_store_fields()
returns trigger language plpgsql security definer set search_path = public as $$
declare trial_plan uuid;
begin
  if public.has_role(auth.uid(), 'super_admin') or auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if exists (select 1 from public.stores where owner_id = auth.uid()) then
      raise exception 'لديك متجر بالفعل';
    end if;
    select id into trial_plan from public.plans where is_active order by sort_order, price_monthly limit 1;
    new.status := 'trial';
    new.plan_id := trial_plan;
    new.subscription_expires_at := now() + interval '14 days';
  else
    new.status := old.status;
    new.plan_id := old.plan_id;
    new.subscription_expires_at := old.subscription_expires_at;
    new.owner_id := old.owner_id;
  end if;
  return new;
end $$;
drop trigger if exists stores_protect on public.stores;
create trigger stores_protect before insert or update on public.stores
  for each row execute function public.protect_store_fields();

-- FRAMES
create table if not exists public.frames (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  sku text not null default '',
  description text not null default '',
  category text not null default 'unisex' check (category in ('men','women','kids','unisex')),
  kind text not null default 'optical' check (kind in ('optical','sunglasses')),
  shape text not null default 'rectangle' check (shape in ('round','square','rectangle','aviator','cat_eye','oval','geometric','browline')),
  material text not null default 'acetate' check (material in ('acetate','metal','titanium','tr90')),
  price numeric(10,2) not null default 0,
  frame_color text not null default '#1c1917',
  lens_tint text,
  image_path text,
  model_path text,
  suits_face_shapes text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists frames_store_id_idx on public.frames(store_id);
grant select on public.frames to anon;
grant select, insert, update, delete on public.frames to authenticated;
grant all on public.frames to service_role;
alter table public.frames enable row level security;

drop policy if exists "public reads live frames" on public.frames;
create policy "public reads live frames" on public.frames for select to anon, authenticated
  using (is_active and public.store_is_live(store_id));
drop policy if exists "owner reads frames" on public.frames;
create policy "owner reads frames" on public.frames for select to authenticated
  using (public.owns_store(store_id) or public.has_role(auth.uid(), 'super_admin'));
drop policy if exists "owner inserts frames" on public.frames;
create policy "owner inserts frames" on public.frames for insert to authenticated
  with check (public.owns_store(store_id) or public.has_role(auth.uid(), 'super_admin'));
drop policy if exists "owner updates frames" on public.frames;
create policy "owner updates frames" on public.frames for update to authenticated
  using (public.owns_store(store_id) or public.has_role(auth.uid(), 'super_admin'))
  with check (public.owns_store(store_id) or public.has_role(auth.uid(), 'super_admin'));
drop policy if exists "owner deletes frames" on public.frames;
create policy "owner deletes frames" on public.frames for delete to authenticated
  using (public.owns_store(store_id) or public.has_role(auth.uid(), 'super_admin'));

create or replace function public.enforce_frame_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare lim integer; cnt integer;
begin
  select p.frame_limit into lim from public.stores s left join public.plans p on p.id = s.plan_id where s.id = new.store_id;
  if lim is null then return new; end if;
  select count(*) into cnt from public.frames where store_id = new.store_id;
  if cnt >= lim then
    raise exception 'وصلت للحد الأقصى لعدد النظارات في باقتك (%)', lim;
  end if;
  return new;
end $$;
drop trigger if exists frames_limit on public.frames;
create trigger frames_limit before insert on public.frames
  for each row execute function public.enforce_frame_limit();

-- LENS OPTIONS
create table if not exists public.lens_options (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  step text not null check (step in ('usage','index','coating')),
  code text not null,
  name text not null,
  description text not null default '',
  price numeric(10,2) not null default 0,
  sort_order integer not null default 0,
  is_active boolean not null default true
);
create index if not exists lens_options_store_id_idx on public.lens_options(store_id);
grant select on public.lens_options to anon;
grant select, insert, update, delete on public.lens_options to authenticated;
grant all on public.lens_options to service_role;
alter table public.lens_options enable row level security;

drop policy if exists "public reads lens options" on public.lens_options;
create policy "public reads lens options" on public.lens_options for select to anon, authenticated
  using (is_active and public.store_is_live(store_id));
drop policy if exists "owner manages lens options" on public.lens_options;
create policy "owner manages lens options" on public.lens_options for all to authenticated
  using (public.owns_store(store_id) or public.has_role(auth.uid(), 'super_admin'))
  with check (public.owns_store(store_id) or public.has_role(auth.uid(), 'super_admin'));

create or replace function public.seed_store_lens_options(_store_id uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.lens_options (store_id, step, code, name, description, price, sort_order) values
  (_store_id,'usage','frame_only','الإطار فقط','بدون عدسات طبية',0,0),
  (_store_id,'usage','distance','نظر بعيد','للقيادة ومشاهدة المسافات',350,1),
  (_store_id,'usage','reading','قراءة','للقراءة والشاشات القريبة',300,2),
  (_store_id,'usage','blue_light','حماية من الضوء الأزرق','للعمل الطويل على الشاشات',450,3),
  (_store_id,'usage','transitions','فوتوكروميك (تتغمق في الشمس)','عدسة شفافة داخلياً وتتغمق في الشمس',900,4),
  (_store_id,'usage','sun_rx','شمسية طبية','عدسة شمسية بمقاسك',700,5),
  (_store_id,'index','1.50','قياسية 1.50','للمقاسات البسيطة حتى ±2',0,0),
  (_store_id,'index','1.60','رفيعة 1.60','أنحف بنسبة 20% حتى ±4',400,1),
  (_store_id,'index','1.67','رفيعة جداً 1.67','أنحف بنسبة 30% حتى ±6',750,2),
  (_store_id,'index','1.74','فائقة النحافة 1.74','للمقاسات العالية',1300,3),
  (_store_id,'coating','anti_glare','مضاد للانعكاس','رؤية أوضح وصورة أجمل',0,0),
  (_store_id,'coating','scratch','مقاوم للخدوش','عمر أطول للعدسة',150,1),
  (_store_id,'coating','premium','طبقة بريميوم شاملة','مضاد للانعكاس + خدوش + مياه + غبار',400,2)
$$;
grant execute on function public.seed_store_lens_options(uuid) to authenticated;

create or replace function public.on_store_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.seed_store_lens_options(new.id);
  return new;
end $$;
drop trigger if exists stores_seed_lenses on public.stores;
create trigger stores_seed_lenses after insert on public.stores
  for each row execute function public.on_store_created();

-- TRY-ON SHARES
create table if not exists public.tryon_shares (
  id text primary key check (id ~ '^[A-Za-z0-9]{8,24}$'),
  store_id uuid not null references public.stores(id) on delete cascade,
  frame_id uuid references public.frames(id) on delete set null,
  front_path text not null,
  side_path text,
  face_shape text,
  customer_name text,
  created_at timestamptz not null default now()
);
create index if not exists tryon_shares_store_id_idx on public.tryon_shares(store_id);
grant insert on public.tryon_shares to anon;
grant select, insert on public.tryon_shares to authenticated;
grant all on public.tryon_shares to service_role;
alter table public.tryon_shares enable row level security;

drop policy if exists "anyone creates shares" on public.tryon_shares;
create policy "anyone creates shares" on public.tryon_shares for insert to anon, authenticated
  with check (public.store_is_live(store_id));
drop policy if exists "owner reads shares" on public.tryon_shares;
create policy "owner reads shares" on public.tryon_shares for select to authenticated
  using (public.owns_store(store_id) or public.has_role(auth.uid(), 'super_admin'));

create table if not exists public.share_votes (
  id uuid primary key default gen_random_uuid(),
  share_id text not null references public.tryon_shares(id) on delete cascade,
  vote text not null check (vote in ('love','good','another')),
  voter_name text check (char_length(voter_name) <= 40),
  comment text check (char_length(comment) <= 280),
  created_at timestamptz not null default now()
);
create index if not exists share_votes_share_id_idx on public.share_votes(share_id);
grant insert on public.share_votes to anon;
grant select, insert on public.share_votes to authenticated;
grant all on public.share_votes to service_role;
alter table public.share_votes enable row level security;

drop policy if exists "anyone votes" on public.share_votes;
create policy "anyone votes" on public.share_votes for insert to anon, authenticated with check (true);
drop policy if exists "owner reads votes" on public.share_votes;
create policy "owner reads votes" on public.share_votes for select to authenticated
  using (exists (select 1 from public.tryon_shares t where t.id = share_id and (public.owns_store(t.store_id) or public.has_role(auth.uid(),'super_admin'))));

create or replace function public.get_tryon_share(_id text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'id', t.id, 'front_path', t.front_path, 'side_path', t.side_path, 'face_shape', t.face_shape,
    'customer_name', t.customer_name, 'created_at', t.created_at,
    'store', json_build_object('slug', s.slug, 'name', s.name, 'brand_color', s.brand_color, 'whatsapp_number', s.whatsapp_number, 'logo_path', s.logo_path),
    'frame', case when f.id is null then null else json_build_object('id', f.id, 'name', f.name, 'sku', f.sku, 'price', f.price, 'shape', f.shape, 'frame_color', f.frame_color, 'lens_tint', f.lens_tint, 'kind', f.kind, 'image_path', f.image_path) end,
    'votes', (select coalesce(json_object_agg(v.vote, v.c), '{}'::json) from (select vote, count(*) c from public.share_votes where share_id = t.id group by vote) v),
    'comments', (select coalesce(json_agg(json_build_object('name', c.voter_name, 'comment', c.comment, 'vote', c.vote, 'created_at', c.created_at) order by c.created_at desc), '[]'::json)
                 from (select * from public.share_votes where share_id = t.id and comment is not null and comment <> '' order by created_at desc limit 50) c)
  )
  from public.tryon_shares t join public.stores s on s.id = t.store_id
  left join public.frames f on f.id = t.frame_id
  where t.id = _id
$$;
grant execute on function public.get_tryon_share(text) to anon, authenticated;

-- EVENTS
create table if not exists public.tryon_events (
  id bigint generated always as identity primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  frame_id uuid references public.frames(id) on delete set null,
  event text not null check (event in ('view','try_on','share','whatsapp','face_scan')),
  face_shape text,
  created_at timestamptz not null default now()
);
create index if not exists tryon_events_store_id_created_at_idx on public.tryon_events(store_id, created_at);
grant insert on public.tryon_events to anon;
grant select, insert on public.tryon_events to authenticated;
grant all on public.tryon_events to service_role;
alter table public.tryon_events enable row level security;

drop policy if exists "anyone logs events" on public.tryon_events;
create policy "anyone logs events" on public.tryon_events for insert to anon, authenticated
  with check (public.store_is_live(store_id));
drop policy if exists "owner reads events" on public.tryon_events;
create policy "owner reads events" on public.tryon_events for select to authenticated
  using (public.owns_store(store_id) or public.has_role(auth.uid(), 'super_admin'));

-- CONSULTATIONS
create table if not exists public.consultation_requests (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  frame_id uuid references public.frames(id) on delete set null,
  share_id text references public.tryon_shares(id) on delete set null,
  lens_config jsonb not null default '{}',
  total_price numeric(10,2) not null default 0,
  prescription_path text,
  customer_note text check (char_length(customer_note) <= 500),
  status text not null default 'new' check (status in ('new','contacted','done')),
  created_at timestamptz not null default now()
);
create index if not exists consultation_requests_store_id_created_at_idx on public.consultation_requests(store_id, created_at);
grant insert on public.consultation_requests to anon;
grant select, insert, update on public.consultation_requests to authenticated;
grant all on public.consultation_requests to service_role;
alter table public.consultation_requests enable row level security;

drop policy if exists "anyone creates consultation" on public.consultation_requests;
create policy "anyone creates consultation" on public.consultation_requests for insert to anon, authenticated
  with check (public.store_is_live(store_id) and status = 'new');
drop policy if exists "owner reads consultations" on public.consultation_requests;
create policy "owner reads consultations" on public.consultation_requests for select to authenticated
  using (public.owns_store(store_id) or public.has_role(auth.uid(), 'super_admin'));
drop policy if exists "owner updates consultations" on public.consultation_requests;
create policy "owner updates consultations" on public.consultation_requests for update to authenticated
  using (public.owns_store(store_id)) with check (public.owns_store(store_id));

-- INVOICES
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  plan_id uuid references public.plans(id) on delete set null,
  amount numeric(10,2) not null,
  currency text not null default 'EGP',
  months integer not null default 1 check (months between 1 and 24),
  status text not null default 'paid' check (status in ('pending','paid','void')),
  method text not null default 'bank_transfer',
  reference text not null default '',
  notes text not null default '',
  paid_at timestamptz default now(),
  created_at timestamptz not null default now()
);
create index if not exists invoices_store_id_idx on public.invoices(store_id);
grant select, insert, update, delete on public.invoices to authenticated;
grant all on public.invoices to service_role;
alter table public.invoices enable row level security;

drop policy if exists "owner reads invoices" on public.invoices;
create policy "owner reads invoices" on public.invoices for select to authenticated
  using (public.owns_store(store_id) or public.has_role(auth.uid(), 'super_admin'));
drop policy if exists "super admin manages invoices" on public.invoices;
create policy "super admin manages invoices" on public.invoices for all to authenticated
  using (public.has_role(auth.uid(), 'super_admin')) with check (public.has_role(auth.uid(), 'super_admin'));

-- STORAGE POLICIES
drop policy if exists "read store assets" on storage.objects;
create policy "read store assets" on storage.objects for select to anon, authenticated
  using (bucket_id = 'store-assets');
drop policy if exists "owner uploads store assets" on storage.objects;
create policy "owner uploads store assets" on storage.objects for insert to authenticated
  with check (bucket_id = 'store-assets' and public.owns_store(((storage.foldername(name))[1])::uuid));
drop policy if exists "owner updates store assets" on storage.objects;
create policy "owner updates store assets" on storage.objects for update to authenticated
  using (bucket_id = 'store-assets' and public.owns_store(((storage.foldername(name))[1])::uuid));
drop policy if exists "owner deletes store assets" on storage.objects;
create policy "owner deletes store assets" on storage.objects for delete to authenticated
  using (bucket_id = 'store-assets' and public.owns_store(((storage.foldername(name))[1])::uuid));

drop policy if exists "read tryon images" on storage.objects;
create policy "read tryon images" on storage.objects for select to anon, authenticated
  using (bucket_id = 'tryon');
drop policy if exists "anyone uploads tryon images" on storage.objects;
create policy "anyone uploads tryon images" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'tryon' and public.store_is_live(((storage.foldername(name))[1])::uuid));

drop policy if exists "anyone uploads prescriptions" on storage.objects;
create policy "anyone uploads prescriptions" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'prescriptions' and public.store_is_live(((storage.foldername(name))[1])::uuid));
drop policy if exists "owner reads prescriptions" on storage.objects;
create policy "owner reads prescriptions" on storage.objects for select to authenticated
  using (bucket_id = 'prescriptions' and (public.owns_store(((storage.foldername(name))[1])::uuid) or public.has_role(auth.uid(),'super_admin')));

-- SEED (idempotent)
insert into public.plans (name, description, price_monthly, frame_limit, features, is_featured, sort_order)
values
 ('البداية', 'لمحل واحد يبدأ رحلته الرقمية', 299, 40, array['متجر إلكتروني بلينك خاص','تجربة افتراضية بالكاميرا','زر واتساب للاستشارة','حتى 40 نظارة'], false, 1),
 ('الاحترافية', 'الأكثر طلباً لمحلات البصريات', 599, 200, array['كل مميزات البداية','تحليل شكل الوجه ونسبة التطابق','روابط مشاركة وتصويت الأصدقاء','إحصائيات التجربة والإطارات الأشهر','حتى 200 نظارة'], true, 2),
 ('المؤسسات', 'لسلاسل المحلات والعلامات التجارية', 1299, 2000, array['كل مميزات الاحترافية','حتى 2000 نظارة','رفع نماذج 3D مخصصة','دعم أولوية'], false, 3)
on conflict do nothing;

insert into public.stores (id, owner_id, slug, name, tagline, brand_color, whatsapp_number, status, plan_id, subscription_expires_at)
values ('00000000-0000-4000-a000-000000000001', null, 'demo', 'بصريات النخبة', 'نظارات أصلية بلمسة فاخرة — القاهرة', '#B8924A', '201000000000', 'active',
  (select id from public.plans where sort_order = 2), null)
on conflict (id) do nothing;

insert into public.frames (store_id, name, sku, description, category, kind, shape, material, price, frame_color, lens_tint, suits_face_shapes) values
 ('00000000-0000-4000-a000-000000000001','ليوناردو','NKH-101','إطار أسيتات مربع بحواف ناعمة، يمنح الوجه ملامح واثقة.','men','optical','square','acetate',2450,'#2a1a12',null,array['round','oval','heart']),
 ('00000000-0000-4000-a000-000000000001','سيرين','NKH-102','عين القطة الكلاسيكية بلون الهافانا الدافئ.','women','optical','cat_eye','acetate',2650,'#6b3a1f',null,array['heart','oval','square','diamond']),
 ('00000000-0000-4000-a000-000000000001','أتلس','NKH-103','إطار تيتانيوم دائري خفيف جداً بلون ذهبي شامبين.','unisex','optical','round','titanium',3900,'#c9a45c',null,array['square','diamond','heart']),
 ('00000000-0000-4000-a000-000000000001','فالكون','NKH-104','نظارة طيار شمسية بعدسات متدرجة.','men','sunglasses','aviator','metal',3200,'#b08d57','#3d4a3a',array['oval','square','heart']),
 ('00000000-0000-4000-a000-000000000001','نور','NKH-105','إطار بيضاوي ناعم بلون الشمبانيا الشفاف.','women','optical','oval','acetate',2100,'#d8c3a5',null,array['square','diamond','heart']),
 ('00000000-0000-4000-a000-000000000001','أوكسفورد','NKH-106','إطار مستطيل رفيع للعمل والإطلالة الرسمية.','men','optical','rectangle','tr90',1750,'#111111',null,array['round','oval']),
 ('00000000-0000-4000-a000-000000000001','ريفييرا','NKH-107','نظارة شمسية بعين القطة بعدسات بنية.','women','sunglasses','cat_eye','acetate',2950,'#1d1410','#5a3a22',array['heart','oval','square']),
 ('00000000-0000-4000-a000-000000000001','هكس','NKH-108','إطار هندسي سداسي معدني بطابع عصري.','unisex','optical','geometric','metal',2800,'#8c8c8c',null,array['round','oval','square']),
 ('00000000-0000-4000-a000-000000000001','كلوبمان','NKH-109','إطار براولاين كلاسيكي بحاجب أسيتات ومعدن ذهبي.','men','optical','browline','metal',2700,'#2b1d14',null,array['round','oval','diamond','heart']),
 ('00000000-0000-4000-a000-000000000001','بيبو','NKH-110','إطار دائري مرن ومريح للأطفال.','kids','optical','round','tr90',950,'#2f6f8f',null,array['square','oval','round']),
 ('00000000-0000-4000-a000-000000000001','صحارى','NKH-111','نظارة شمسية مربعة كبيرة بعدسات داكنة.','unisex','sunglasses','square','acetate',2350,'#3b2a20','#222222',array['round','oval','diamond']),
 ('00000000-0000-4000-a000-000000000001','ميرا','NKH-112','إطار دائري رفيع للبنات بلون وردي ناعم.','kids','optical','oval','tr90',890,'#c98a9a',null,array['square','diamond','oval'])
on conflict do nothing;
