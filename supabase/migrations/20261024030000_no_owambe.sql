-- Drop "owambe" wording: the site is December-only (Christmas → crossover). Safe to re-run.
update public.occasions set blurb = 'Make the grand entrance'
where slug = 'wedding-entrance' and blurb = 'Light up the owambe';

update public.products set name = 'Crossover King 49', slug = 'crossover-king-49',
  description = replace(description, 'Owambe King 49', 'Crossover King 49')
where slug = 'owambe-king-49';

update public.bundles set name = 'Christmas Party Pack', slug = 'christmas-party-pack',
  tagline = 'Colour for the Christmas compound'
where slug = 'owambe-pack';

update public.banners set title = 'Christmas in the compound? We dey for you',
  subtitle = 'Sparklers, smoke and cold sparks for Christmas Day and Boxing Day.',
  cta = 'Christmas effects', href = '/shop?occasion=christmas'
where title = 'Owambe season? We dey for you';

-- orders.code references discount_codes without ON UPDATE CASCADE, so copy → repoint → delete.
insert into public.discount_codes (code, pct, active, uses)
select 'XMAS5', pct, active, uses from public.discount_codes where code = 'OWAMBE5'
on conflict (code) do nothing;
update public.orders set code = 'XMAS5' where code = 'OWAMBE5';
delete from public.discount_codes where code = 'OWAMBE5';
