# Telegram study assistant setup

This bot answers questions about the visible ADS1 course lessons. It reads the two bundled lessons and published uploads, refuses to treat lesson text as instructions, and does not read student accounts, notes, email addresses, or progress. It does not save message text. Telegram user IDs are kept only in a short-lived rate-limit table, which is cleaned as new messages arrive.

Messages are sent to OpenAI to draft answers. Tell students not to send personal details, passwords, or account questions to the bot. The bot is intended for private Telegram chats; group messages are redirected to a private chat.

## 1. Create the bot

In Telegram, open the verified **@BotFather**, create a bot with `/newbot`, choose its display name and username, and copy the bot token. Keep the token private. Do not paste it into GitHub or this conversation.

## 2. Add the server-side secrets

In Supabase **Edge Functions → Secrets**, add:

- `TELEGRAM_BOT_TOKEN`: the token from BotFather.
- `TELEGRAM_WEBHOOK_SECRET`: a random secret of 32 or more letters and digits. Keep it private; Telegram uses it to authenticate webhook requests.
- `OPENAI_API_KEY`: a current OpenAI API key. Keep it private and set an API spending limit.
- `OPENAI_MODEL`: optional; defaults to `gpt-4.1-mini`.
- `ADS1_SITE_URL`: optional; defaults to `https://djoudoulmi1-svg.github.io/ADS1`.

Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions. Never add the service-role key to this repository or website JavaScript.

## 3. Install and deploy

1. In the Supabase SQL Editor, run the complete `supabase/telegram-bot-schema.sql` script.
2. Deploy `supabase/functions/telegram-study-assistant/index.ts` as an Edge Function named `telegram-study-assistant`.
3. Keep JWT verification disabled for this function because Telegram authenticates its webhook with the secret header instead. The repo's `supabase/config.toml` records this setting.

The secret must be set before the function is used. After deployment, its endpoint is:

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/telegram-study-assistant
```

## 4. Register the webhook

Use the bot token privately in a terminal or a password manager's API client. Do not put the request URL with its token in a public document or share it. Send Telegram's `setWebhook` request with:

- `url`: the Edge Function endpoint above
- `secret_token`: the exact value of `TELEGRAM_WEBHOOK_SECRET`
- `allowed_updates`: `["message"]`

Telegram then sends messages to the function. Send `/start` to the bot to confirm it responds.

## Safeguards and limits

- Each Telegram account is limited to 10 questions per minute.
- Only private Telegram chats receive study answers.
- The assistant can only answer from published chapter text. If the lesson does not contain enough information, it should say so.
- The assistant sends the student's question and retrieved lesson excerpts to OpenAI. The bot does not store chat text or connect Telegram identities to ADS1 accounts.
- OpenAI and Supabase may apply their own usage limits or charges. Monitor both services.
- To stop the bot, remove the webhook with Telegram's `deleteWebhook`, then remove `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, and `OPENAI_API_KEY` from Supabase secrets.
