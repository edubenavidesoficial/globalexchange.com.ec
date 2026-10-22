BEGIN;

-- ascii(text) returns Unicode code points only under UTF8.
DO $encoding$
BEGIN
    IF pg_catalog.current_setting('server_encoding') <> 'UTF8' THEN
        RAISE EXCEPTION 'meeting_context_schema requires server_encoding UTF8';
    END IF;
END;
$encoding$;

CREATE FUNCTION public.utf16_length(p_value text)
RETURNS bigint
LANGUAGE SQL
IMMUTABLE
STRICT
PARALLEL SAFE
SECURITY INVOKER
SET search_path = pg_catalog, pg_temp
AS $utf16$
    SELECT COALESCE(pg_catalog.sum(
        CASE WHEN pg_catalog.ascii(code_point) > 65535 THEN 2 ELSE 1 END
    ), 0::bigint)
    FROM pg_catalog.regexp_split_to_table(p_value, '') AS characters(code_point)
    WHERE code_point <> '';
$utf16$;

REVOKE ALL PRIVILEGES ON FUNCTION public.utf16_length(text)
    FROM public, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.utf16_length(text) TO service_role;

-- Legacy writers omit these columns; historical attribution remains unknown.
ALTER TABLE public.meetings ADD COLUMN booked_by uuid NULL;
ALTER TABLE public.meetings ADD COLUMN role_at_booking text NULL;
ALTER TABLE public.meetings ADD COLUMN booking_attribution_source text NOT NULL DEFAULT 'unknown';
ALTER TABLE public.meetings ADD COLUMN schedule_revision integer NOT NULL DEFAULT 1;

ALTER TABLE public.meetings ADD CONSTRAINT meetings_booked_by_fkey
    FOREIGN KEY (booked_by) REFERENCES public.internal_users(id)
    ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE public.meetings ADD CONSTRAINT meetings_role_at_booking_valid
    CHECK (role_at_booking IS NULL OR role_at_booking IN ('admin', 'agendadora'));

ALTER TABLE public.meetings ADD CONSTRAINT meetings_booking_attribution_source_valid
    CHECK (booking_attribution_source IN (
        'unknown', 'explicit', 'verified_backfill', 'administrative_correction'
    ));

ALTER TABLE public.meetings ADD CONSTRAINT meetings_booking_attribution_consistent
    CHECK (
        (booking_attribution_source = 'unknown'
            AND booked_by IS NULL AND role_at_booking IS NULL)
        OR (booking_attribution_source IN ('explicit', 'verified_backfill', 'administrative_correction')
            AND booked_by IS NOT NULL AND role_at_booking IS NOT NULL)
    );

-- Revision advances only after writers are adapted in a later phase.
ALTER TABLE public.meetings ADD CONSTRAINT meetings_schedule_revision_positive
    CHECK (schedule_revision > 0);

-- Fully validated: incompatible existing notes abort this whole transaction.
-- A remote data precheck is required before deployment; no data is rewritten here.
ALTER TABLE public.meetings ADD CONSTRAINT meetings_notes_utf16_length_valid
    CHECK (notes IS NULL OR public.utf16_length(notes) <= 2000);

CREATE INDEX meetings_booked_by_scheduled_at_idx
    ON public.meetings USING btree (booked_by, scheduled_at);

COMMIT;
