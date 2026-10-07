-- The two demo posts predate map locations; place them on the Lawn, next to
-- the posts that default to it.
update public.posts
set location = 'Lawn'
where generation_id is null and location is null;
