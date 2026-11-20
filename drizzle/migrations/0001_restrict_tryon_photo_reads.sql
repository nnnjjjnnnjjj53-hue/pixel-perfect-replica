drop policy if exists "read tryon images" on storage.objects;
create policy "owner reads tryon images" on storage.objects for select to authenticated
  using (bucket_id = 'tryon' and (public.owns_store(((storage.foldername(name))[1])::uuid) or public.has_role(auth.uid(),'super_admin')));