# AI Image Studio

<p align="center">
  <a href="https://github.com/zack744/ai-image-studio/releases"><img src="https://img.shields.io/github/v/release/zack744/ai-image-studio.svg" alt="Version"></a>
  <a href="https://www.apache.org/licenses/LICENSE-2.0"><img src="https://img.shields.io/badge/license-Apache%202.0-green.svg" alt="License"></a>
</p>

<p align="center"><a href="README.md">简体中文</a> | English</p>

AI Image Studio is a modern, open-source, and user-friendly AI image generation tool, providing creators with a one-stop AI image generation experience. Built on a frontend SPA + Cloudflare Workers architecture with self-hosting support, it integrates multiple providers including 速创AI and WaveSpeed for AI image generation.

This project is a fork/rewrite of the upstream [monkeyWie/typix](https://github.com/monkeyWie/typix), with a deeply refactored backend provider layer that connects 速创AI and WaveSpeed generation capabilities, adapted for Cloudflare Pages + Workers self-hosted deployment.

![](docs/public/images/demo/preview.png)

## 🎯 Quick Start

No registration required — start generating AI images immediately.

- [https://github.com/zack744/ai-image-studio](https://github.com/zack744/ai-image-studio)
  Fork/rewrite of the original Typix project, with multi-provider support (速创AI, WaveSpeed)

## ✨ Core Features

Focused on AI image generation, turning creativity into visual art instantly

- 🏠 **Self-hosted** - Full control over your data and privacy
- 🎁 **Free & Open Source** - Apache 2.0 licensed, free to use and modify
- ☁️ **Cloudflare Deployment** - Deploy to Cloudflare Workers with ease
- 🤖 **Multi-model Support** - Connect to various AI models via provider configuration (速创AI, WaveSpeed)
- 🔄 **Cloud Sync** - Sync your content across devices with account login
- 🌐 **Internationalization** - Supports Chinese and English

## 🚀 Deployment

### Cloudflare Workers Deployment (Recommended)

#### Prerequisites

- [Cloudflare account](https://dash.cloudflare.com)
- Node.js 20+
- pnpm

#### Steps

1. **Create resources in Cloudflare Dashboard**

   - Create a **D1** database and an **R2** bucket (resource names are configured in `worker/wrangler.toml` — D1 `database_name` and R2 `bucket_name`)
   - Fill in the D1 `database_id` in `worker/wrangler.toml`

2. **Clone and install dependencies**

```bash
git clone https://github.com/zack744/ai-image-studio.git
cd ai-image-studio
pnpm install
```

3. **Log in to Wrangler**

```bash
npx wrangler login
```

4. **Set backend secrets** (JWT is required; INVITE_CODE is optional but recommended for gating sign-ups)

```bash
npx wrangler secret put JWT_SECRET --config worker/wrangler.toml --env production
npx wrangler secret put INVITE_CODE --config worker/wrangler.toml --env production
```

5. **Run database migration**

```bash
pnpm db:migrate
```

6. **Deploy the Worker**

```bash
pnpm deploy:worker
```

7. **Configure the frontend production env and deploy**

```bash
cp .env.production.example .env.production   # set VITE_WORKER_URL to your Worker address
pnpm deploy:frontend
```

### Security & abuse protection

- **Invite-code signup**: when the `INVITE_CODE` environment variable is set, registration requires a matching invite code (disabled when unset).
- **Bring-your-own API key**: AI provider API keys are entered per-user in "Settings → AI Providers", stored in browser local storage, and forwarded to the backend with each generation request. The server never stores provider keys, so nobody can burn your quota.

### Static File Hosting (frontend only, using remote API)

If you only need to deploy the frontend while using a remote Worker API:

```bash
pnpm install
pnpm build
# Deploy dist/ to Cloudflare Pages / Vercel / Netlify / etc.
```

Specify the Worker URL at build time:

```bash
VITE_WORKER_URL=https://your-worker.workers.dev pnpm build
```

## 🛠️ Development Documentation

### Tech Stack

**Frontend:**

- **React 19** - Modern UI framework
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS v4** - Atomic CSS framework
- **shadcn/ui** - High-quality UI component library
- **TanStack Router** - Type-safe routing management
- **Zustand** - Lightweight state management
- **SWR** - Data fetching and caching
- **react-i18next** - Internationalization

**Backend (Cloudflare Worker):**

- **Hono** - Lightweight web framework
- **Cloudflare D1** - Serverless SQLite database
- **Cloudflare R2** - Object storage
- **Drizzle ORM** - Type-safe ORM
- **Jose** - JWT authentication

**Development Tools:**

- **Vite** - Fast build tool
- **Biome** - Code formatting and linting
- **pnpm** - Package manager (workspace mode)
- **Wrangler** - Cloudflare Workers CLI

### Local Development Guide

#### Environment Setup

1. **Install Node.js 20+**
2. **Install pnpm**

```bash
npm install -g pnpm
```

#### Development Workflow

1. **Clone the project**

```bash
git clone https://github.com/zack744/ai-image-studio.git
cd ai-image-studio
```

2. **Install dependencies**

```bash
pnpm install
```

3. **Configure Worker environment variables**

```bash
cp worker/.dev.vars.example worker/.dev.vars
# Edit worker/.dev.vars with your actual SUCHUANG_API_KEY
```

4. **Initialize local database**

```bash
cd worker
pnpm db:migrate:local
cd ..
```

5. **Start development servers** (requires two terminals)

```bash
# Terminal 1: Start Worker backend (default http://localhost:8787)
cd worker && pnpm dev

# Terminal 2: Start frontend dev server (default http://localhost:5173)
pnpm dev
```

The frontend will automatically connect to the local Worker via `VITE_WORKER_URL` (defaults to `http://localhost:8787`).

#### Project Structure

```
├── src/app/                # Frontend SPA
│   ├── ai/                 # AI provider type definitions
│   ├── components/         # React components
│   │   ├── icon/           # Icon components
│   │   ├── login/          # Login components
│   │   ├── navigation/     # Navigation components
│   │   └── ui/             # shadcn/ui components
│   ├── hooks/              # Custom Hooks
│   ├── i18n/               # i18n config and language files
│   ├── lib/                # Utility libraries and API client
│   ├── routes/             # Route pages
│   │   ├── chat/           # Chat page
│   │   └── settings/       # Settings page
│   └── stores/             # Zustand state management
├── worker/                 # Cloudflare Worker backend
│   ├── src/
│   │   ├── index.ts        # Hono app entry point
│   │   ├── auth/           # JWT authentication
│   │   ├── db/             # Database schema and instance
│   │   ├── providers/      # Image generation providers
│   │   └── routes/         # API routes
│   ├── drizzle/            # Database migration files
│   └── wrangler.toml       # Worker configuration
├── docs/                   # Documentation site
└── public/                 # Static assets
```

## 📄 License

This project is licensed under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0).

You are free to:

- ✅ Commercial use
- ✅ Modify the code
- ✅ Distribute the project
- ✅ Private use

But you must:

- 📝 Include copyright notice
- 📝 Include the license file
- 📝 State significant changes

---

If this project helps you, please consider giving us a ⭐ Star!
