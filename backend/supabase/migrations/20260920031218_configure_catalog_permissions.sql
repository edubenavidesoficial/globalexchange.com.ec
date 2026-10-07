-- =====================================================
-- CATALOG DATA API PERMISSIONS
-- =====================================================
-- The backend accesses these tables using the Supabase
-- secret key, which operates as service_role.
--
-- Public browser access is intentionally NOT granted.
-- The Vite frontend will access catalog data through
-- our Express API.
-- =====================================================
-- PROGRAMS
grant
select
,
insert
,
update
,
    delete on table public.programs to service_role;

-- DESTINATIONS
grant
select
,
insert
,
update
,
    delete on table public.destinations to service_role;

-- PROGRAM DESTINATIONS
grant
select
,
insert
,
update
,
    delete on table public.program_destinations to service_role;

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
alter table
    public.programs enable row level security;

alter table
    public.destinations enable row level security;

alter table
    public.program_destinations enable row level security;