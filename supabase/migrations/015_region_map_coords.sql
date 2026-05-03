-- Posição opcional no mapa (sobrescreve sugestão automática por nome da região)

alter table public.regions add column if not exists map_lat double precision null;
alter table public.regions add column if not exists map_lng double precision null;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'regions' and column_name = 'map_lat'
  ) then
    alter table public.regions drop constraint if exists regions_map_lat_check;
    alter table public.regions
      add constraint regions_map_lat_check
      check (map_lat is null or (map_lat >= -90 and map_lat <= 90));
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'regions' and column_name = 'map_lng'
  ) then
    alter table public.regions drop constraint if exists regions_map_lng_check;
    alter table public.regions
      add constraint regions_map_lng_check
      check (map_lng is null or (map_lng >= -180 and map_lng <= 180));
  end if;
end $$;
