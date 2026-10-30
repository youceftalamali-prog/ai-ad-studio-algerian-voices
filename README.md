# AI Ad Studio — Algerian Voices

React + Vite frontend for an Algerian Arabic voice-ad studio.

## Local development

```bash
npm install
npm run dev
```

## Admin dashboard UI

Copy `.env.example` to `.env.local` and set `VITE_ADMIN_EMAIL` to the email address that should see the Admin navigation item, then restart Vite.

**Security and backend status:** `VITE_ADMIN_EMAIL` is a frontend visibility check only. Vite exposes all `VITE_*` variables to the browser, and the current app's email state is client-side. This is not authentication or authorization and must not be used as a production security boundary.

The dashboard currently includes UI prototypes for subscription review, local voice sample preview, AI/TTS model preferences, theme/language preferences, and a secure-key form. Subscription changes and voice uploads are currently session-local; preferences are saved in this browser. The API-key form calls `PUT /api/admin/settings/api-key`, but this repository currently has no server route for that endpoint, and no payment/database persistence is implemented.

Before production, add a backend with real sign-in/session cookies, server-side admin-role authorization on every admin endpoint, a database for subscriptions and voice samples, object storage for audio, and server-side secret storage for Google AI Studio keys. Never place a real API key in frontend code, `.env` files committed to GitHub, or `VITE_*` variables.

## Cloudflare Workers deployment

The app is deployed from the `main` branch with GitHub Actions. Add these repository
Actions secrets before pushing a deployment-triggering commit:

- `CLOUDFLARE_API_TOKEN`: a scoped Cloudflare API token with Workers Scripts Edit.
- `CLOUDFLARE_ACCOUNT_ID`: the Cloudflare account ID.

The workflow builds the Vite frontend and deploys the Worker and static assets.
The `GET /api/health` endpoint provides a basic deployment health check.
