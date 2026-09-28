-- KOTHARI HYUNDAI - CLEAN USER/RBAC SETUP
-- Username + Password only.
-- No phone number, no OTP, no password-reset email.
-- Run after your existing vehicle inventory tables are present.

create extension if not exists pgcrypto;

-- Roles
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now()
);

insert into public.roles(name, description) values
('Admin', 'Full System, Users, Roles, Permissions, Settings'),
('Accounts', 'Vehicle Stock, Purchase Import, Order Import, Finance Reports, Inventory, Gate, Delivery, All Reports'),
('Gate Operator', 'Vehicle In/Out, Gate Pass, In-Out Register'),
('Viewer', 'Dashboard and Reports only')
on conflict (name) do update
set description = excluded.description;

-- User profile: only fields actually needed by the website
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  full_name text,
  role_id uuid references public.roles(id),
  location_id uuid references public.locations(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles
  add column if not exists username text;

alter table public.user_profiles
  add column if not exists full_name text;

alter table public.user_profiles
  add column if not exists role_id uuid references public.roles(id);

alter table public.user_profiles
  add column if not exists location_id uuid references public.locations(id);

alter table public.user_profiles
  add column if not exists active boolean default true;

alter table public.user_profiles
  add column if not exists created_at timestamptz default now();

alter table public.user_profiles
  add column if not exists updated_at timestamptz default now();

-- Remove old phone field/index from the previous OTP design
drop index if exists public.user_profiles_phone_uidx;
alter table public.user_profiles drop column if exists phone;

create unique index if not exists user_profiles_username_uidx
on public.user_profiles(lower(username));

-- Admin helper
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.user_profiles up
    join public.roles r on r.id = up.role_id
    where up.id = auth.uid()
      and up.active = true
      and lower(r.name) = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- RLS
alter table public.user_profiles enable row level security;
alter table public.roles enable row level security;

drop policy if exists "user_profiles_read_own" on public.user_profiles;
create policy "user_profiles_read_own"
on public.user_profiles
for select
to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "user_profiles_admin_all" on public.user_profiles;
create policy "user_profiles_admin_all"
on public.user_profiles
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "roles_read_authenticated" on public.roles;
create policy "roles_read_authenticated"
on public.roles
for select
to authenticated
using (true);

drop policy if exists "roles_admin_write" on public.roles;
create policy "roles_admin_write"
on public.roles
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Updated timestamp
create or replace function public.set_user_profiles_updated_at()
returns trigger
language plpgsql
security invoker
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_profiles_updated_at
on public.user_profiles;

create trigger trg_user_profiles_updated_at
before update on public.user_profiles
for each row
execute function public.set_user_profiles_updated_at();

-- NOTE:
-- The first Admin must be bootstrapped once by creating a Supabase Auth user
-- and inserting its matching user_profiles row with the Admin role.
-- After that, Admin can create all other users from the website.
