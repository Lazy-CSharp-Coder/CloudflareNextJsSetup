# bokhus-nextjs — Deploy to Cloudflare Workers with OpenNext

Complete setup guide for deploying this Next.js 16 app to Cloudflare Workers using the OpenNext adapter, connected to GitHub for automatic builds and deploys.

---

## Prerequisites

- A Cloudflare account (free tier works)
- A GitHub repository with this code pushed to it
- Node.js 20+ and npm

---

## Files in this repo

| File | Purpose |
|---|---|
| `wrangler.jsonc` | Worker config — entry point, assets, KV binding, compat flags, public vars |
| `open-next.config.ts` | OpenNext adapter config (minimal — KV cache is auto-detected from wrangler.jsonc) |
| `next.config.ts` | Next.js config with Sanity CDN image patterns |
| `package.json` | Your original deps + preview/deploy/cf-typegen scripts (OpenNext/Wrangler installed separately) |
| `.dev.vars.example` | Template for local dev secrets — copy to `.dev.vars` |
| `.gitignore` | Excludes `.open-next/`, `.wrangler/`, `.dev.vars`, etc. |

---

## Step 1 — Copy files and install dependencies

1. Copy/merge these files into your existing project:
   - `wrangler.jsonc` → new file, project root
   - `open-next.config.ts` → new file, project root
   - `next.config.ts` → **merge** with your existing config (keep your settings, add the `images.remotePatterns` block)
   - `package.json` → **replace** your existing one (same deps, new scripts added)
   - `.gitignore` → **merge** with your existing one (add the Cloudflare entries)
   - `.dev.vars.example` → new file, project root
   - `README.md` → reference guide

2. Install your existing dependencies:
   ```bash
   npm install
   ```

3. Install the Cloudflare packages separately (so npm resolves the real latest versions):
   ```bash
   npm i @opennextjs/cloudflare@latest
   npm i -D wrangler@latest
   ```

> **Why separate?** Hardcoding `@opennextjs/cloudflare` and `wrangler` versions in `package.json` caused version-not-found errors. Installing via `@latest` lets npm resolve the correct versions automatically and adds them to your `package.json`.

---

## Step 2 — Create the KV namespace for caching

```bash
|
```

Copy the `id` from the output and paste it into `wrangler.jsonc`, replacing `REPLACE_WITH_YOUR_KV_NAMESPACE_ID`.

> The KV cache is automatic — OpenNext detects the `NEXT_CACHE_WORKERS_KV` binding in `wrangler.jsonc` and uses it for ISR, `revalidateTag`, `"use cache"`, and `unstable_cache`. No explicit cache config is needed in `open-next.config.ts`.

---

## Step 3 — Fill in your environment variables

### In `wrangler.jsonc` (public vars — committed to repo)

These are the vars that Clerk reads from `process.env` internally. Replace the placeholder values:

```jsonc
"vars": {
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY": "pk_test_your-real-clerk-key",
  "NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL": "/Register"
}
```

> **What's NOT in vars (and why):**
> - `NEXT_PUBLIC_SANITY_PROJECT_ID` / `NEXT_PUBLIC_SANITY_DATASET` — hardcoded directly in your `sanity/client.ts`, so they're bundled at build time. No env var needed.
> - reCAPTCHA site key — if hardcoded in your component, it's bundled at build time. No env var needed. (If you read it from `process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY`, add it here.)

### For local development — copy `.dev.vars.example` to `.dev.vars`

```bash
cp .dev.vars.example .dev.vars
```

Fill in all the secret values in `.dev.vars`. This file is gitignored.
<>
### For production — set secrets via CLI or dashboard

```bash
npx wrangler secret put CLERK_SECRET_KEY
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put SANITY_API_TOKEN
npx wrangler secret put RECAPTCHA_SECRET_KEY
```

Or set them in the dashboard: Worker → Settings → Variables and Secrets.

> The CLI and dashboard write to the same encrypted store — they are interchangeable. Secrets are **never** needed at build time (except `NEXT_PUBLIC_*` vars), only at runtime.

---

## Step 4 — Generate Cloudflare types

```bash
npm run cf-typegen
```

This creates `cloudflare-env.d.ts` with TypeScript types for your bindings (KV, ASSETS, etc.).

---

## Step 5 — Test locally

### Standard Next.js dev server

```bash
npm run dev
```

Normal dev server. Cloudflare bindings (KV, etc.) are not available in this mode.

### Preview in the Workers runtime (recommended before deploying)

```bash
npm run preview
```

Builds with OpenNext and serves locally in the actual Workers runtime (Miniflare). This is where you test KV caching, ISR, and other Cloudflare bindings.

---

## Step 6 — Connect to GitHub via Workers Builds

This sets up automatic build and deploy on every push to your main branch.

### If you haven't deployed yet — import your repo

1. Push all your files to your GitHub repository (including `wrangler.jsonc`, `open-next.config.ts`, `next.config.ts`, `package.json`).
2. Go to the Cloudflare dashboard: **Workers & Pages** → **Create** → **GitHub**
   - Direct link: https://dash.cloudflare.com/38cc890f169c9c5d93323405e3183072/workers-and-pages/create/import-repository
3. Authenticate with GitHub if prompted and grant Cloudflare access to the repository.
4. Select your `bokhus-nextjs` repository from the list.
5. Configure the build settings (see below).
6. Click **Save and Deploy**.

### If you already deployed via CLI — connect GitHub to the existing Worker

1. Go to **Workers & Pages** → select your **bokhus-nextjs** Worker.
2. Go to **Settings** → **Builds**.
3. Click **Connect** and follow the prompts to authorize GitHub and select your repository.
4. Configure the build settings (see below).

