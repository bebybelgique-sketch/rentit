-- Migration 32: allow deleting a referrer without deleting referred users.
-- The self-referencing foreign key previously blocked account deletion when
-- another account still pointed at the deleted user as its referrer.
-- SET NULL preserves the referred account and removes only the stale link.
-- Verification: pg_constraint.confdeltype = 'n'. Rollback restores the
-- default NO ACTION constraint.

alter table public.users
  drop constraint users_referred_by_fkey;

alter table public.users
  add constraint users_referred_by_fkey
  foreign key (referred_by) references public.users(id)
  on delete set null;
