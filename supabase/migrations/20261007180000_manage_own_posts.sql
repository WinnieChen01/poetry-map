-- Let signed-in users manage the posts they created: edit the caption/location
-- and delete the post.
--
-- `posts` has no user_id; ownership is derived from the linked generation, the
-- same source the publish policy already uses. This adds owner-only UPDATE and
-- DELETE policies plus the matching column/table grants.

drop policy if exists "update_own_post" on public.posts;
create policy "update_own_post"
  on public.posts for update to authenticated
  using (exists (
    select 1 from public.generations g
    where g.id = posts.generation_id and g.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.generations g
    where g.id = posts.generation_id and g.user_id = (select auth.uid())
  ));

drop policy if exists "delete_own_post" on public.posts;
create policy "delete_own_post"
  on public.posts for delete to authenticated
  using (exists (
    select 1 from public.generations g
    where g.id = posts.generation_id and g.user_id = (select auth.uid())
  ));

grant update (caption, location) on public.posts to authenticated;
grant delete on public.posts to authenticated;