### Build settings to configure

| Setting | Value |
|---|---|
| **Production branch** | `main` (or your default branch) |
| **Build command** | `npx opennextjs-cloudflare build` |
| **Deploy command** | `npx wrangler deploy` |

> **Critical:** The Worker name in the dashboard must match the `name` in `wrangler.jsonc` — which is `"bokhus-nextjs"`. If they don't match, the build will fail.

### Environment variables for Workers Builds

Workers Builds runs in Cloudflare's cloud, not your machine. It does NOT have access to your local `.dev.vars`. You must configure environment variables in the build settings:

1. After connecting, go to **Settings** → **Builds** → **Build variables and secrets**
2. Add all variables your Next.js build needs:

**Public vars (plaintext — needed at build time):**
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL`

**Secret vars (encrypted — needed at build time if used during static generation):**
- `CLERK_SECRET_KEY`
- `RESEND_API_KEY`
- `SANITY_API_TOKEN`
- `RECAPTCHA_SECRET_KEY`

> `NEXT_PUBLIC_*` vars are inlined by Next.js during the build, so they MUST be present at build time. Secret keys are needed at runtime — Workers Builds can be configured to promote build variables to runtime automatically.

---

## Step 7 — What happens after connecting GitHub

- **Push to `main`** → Workers Builds runs the build command, then deploys to production
- **Push to another branch** (if non-production builds are enabled) → creates a preview deployment with a unique URL
- **Pull requests** → Cloudflare posts a comment on the PR with the preview URL
- **Build status** → shown as a check run in GitHub

---

## Step 8 — Custom domain (optional)

Add a route in `wrangler.jsonc`:

```jsonc
"routes": [
  { "pattern": "bokhus.no/*", "custom_domain": true }
]
```

Or configure in the dashboard: Workers & Pages → your Worker → Settings → Domains & Routes.

---

## How the Next.js cache works

OpenNext intercepts Next.js's internal cache layer and routes it to the KV namespace bound as `NEXT_CACHE_WORKERS_KV` in `wrangler.jsonc`. This is automatic — no config needed in `open-next.config.ts`. This enables:

- **ISR pages** (`export const revalidate = 60`) — stale-while-revalidate across Workers instances
- **Tag-based revalidation** (`revalidateTag("posts")`) — invalidates cached entries in KV
- **`"use cache"` / `unstable_cache`** — cached function results persist in KV

If you don't configure a KV namespace, OpenNext falls back to an in-memory cache that resets on every cold start — ISR and tag revalidation won't work reliably.

---

## Accessing Cloudflare bindings in your code

```ts
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function GET() {
  const { env } = await getCloudflareContext();
  // env.NEXT_CACHE_WORKERS_KV — your KV namespace
  // env.ASSETS — static assets
  // env.CLERK_SECRET_KEY — your secret
  // env.RESEND_API_KEY — your Resend key
}
```

---

## Quick reference — all commands in order

```bash
# 1. Copy files into your project, then:
npm install

# 2. Install Cloudflare packages
npm i @opennextjs/cloudflare@latest
npm i -D wrangler@latest

# 3. Create KV namespace, copy ID into wrangler.jsonc
npx wrangler kv namespace create NEXT_CACHE_WORKERS_KV

# 4. Copy and fill in local dev secrets
cp .dev.vars.example .dev.vars

# 5. Set production secrets
npx wrangler secret put CLERK_SECRET_KEY
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put SANITY_API_TOKEN
npx wrangler secret put RECAPTCHA_SECRET_KEY

# 6. Generate types
npm run cf-typegen

# 7. Preview locally in Workers runtime
npm run preview

# 8. Deploy manually (optional — GitHub auto-deploys after Step 6 in README above)
npm run deploy

# 9. Connect GitHub via dashboard for automatic deploys
#    Workers & Pages → Create → GitHub → select repo → configure build settings
```

---

## Stack-specific notes

- **Clerk (`@clerk/nextjs`)**: Needs `CLERK_SECRET_KEY` (secret, runtime) and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (public var, build time). Clerk also reads `NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL` from `process.env`. Clerk middleware works with OpenNext. Avoid Node.js middleware (Next 15.2+) — OpenNext doesn't support it yet.
- **Sanity (`@sanity/client`, `next-sanity`)**: Project ID and dataset are hardcoded in `sanity/client.ts` — no env vars needed. If using authenticated queries, set `SANITY_API_TOKEN` as a secret.
- **Resend**: Needs `RESEND_API_KEY` as a secret (runtime only). Works in the Workers runtime with `nodejs_compat`.
- **react-google-recaptcha**: Client-side component uses site key (hardcoded in component). Server-side verification needs `RECAPTCHA_SECRET_KEY` as a secret (runtime only).
- **Images from Sanity**: `cdn.sanity.io` is in `remotePatterns` in `next.config.ts`.
- **babel-plugin-react-compiler**: Works fine with OpenNext — operates at the Next.js build level before OpenNext processes the output.
- **npm deprecation warnings** (`node-domexception`, `glob`): These are transitive deps of wrangler/opennext, build-time only, not bundled into the deployed Worker. Safe to ignore.

---

## Documentation links

- OpenNext adapter guide: https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/
- OpenNext for Cloudflare (upstream): https://opennext.js.org/cloudflare
- OpenNext caching: https://opennext.js.org/cloudflare/caching
- Workers Builds: https://developers.cloudflare.com/workers/ci-cd/builds/
- Workers Builds configuration: https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
- GitHub integration: https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/
- Wrangler configuration: https://developers.cloudflare.com/workers/wrangler/configuration/
- KV documentation: https://developers.cloudflare.com/kv/

