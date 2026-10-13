# ADS1 Course Assistant

The floating assistant is available throughout the site. It is limited to questions about ADS1 lessons and using the learning hub. Students must sign in with a confirmed account. Chat history stays in the current browser page and is sent with the next question; it is not saved as a Supabase chat record.

## Enable AI answers

The assistant runs through the authenticated Supabase Edge Function `course-assistant`. The OpenAI key must stay server-side; never put it in `app.js`, `supabase-config.js`, or GitHub.

1. Create an OpenAI API key in the OpenAI Platform.
2. In Supabase, open **Edge Functions → Secrets** for this project.
3. Add a secret named `OPENAI_API_KEY` with the key as its value. Do not paste the key into chat, source files, or GitHub.
4. The function uses `gpt-6-astra` by default. To choose another model available to the OpenAI project, add an `OPENAI_MODEL` secret with that model name.

Supabase must also have its normal `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` Edge Function secrets; the project already uses these for its existing account and admin functions. The service role key is only used on the server to check whether the signed-in account is disabled.

If `OPENAI_API_KEY` has not been set, the chat window still appears and tells students the assistant is not configured yet. OpenAI API usage may incur charges under the account that owns the API key.

