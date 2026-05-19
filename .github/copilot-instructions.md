# Project Guidelines

**TypeScript full-stack SPA project** - Focus on functionality over styling. All code comments in English.

## Response Rules

- Respond in the same language as user's question

## Stack

**Frontend:** React 19 + Vite 6 + Tailwind CSS v4 + shadcn/ui + TanStack Router + Zustand + SWR  
**Backend:** Cloudflare Workers (Hono) + D1 + R2 + Drizzle ORM + JWT (jose) — see worker/
**Package Manager:** pnpm (workspace monorepo)

## File Naming

- Hooks: `camelCase` (useChat.ts)
- Components: `PascalCase` (ChatArea.tsx)

## Key Rules

- Ignore code formatting and css class sorting lint issues, focus on functionality implementation
- Pure SPA (Single Page Application) - no SSR
- TypeScript required, implement proper error handling
- Use `POST` + JSON for all API endpoints (not RESTful)
- Mobile-first responsive design
- shadcn/ui: `pnpm dlx shadcn@latest add <component>`
