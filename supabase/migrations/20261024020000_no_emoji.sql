-- No emojis anywhere on the site (owner rule). Occasion icons are now lucide components in the UI.
update public.occasions set emoji = '';
update public.campaign_settings
set announcement = regexp_replace(announcement, '^\s*🎆\s*', '');
