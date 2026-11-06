begin;

-- Application tables in public have no anon/PUBLIC RLS policies.
-- Remove the default table grants from anon; RLS does not govern TRUNCATE.
revoke all privileges on all tables in schema public from anon;

-- Prevent future public tables created by postgres from inheriting anon grants.
alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon;

commit;
