-- The situation is optional now. Keep the 500-character cap but allow an empty
-- string, so image-only generations can be saved.
alter table public.generations drop constraint if exists generations_situation_check;
alter table public.generations add constraint generations_situation_check check (length(situation) <= 500);
