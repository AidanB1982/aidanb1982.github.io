-- Read-only lookup. These IDs belong to the protected reader/Author Desk model,
-- not the separate publishing_titles/publishing_editions inventory.
select jsonb_build_object(
  'matching_editions',coalesce((
    select jsonb_agg(to_jsonb(matches)) from (
      select b.id as book_id,b.title,e.id as edition_id,e.edition_name,e.format
      from public.book_records b
      left join public.book_editions e on e.book_id=b.id
      where b.title ilike '%cross%' or e.edition_name ilike '%cross%'
      order by b.id,e.id
    ) matches
  ),'[]'::jsonb),
  'miren_author',coalesce((
    select jsonb_agg(jsonb_build_object('author_id',id,'publishing_name',publishing_name))
    from public.author_records where publishing_name ilike '%miren%'
  ),'[]'::jsonb)
) as crossing_lookup;
