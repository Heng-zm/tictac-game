-- Supabase exposes the public schema through its Data API (PostgREST) by
-- default. This app never accesses PostgreSQL from the browser: the Node
-- server connects with the database owner role. Enable RLS on every game table
-- and remove Data API grants from Supabase's anonymous/authenticated roles so
-- a leaked anon key cannot read or mutate game data.
--
-- The owner role used by Prisma bypasses RLS (FORCE ROW LEVEL SECURITY is not
-- set), so server queries continue to work. Local PostgreSQL installations do
-- not have the anon/authenticated roles; those blocks are skipped.

DO $$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'User',
    'UserStats',
    'Match',
    'MatchParticipant',
    'Move',
    'Invitation'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target_table);
  END LOOP;
END
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon';
    EXECUTE 'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated';
    EXECUTE 'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM authenticated';
  END IF;
END
$$;
