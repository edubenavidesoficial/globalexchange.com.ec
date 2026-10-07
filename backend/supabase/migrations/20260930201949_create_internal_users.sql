-- Usuarios internos: desactivar registros permite conservar la trazabilidad.
begin;

-- =====================================================
-- INTERNAL USERS
-- =====================================================
-- La identidad pertenece a Auth; el backend actualizara updated_at.
create table public.internal_users (
    id uuid primary key references auth.users(id) on delete restrict,
    full_name text not null,
    role text not null,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint internal_users_full_name_not_blank check (
        length(trim(full_name)) > 0
    ),
    constraint internal_users_role_valid check (
        role in ('admin', 'agendadora', 'vendedora')
    )
);

-- =====================================================
-- ROW LEVEL SECURITY AND DATA API PERMISSIONS
-- =====================================================
-- El acceso operativo se realizara mediante Express, no desde el navegador.
alter table public.internal_users enable row level security;

revoke all privileges on table public.internal_users from public, anon, authenticated;

grant select, insert, update, delete on table public.internal_users to service_role;

commit;
