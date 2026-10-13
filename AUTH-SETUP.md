# Student Accounts Setup

The account interface is included, but it remains disabled until the owner connects Supabase and the private Google Sheet integration. The website never stores passwords. Supabase Auth enforces one account per email address. Signed-in students can see each other's display name and overall completion percentage; emails and detailed chapter records are not shown on the board.

## 1. Create and configure Supabase

1. Create a Supabase project at [supabase.com](https://supabase.com/) and keep its database password private.
2. In the Supabase SQL Editor, run the complete script from `supabase/schema.sql`. It creates account profiles, private per-user lesson progress, row-level security policies, and the restricted progress-board function.
3. In **Authentication → Providers**, enable Email. Keep email confirmation enabled so unverified addresses are not added to the Sheet.
4. In **Authentication → URL Configuration**, set the Site URL to `https://djoudoulmi1-svg.github.io/ADS1/` and add that same URL to the allowed redirect URLs.
5. In **Project Settings → API**, copy the Project URL and the public publishable key (or legacy anon public key). Put them in `supabase-config.js`:

```js
window.ADS1_SUPABASE_CONFIG = {
  url: "https://YOUR_PROJECT_REF.supabase.co",
  publishableKey: "YOUR_PUBLIC_PUBLISHABLE_OR_ANON_KEY"
};
```

The publishable/anon key is intended for browser use and is protected by the SQL row-level security policies. **Never put a service-role key or database password in this file or in GitHub.**

## 2. Create the private roster Sheet

1. While signed in to the Gmail/Google account that should own the roster, create a blank Google Sheet.
2. Open **Extensions → Apps Script**. Replace the editor contents with `google-sheet/Code.gs` and save the project.
3. In Apps Script **Project Settings → Script Properties**, add:
   - `SPREADSHEET_ID`: the ID from the Sheet URL between `/d/` and `/edit`.
   - `SYNC_SECRET`: a long, random value generated privately. Do not commit or send it to anyone.
4. Choose **Deploy → New deployment → Web app**. Set **Execute as** to your account and **Who has access** to **Anyone**, then deploy and authorize it. Copy the resulting `/exec` URL. The endpoint requires the separate secret and is called only by the authenticated Supabase Edge Function.

The script creates a `Users` tab automatically. It stores user ID, email, display name, first-seen time, and last-updated time. Re-syncing an account updates its existing row instead of making a duplicate.

## 3. Deploy the secure Sheet bridge

1. In the Supabase dashboard, open **Edge Functions** and create a function named `sync-roster`.
2. Deploy the contents of `supabase/functions/sync-roster/index.ts`. Make sure JWT verification is enabled; `supabase/config.toml` also records this setting for CLI-based deployments.
3. In **Edge Function Secrets**, set:
   - `SHEET_SYNC_URL`: the Apps Script `/exec` URL.
   - `SHEET_SYNC_SECRET`: the exact same private value entered in Apps Script Script Properties.
   - `SUPABASE_URL` and `SUPABASE_ANON_KEY` if they are not already available to the function runtime.

Do not place the Sheet ID or sync secret in website JavaScript. Only the Edge Function receives the sync secret.

## 4. Publish and verify

1. Commit and push `supabase-config.js` with the project URL and public key. It contains no privileged secrets.
2. GitHub Actions deploys the website. Open **Account**, sign up using a real email address, confirm the email, then sign in.
3. Confirm that the owner Sheet gets one roster row, the account progress is visible on **Account**, and **Show board** lists only display names and percentages.
4. Mark a chapter complete from its lesson toolbar while signed in. The account's percentage should update and persist after signing out and back in.

If the Sheet is unavailable, sign-in and progress still work; the Account page reports that roster sync needs attention. The private Sheet belongs to the Google account used to create and deploy the Apps Script web app.
