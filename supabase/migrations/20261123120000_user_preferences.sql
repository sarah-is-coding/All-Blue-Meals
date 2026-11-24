-- User preferences, on the user's profile row (one per user; RLS already
-- limits it to its owner: "Users manage own profiles"). The app creates the
-- row the first time preferences are saved, and treats a missing row as the
-- defaults below, which match how the app behaved before preferences existed.

alter table public.profiles
  -- The first day of the week: 0 = Sunday, 1 = Monday.
  add column week_starts_on smallint not null default 0
    check (week_starts_on in (0, 1)),
  -- How much the user usually plans at once ("1 week", "2 weeks", "1 month",
  -- "10 days"). The app limits the count per unit (up to 90 days, 12 weeks or
  -- 3 months); the database only keeps it in a sane range.
  add column plan_cadence_unit text not null default 'week'
    check (plan_cadence_unit in ('day', 'week', 'month')),
  add column plan_cadence_count smallint not null default 1
    check (plan_cadence_count between 1 and 90);
