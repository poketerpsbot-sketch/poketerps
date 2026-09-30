-- Allow moderators to use the normal fiche creation workflow without granting
-- administration, publication, or ownership-wide entry permissions.
insert into public.role_permissions(role, permission_code)
values
  ('MODERATOR', 'entry.create'),
  ('MODERATOR', 'entry.update.own'),
  ('MODERATOR', 'storage.upload.entry')
on conflict do nothing;
