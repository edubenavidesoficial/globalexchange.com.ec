-- Solicitudes de asesoria: fecha y hora son preferencias, no reuniones confirmadas.
begin;

-- =====================================================
-- CONSULTATION REQUESTS
-- =====================================================
create table public.consultation_requests (
    id uuid primary key default gen_random_uuid(),
    program_id uuid not null references public.programs(id) on delete restrict,
    full_name text not null,
    phone text not null,
    email text,
    city text not null,
    mode text not null,
    preferred_date date not null,
    preferred_time time not null,
    message text,
    status text not null default 'pending',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint consultation_requests_mode_valid check (
        mode in ('online', 'phone', 'office')
    ),
    constraint consultation_requests_status_valid check (
        status in ('pending', 'converted', 'cancelled')
    )
);

-- =====================================================
-- INDEXES
-- =====================================================
create index consultation_requests_program_id_idx on public.consultation_requests(program_id);

create index consultation_requests_status_idx on public.consultation_requests(status);

create index consultation_requests_preferred_date_idx on public.consultation_requests(preferred_date);

-- =====================================================
-- ROW LEVEL SECURITY AND DATA API PERMISSIONS
-- =====================================================
-- El frontend accede mediante Express; la clave secreta permanece en el backend.
alter table public.consultation_requests enable row level security;

revoke all privileges on table public.consultation_requests from public, anon, authenticated;

grant select, insert, update, delete on table public.consultation_requests to service_role;

commit;
