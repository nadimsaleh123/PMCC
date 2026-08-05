-- PASTE 10 — the Brief: one page of plain text, assembled from the record,
-- written every morning and kept. Run once in the Supabase SQL editor.
--
-- Briefs are stored rather than rendered on demand for the same reason
-- alerts.yaml is committed: "you were told this, on this date" is itself
-- evidence. A brief read on Tuesday must still read the same in December,
-- even after the programme has moved three times since.

create table if not exists public.briefs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  generated_at timestamptz not null default now(),
  -- 'day' or 'week': the window the brief covers, bounded by real
  -- timestamps in the record rather than by wall-clock guessing.
  period text not null default 'day' check (period in ('day', 'week')),
  period_from timestamptz,
  period_to timestamptz not null default now(),

  -- THE LINE: the one sentence at the top, the only prose the model writes.
  headline text not null default '',
  -- Where that line came from. 'model' = written by the LLM and it passed
  -- verification. 'fallback' = the LLM was unavailable, refused, or its
  -- draft failed the digit gate, so the deterministic line was used.
  -- The distinction is on the page, not hidden: a reader is entitled to
  -- know whether a machine phrased what they are reading.
  headline_source text not null default 'fallback'
    check (headline_source in ('model', 'fallback')),
  headline_draft text not null default '',   -- what the model actually returned, kept even when rejected
  violations jsonb not null default '[]',    -- why it was rejected, if it was

  -- The body: sections of deterministic, code-rendered sentences. The model
  -- never sees this and cannot shorten it.
  sections jsonb not null default '[]',
  -- Every numbered fact the brief was built from, verbatim. This is what
  -- makes a stored brief auditable: you can always show what it was given.
  facts jsonb not null default '[]',
  -- Counts for the footer line, so the page never has to recount.
  stats jsonb not null default '{}'
);

create index if not exists briefs_project_idx on briefs (project_id, generated_at desc);

alter table briefs enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'briefs' and policyname = 'team all briefs') then
    create policy "team all briefs" on briefs for all using (is_team()) with check (is_team());
  end if;
end $$;

-- When the team last opened the Brief, per person. Drives the "since you
-- last read this" boundary, which is the difference between a page you
-- check and a page you skim.
alter table profiles add column if not exists brief_seen_at timestamptz;
