create extension if not exists pgcrypto;

-- =====================================================
-- PROGRAMS
-- =====================================================
create table public.programs (
    id uuid primary key default gen_random_uuid(),
    code text not null unique,
    name text not null,
    slug text not null unique,
    category text,
    description text,
    image_path text,
    page_url text,
    color text,
    destination_mode text not null default 'review',
    age_mode text not null default 'operational',
    age_min integer,
    age_max integer,
    age_verified boolean not null default false,
    include_in_finder boolean not null default true,
    priority integer not null default 0,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint programs_destination_mode_valid check (
        destination_mode in (
            'known',
            'review'
        )
    ),
    constraint programs_age_mode_valid check (
        age_mode in (
            'known',
            'operational',
            'destination'
        )
    ),
    constraint programs_age_min_positive check (
        age_min is null
        or age_min >= 0
    ),
    constraint programs_age_max_positive check (
        age_max is null
        or age_max >= 0
    ),
    constraint programs_age_range_valid check (
        age_min is null
        or age_max is null
        or age_min <= age_max
    )
);

-- =====================================================
-- DESTINATIONS
-- =====================================================
create table public.destinations (
    id uuid primary key default gen_random_uuid(),
    code text not null unique,
    name text not null,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- =====================================================
-- PROGRAM ↔ DESTINATION
-- =====================================================
create table public.program_destinations (
    program_id uuid not null references public.programs(id) on delete cascade,
    destination_id uuid not null references public.destinations(id) on delete cascade,
    age_min integer,
    age_max integer,
    age_verified boolean not null default false,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    primary key (
        program_id,
        destination_id
    ),
    constraint program_destinations_age_min_positive check (
        age_min is null
        or age_min >= 0
    ),
    constraint program_destinations_age_max_positive check (
        age_max is null
        or age_max >= 0
    ),
    constraint program_destinations_age_range_valid check (
        age_min is null
        or age_max is null
        or age_min <= age_max
    )
);

-- =====================================================
-- INDEXES
-- =====================================================
create index programs_active_idx on public.programs(active);

create index programs_priority_idx on public.programs(priority);

create index destinations_active_idx on public.destinations(active);

create index program_destinations_program_idx on public.program_destinations(program_id);

create index program_destinations_destination_idx on public.program_destinations(destination_id);