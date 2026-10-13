# Site Administration

Only accounts explicitly listed in `public.site_admins` can use the administrator panel. Admins can upload one self-contained HTML lesson file (up to 5 MB) and disable or reactivate non-admin student accounts. The website never receives a service-role key.

## Enable the admin features

1. In the Supabase SQL Editor, run `supabase/admin-schema.sql` once, after the student account schema is installed. This creates the private administrator and disabled-account tables, the public chapter catalog and Storage bucket, and their row-level security policies.
2. Deploy `supabase/functions/admin-tools/index.ts` as an Edge Function named `admin-tools`. Keep JWT verification enabled. The function uses Supabase's built-in `SUPABASE_SERVICE_ROLE_KEY` runtime secret; do not add that key to the website or repository.
3. The site owner and the second administrator must each register with their own email address and confirm the email first.
4. In the SQL Editor, run the following one-time query after replacing both email placeholders. Keep the real addresses in the private dashboard and do not commit them to GitHub:

```sql
do $$
declare
  matched_ids uuid[];
begin
  select array_agg(id)
    into matched_ids
    from auth.users
    where lower(email) in (
      lower('OWNER_EMAIL_HERE'),
      lower('SECOND_ADMIN_EMAIL_HERE')
    )
      and email_confirmed_at is not null;

  if coalesce(array_length(matched_ids, 1), 0) <> 2 then
    raise exception 'Both administrator accounts must exist and have confirmed emails.';
  end if;

  insert into public.site_admins (user_id)
  select unnest(matched_ids)
  on conflict (user_id) do nothing;
end
$$;
```

5. Deploy the website, then both administrators can sign in and open **Account**. The administrator panel lists student emails privately for admins. It never appears to regular students.

The browser can only upload `.html` lesson files, numbered 3–99. Keep each lesson self-contained, including its styles and images. Supabase Storage serves the uploaded lesson publicly for students to read, but its policies only permit approved administrators to upload files. The lesson is shown in a sandboxed frame.

Disabling a student blocks future sign-ins and removes that student's display name and percentage from the progress board. Row-level security also blocks access to their profile and lesson progress. Either administrator can reactivate a student. Administrator accounts cannot be disabled from this panel, and there is no web control for granting new administrator roles; changing the two approved accounts requires the private Supabase SQL Editor.
