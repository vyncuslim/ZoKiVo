# ZoKivo authentication integration (Mother Supabase)

Routes:
- /auth/login — email/password or Google (if enabled in Mother Supabase)
- /auth/register — email/password with email confirmation handling
- /auth/forgot — send password recovery email
- /auth/reset — update password in a verified recovery session
- /auth/callback — OAuth and email verification PKCE exchange
- /account — account information verified through Supabase Auth
- /api/auth/signin, /signup, /me, /signout, /recover, /reset, /google

## Environment
- MOTHER_SUPABASE_URL — Mother Supabase HTTPS project URL
- MOTHER_SUPABASE_PUBLISHABLE_KEY — public publishable key (used from server, never a privileged key)
- ZOKIVO_PUBLIC_URL — optional canonical production URL (used in other site metadata). OAuth and recovery callbacks now stay on the **original allowlisted hostname** where the PKCE cookie was set.
- ZOKIVO_AUTH_ALLOWED_ORIGINS — optional comma-separated **exact HTTPS origins** for trusted Preview or custom ZoKivo hosts (no wildcards or paths). Configure matching redirect URLs at Mother Supabase before testing.
No service-role secret is required for these flows. Sessions use Secure HttpOnly SameSite=Lax cookies; refresh tokens are never returned to client-side JavaScript.

## Setup required in the **existing Mother Supabase Auth project**
- Add these exact callback URLs to Authentication → URL Configuration → Redirect URLs for whichever live hosts are used: `https://zokivo.xyz/auth/callback`, `https://www.zokivo.xyz/auth/callback`, `https://zokivo.vynalthai.com/auth/callback`, and `https://zokivo.vercel.app/auth/callback`.
- **Important:** OAuth, signup confirmation and password recovery now return to the exact host where the PKCE flow was initiated; a canonical redirect to a *different* host can lose host-only PKCE cookies and fail with `expired`. Configure every used alias explicitly.
- Enable Email provider and configure SMTP/deliverability and email confirmation as intended.
- Enable Google provider and configure Google OAuth at the Supabase project if the Google login button is desired. Do not put the Google client secret in ZoKivo's browser.
- If testing preview URLs, set `ZOKIVO_AUTH_ALLOWED_ORIGINS` on that Preview deployment to those exact preview hosts *and* add each corresponding `/auth/callback` URL in the Mother Supabase redirect allowlist. Do not wildcard untrusted hosts.
- Configure CAPTCHA, Auth email rate limits, and IP limits before opening registration broadly.
- Configure Vercel Production variables and redeploy.
- The PKCE email confirmation and recovery links must be opened in the same browser where the flow started; default confirmation templates must redirect back with a code, not an implicit token fragment.
- For minors, finalize age-appropriate consent, privacy policy, data retention, and guardian/teacher onboarding before public launch.

## Server-side security boundaries
- Client does not receive service-role keys, Supabase access tokens, or refresh tokens.
- /api/auth/me calls Supabase Auth /user, never trusts local user claims.
- Restricted host session creation requires authenticated, email-confirmed accounts. Self-selected Teacher mode is **not** independent educator verification; `app_metadata` verification remains a separate trust boundary.
- /play remains public and players join using a PIN.
- Existing Paper Mode feature flag stays disabled by default.
- Access token refresh is supported in the Auth and host creation API routes. A browser may need to refresh /account before accessing other private pages.
- Game host mutations require a signed-in original room owner plus a valid Host token; missing owner records fail closed. Independently verified teacher privileges remain a separate product policy gate.
- Auth POST endpoints check same-origin Origin, but production deployment still needs CAPTCHA, persistent rate limiting, abuse monitoring, and strict account-status admission controls from Mother Supabase.
- Mother Supabase profile/account_status policies were not changed. If the mother auth requires extra admission tickets, extend this integration to honor them BEFORE enabling privileged pages.
- Never claim a live account signup/login works until a test email account and Google OAuth flow have been verified on the production domain.

## CAPTCHA configuration (required when Mother Supabase Bot Protection is enabled)
- Create a **Cloudflare Turnstile** widget whose hostname list covers every allowed ZoKivo auth host (for example, `zokivo.xyz`, `www.zokivo.xyz`, `zokivo.vynalthai.com` and `zokivo.vercel.app`).
- Add its **public** site key in Vercel Environment Variables as `NEXT_PUBLIC_ZOKIVO_TURNSTILE_SITE_KEY` for Production, and for Preview with the appropriate preview-host coverage. Redeploy after changes.
- In **Mother Supabase → Authentication → Bot and Abuse Protection**, select **Turnstile** and enter the matching **secret** key there, **not** in Vercel's public environment variable or GitHub.
- The browser sends a short-lived, single-use token to the ZoKivo API, which forwards it under `gotrue_meta_security.captcha_token`; Supabase checks it with the configured provider. Registration, email sign-in, and recovery all use this flow. Never disable CAPTCHA on production to bypass a missing-token error.
- Confirm the production page displays Turnstile, then test one authorized test account. If a key has not been configured, the registration page displays an operational warning; it does not pretend that the provider accepted the flow.
