# Site Administration

The site has one protected owner account. The owner alone can grant or revoke administrator access. Appointed administrators can upload chapters, hide or restore them, and disable or reactivate student accounts. Permanent chapter deletion is disabled; only the owner can appoint or remove administrators. The website never receives a service-role key.

## Enable the administrator features

1. In the Supabase SQL Editor, run `supabase/admin-schema.sql` once, after the student account schema is installed. This creates private owner, administrator, and disabled-account tables; the public chapter catalog and Storage bucket; and their row-level security policies.
2. Deploy `supabase/functions/admin-tools/index.ts` as an Edge Function named `admin-tools`. Keep JWT verification enabled. The function uses Supabase's built-in `SUPABASE_SERVICE_ROLE_KEY` runtime secret; do not add that key to the website or repository.
3. Create your own site account, confirm its email, and sign in once so your account exists in Supabase Auth.
4. In the private Supabase SQL Editor, run this one-time query after replacing the placeholder with your email. Keep your email out of GitHub:

```sql
do $$
declare
  owner_id uuid;
begin
  select id into owner_id
  from auth.users
  where lower(email) = lower('OWNER_EMAIL_HERE')
    and email_confirmed_at is not null;

  if owner_id is null then
    raise exception 'The owner account must exist and have a confirmed email.';
  end if;

  insert into public.site_owners (singleton, user_id)
  values (true, owner_id)
  on conflict (singleton) do update set user_id = excluded.user_id;
end
$$;
```

5. Apply `supabase/admin-content-schema.sql` to add the managed glossary and social-link tables. The current project has already received this schema as the `admin_content_tools` migration.
6. Publish the website and deploy the latest `admin-tools` Edge Function with JWT verification enabled. Sign in as the owner and open **Account**. Use the account list to grant or revoke administrator access. The selected person's account must be registered, email-confirmed, and active first.

The browser can upload one `.html` lesson file per chapter, numbered 3–99, up to 5 MB. Keep each lesson self-contained, including its styles and images. Supabase Storage serves visible uploaded lessons publicly for students to read, while only approved administrators can upload them or change their visibility. The Account page provides **Hide chapter** or **Show chapter** for every chapter. Uploaded chapters also have a **Delete permanently** option. Deleting an uploaded chapter removes its HTML file, catalog entry, and saved completion records; it cannot be undone. Bundled chapters 1 and 2 can only be hidden or shown because their lesson files are published with the website. Lessons are displayed in a sandboxed frame.

For an existing deployment, run the updated `supabase/admin-schema.sql` in the Supabase SQL Editor to refresh the role policies, then run `supabase/migrations/20261013_removed_chapters.sql` if it has not already been applied. Deploy the updated `admin-tools` function and publish the site. The website deployment does not deploy Edge Functions automatically. The table records visibility for bundled chapters 1 and 2; regular visitors can read those IDs, while only the service-role Edge Function can change the records. Uploaded chapters use the existing `available` flag in `chapter_catalog`.

Disabling a student blocks future sign-ins and removes that student's display name and percentage from the progress board. Row-level security also blocks access to their profile and lesson progress. The owner and administrators may reactivate students. Administrator accounts must have their administrator access revoked by the owner before they can be disabled. The owner role can only be reassigned through the private Supabase SQL Editor.

