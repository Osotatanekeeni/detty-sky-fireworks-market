-- Reference data. Products, bundles and reviews are seeded by scripts/seed-products.ts
-- (to be written in Phase 1) from src/lib/data.ts so the mock catalogue carries over.
insert into public.categories (slug, name, blurb, sort) values
  ('aerial-cakes', 'Aerial Cakes', 'One light, endless sky', 1),
  ('rockets', 'Rockets', 'Straight to the clouds', 2),
  ('fountains', 'Fountains', 'Golden ground showers', 3),
  ('sparklers', 'Sparklers', 'Handheld magic', 4),
  ('smoke-colour', 'Smoke & Colour', 'Photo-ready clouds', 5),
  ('confetti-cannons', 'Confetti Cannons', 'Pop the moment', 6),
  ('wedding-party', 'Wedding & Party Effects', 'Grand entrances', 7);

insert into public.occasions (slug, name, blurb, emoji, sort) values
  ('christmas', 'Christmas', 'Make your December detty', '', 1),
  ('new-year', 'New Year Countdown', '3, 2, 1… light am!', '', 2),
  ('wedding-entrance', 'Wedding Entrance', 'Make the grand entrance', '', 3),
  ('birthday', 'Birthday', 'Another year, more sparkle', '', 4),
  ('church-crossover', 'Church Crossover Night', 'Cross over in glory', '', 5);

insert into public.delivery_cities (state, name, fee_kobo, days) values
  ('Rivers', 'Port Harcourt', 250000, 1), ('Rivers', 'Obio/Akpor', 250000, 1), ('Rivers', 'Bonny', 700000, 4), ('Rivers', 'Eleme', 350000, 2),
  ('Akwa Ibom', 'Uyo', 350000, 2), ('Akwa Ibom', 'Eket', 450000, 3), ('Akwa Ibom', 'Ikot Ekpene', 450000, 3),
  ('Bayelsa', 'Yenagoa', 400000, 2), ('Bayelsa', 'Brass', 800000, 5), ('Bayelsa', 'Ogbia', 500000, 3),
  ('Cross River', 'Calabar', 450000, 2), ('Cross River', 'Ikom', 600000, 4), ('Cross River', 'Ogoja', 650000, 4),
  ('Delta', 'Warri', 400000, 2), ('Delta', 'Asaba', 450000, 2), ('Delta', 'Sapele', 500000, 3), ('Delta', 'Ughelli', 500000, 3),
  ('Edo', 'Benin City', 450000, 2), ('Edo', 'Auchi', 600000, 4), ('Edo', 'Ekpoma', 550000, 3);

insert into public.discount_codes (code, pct, active) values ('DETTY10', 10, true), ('XMAS5', 5, true);

update public.campaign_settings set
  announcement = 'December pre-orders are open — secure your crossover stock',
  preorders_open = true,
  countdown_label = 'Countdown to New Year · pre-orders close soon'
where id = 1;
