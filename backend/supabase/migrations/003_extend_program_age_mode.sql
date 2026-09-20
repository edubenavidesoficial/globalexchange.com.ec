-- Admitir edades pendientes de confirmación sin alterar otros constraints.
begin;

alter table public.programs
    drop constraint if exists programs_age_mode_valid;

alter table public.programs
    add constraint programs_age_mode_valid
    check (age_mode in ('known', 'operational', 'destination', 'review'));

commit;
