begin;

-- Les slugs et attributions existantes restent intacts : seule l'identité visuelle évolue.
update public.badges
set image_url = case slug
  when 'role-owner' then '/badges/v2/role-owner.webp'
  when 'role-admin' then '/badges/v2/role-admin.webp'
  when 'role-moderator' then '/badges/v2/role-moderator.webp'
  when 'role-editor' then '/badges/v2/role-editor.svg'
  when 'trainer-of-the-week' then '/badges/v2/trainer-of-the-week.svg'
  when 'trainer-of-the-month' then '/badges/v2/trainer-of-the-month.svg'
  when 'capture-streak' then '/badges/v2/capture-streak.svg'
  when 'top-trainer' then '/badges/v2/top-trainer.svg'
  when 'historic-contributor' then '/badges/v2/historic-contributor.svg'
  when 'first-review' then '/badges/v2/first-review.svg'
  when 'captures-10' then '/badges/v2/captures-10.svg'
  when 'captures-50' then '/badges/v2/captures-50.svg'
  when 'captures-100' then '/badges/v2/captures-100.svg'
  when 'contest-winner' then '/badges/v2/contest-winner.svg'
  when 'level-1' then '/badges/v2/level-1.svg'
  when 'level-5' then '/badges/v2/level-5.svg'
  when 'level-10' then '/badges/v2/level-10.svg'
  when 'level-15' then '/badges/v2/level-15.svg'
  when 'partner' then '/badges/v2/partner.svg'
  else image_url
end,
updated_at = now()
where slug in (
  'role-owner','role-admin','role-moderator','role-editor',
  'trainer-of-the-week','trainer-of-the-month','capture-streak','top-trainer',
  'historic-contributor','first-review','captures-10','captures-50','captures-100',
  'contest-winner','level-1','level-5','level-10','level-15','partner'
);

commit;
