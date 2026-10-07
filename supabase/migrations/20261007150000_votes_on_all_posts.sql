-- Allow voting on every post, including the original seed memes that predate AI
-- caption generation (posts.generation_id IS NULL).
--
-- The `own_vote_insert` policy previously required the target post to have a
-- generation_id. The select/update/delete policies already allow any post, and
-- private.update_vote_score() updates posts.score for every post, so only the
-- insert policy needs to change.

drop policy if exists "own_vote_insert" on public.votes;

create policy "own_vote_insert"
  on public.votes
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));
