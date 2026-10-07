-- Give posts a direct owner so every post — including the original seed memes
-- that have no generation — can be managed by its author.
--
-- New posts default user_id to the signed-in user; existing posts are backfilled
-- from their generation, then the two seed memes are assigned to the account
-- below.

alter table public.posts add column if not exists user_id uuid default auth.uid() references auth.users(id) on delete set null;

update public.posts p set user_id = g.user_id
from public.generations g
where p.generation_id = g.id and p.user_id is null;

update public.posts set user_id = 'f3c5c0c0-11d0-4d34-8be0-fea52e04368c'
where generation_id is null and user_id is null;

drop policy if exists "update_own_post" on public.posts;
create policy "update_own_post"
  on public.posts for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "delete_own_post" on public.posts;
create policy "delete_own_post"
  on public.posts for delete to authenticated
  using (user_id = (select auth.uid()));

grant select (user_id) on public.posts to authenticated;
