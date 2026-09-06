# AGENTS.md

Instructions and guidelines for AI coding agents working in the `daan` repository.

---

## 1. Project Overview & Tech Stack

`daan` is a modern TypeScript monorepo built with:

- **Runtime & Package Manager**: [Bun](https://bun.sh)
- **Frontend (`apps/web`)**: React 19, [Mantine UI v9](https://mantine.dev), TanStack Router, TanStack Query, Vite+
- **Backend (`apps/server`)**: [Hono](https://hono.dev), [oRPC](https://orpc.unnoq.com)
- **Background Jobs**: [bunqueue](https://bunqueue.dev) (embedded SQLite / memory / PostgreSQL)
- **Desktop (`apps/desktop`)**: [Electrobun](https://electrobun.dev)
- **Database (`packages/db`)**: SQLite / Turso via [Drizzle ORM](https://orm.drizzle.team)
- **Notifications**: [Sonner](https://sonner.emilkowal.ski)
- **PDF Extraction**: [unpdf](https://github.com/unjs/unpdf)
- **AI & LLM**: [OpenAI](https://github.com/openai/openai-node)
- **Linter & Formatter**: [Oxlint](https://oxc.rs) & [Oxfmt](https://oxc.rs)

---

## 2. Ports & Networking

Default ports start from **3006**:

| Service                                 | Port        | Local URL                                           |
| --------------------------------------- | ----------- | --------------------------------------------------- |
| **API Server (`apps/server`)**          | `3006`      | `http://localhost:3006`                             |
| **Web Frontend (`apps/web`)**           | `3007`      | `http://localhost:3007`                             |
| **Electrobun Desktop (`apps/desktop`)** | dev: `3007` | Points to web dev server at `http://localhost:3007` |

Fallback endpoints and default environment variables in `packages/env` reflect these ports:

- Server CORS origin: `http://localhost:3007`
- Client API URL: `http://localhost:3006/rpc`

---

## 3. UI Library & Mantine LLM Documentation

### Exclusive UI Libraries

- **Mantine UI (`@mantine/core`, `@mantine/hooks`)** is the primary and official UI library for the application.
- **Sonner** is used for toast notifications (`<Toaster />` from `@/shared/components/sonner` or `sonner`).
- **No other UI packages are used** (no shadcn/ui, no `@base-ui`, no Tailwind UI component packages). The legacy `@daan/ui` package has been removed.

### Mantine Documentation References

- **Local documentation index**: `docs/mantine/llms.txt`
- **Upstream LLM index**: `https://mantine.dev/llms.txt`
- **Consolidated full documentation**: `https://mantine.dev/llms-full.txt`
- **Update local copy**: `bun run docs:mantine`

### Agent Protocol for Mantine

1. **Consult before implementing**: When implementing UI features, check `docs/mantine/llms.txt` or `https://mantine.dev/llms.txt` to locate the exact documentation file.
2. **Fetch specific documentation**: Look up the dedicated markdown file under `https://mantine.dev/llms/<topic>.md`:
   - Core components: `https://mantine.dev/llms/core-<component>.md` (e.g. `core-button.md`, `core-modal.md`, `core-table.md`, `core-tabs.md`)
   - Hooks: `https://mantine.dev/llms/hooks-<hook>.md` (e.g. `hooks-use-disclosure.md`, `hooks-use-media-query.md`)
   - Form handling: `https://mantine.dev/llms/form-use-form.md`, `https://mantine.dev/llms/form-validation.md`
   - Theming: `https://mantine.dev/llms/theming-mantine-provider.md`, `https://mantine.dev/llms/theming-theme-object.md`
   - Styles: `https://mantine.dev/llms/styles-styles-api.md`, `https://mantine.dev/llms/styles-responsive.md`
3. **No hallucinated props**: Do not guess component props, variant names, or styles API classes. Fetch the relevant markdown doc to verify exact signatures.
4. **Theming**: `<MantineProvider>` is wired in `apps/web/src/routes/__root.tsx`; reusable theme values belong in `apps/web/src/shared/styles/theme.ts`, and semantic CSS tokens belong in `apps/web/src/shared/styles/globals.css`.

### Product Design System

The product uses a warm, editorial visual language inspired by premium print and stationery. New UI must feel calm, tactile, spacious, and content-first.

#### Color rules

- Use semantic `--app-*` variables from `apps/web/src/shared/styles/globals.css`; do not scatter raw hex, RGB, HSL, or OKLCH values through components or feature styles.
- Core roles are `--app-canvas`, `--app-surface`, `--app-surface-muted`, `--app-surface-raised`, `--app-text`, `--app-text-muted`, `--app-text-subtle`, `--app-border`, and `--app-border-subtle`.
- The palette is warm ivory/oatmeal with charcoal ink. Avoid cool blue-gray neutral surfaces unless data semantics require them.
- Use `--app-accent` sparingly for links, small highlights, and focus-adjacent details. Primary actions use the Mantine `brand` color.
- Success, warning, and danger states must use `--app-success`, `--app-warning`, and `--app-danger`; never communicate state with color alone.
- Every new semantic token must define both light and dark values. Light mode is the default; dark mode must remain fully supported.

#### Typography rules

- Body and interface copy use the Mantine sans-serif family. Titles and intentional editorial display text use `Title`, `ff="heading"`, or `.app-display`.
- Serif type is reserved for page titles, hero statements, article headings, and brand moments. Do not use it for controls, metadata, navigation, or dense application UI.
- Prefer sentence case. Use `.app-eyebrow` only for short section labels; do not use uppercase for paragraphs or button labels.
- Keep body text readable with comfortable line-height and constrain long-form prose to roughly 60–75 characters per line.

#### Shape, spacing, and elevation rules

- Use Mantine spacing and radius values before custom values. The base spacing rhythm is 4/8 px, with 16, 24, and 40 px as common composition steps.
- Controls default to pill geometry. Cards and panels use `md`–`xl` radii; large editorial sections may use `xl` or a deliberate custom radius.
- Prefer borders and surface contrast over shadows. Use `xs` or `sm` shadows for floating UI and `md` only for prominent overlays; avoid decorative heavy shadows.
- Primary content uses `--app-content`; expansive hero and editor layouts use `--app-content-wide`. Vertical page sections use `--app-section-space` where practical.

#### Composition and interaction rules

- Build pages with generous negative space, strong type hierarchy, thin warm borders, and restrained ornament.
- Use `.app-surface` for standard raised panels and `.app-editorial-grid` only for large feature or hero backgrounds—not every card.
- Motion must be subtle, purposeful, and safe under reduced-motion preferences. Avoid bounce, gratuitous parallax, and long entrance sequences.
- All interactive elements need a visible focus state, sufficient contrast, and a text label or accessible name.
- Tailwind utility classes are the required styling approach for modules and shared components. Do not create CSS modules or standalone component stylesheets unless a style is demonstrably impossible or impractical with Tailwind.
- `apps/web/src/shared/styles/globals.css` is the only regular CSS file allowed for application styling. Reserve it for semantic tokens, resets, and true system-wide primitives—not feature-specific selectors.

---

## 4. Web Application Architecture (`apps/web`)

The web application strictly follows a modular architecture:

```
apps/web/src/
├── main.tsx
├── index.css
├── routes/
│   ├── __root.tsx              # Root route, MantineProvider, Header, Toaster
│   └── index.tsx               # Route declarations mapping to modules
├── modules/
│   └── <feature>/              # Feature modules (e.g. home, auth, dashboard)
│       ├── components/         # Feature-specific components
│       ├── hooks/              # Feature-specific hooks and stateful logic
│       ├── utils/              # Feature-specific pure logic and helpers
│       └── index.ts            # Public module interface
└── shared/
    ├── components/             # Reusable shared components (Header, ModeToggle, Loader, Toaster)
    │   └── index.ts
    ├── hooks/                  # Reusable custom hooks (e.g. use-mobile.ts)
    │   └── index.ts
    ├── utils/                  # Utility functions (cn.ts, orpc.ts)
    │   └── index.ts
    ├── styles/                 # Global styles and Mantine CSS (globals.css)
    ├── constants/              # Shared constants
    │   ├── links.ts            # Navigation links and external URL constants
    │   └── index.ts
    └── data/                   # Static shared datasets and metadata
        └── index.ts
```

### Agent Rules:

1. **No tests unless requested**: Do NOT write any tests (unit, integration, or end-to-end) unless the user explicitly asks for them.
2. **Maximum file and logic size**: Each `.ts` or `.tsx` file in `apps/web` must **not exceed 300 lines**. If a file or cohesive block of logic grows beyond 300 lines, extract it based on responsibility:
   - Reusable stateful or React-specific logic belongs in `shared/hooks/`.
   - Reusable framework-independent logic belongs in `shared/utils/`.
   - Feature-specific stateful or React-specific logic belongs in `modules/<feature>/hooks/`.
   - Feature-specific framework-independent logic belongs in `modules/<feature>/utils/`.
   - Split UI into smaller components where the oversized logic is primarily presentational.
3. **Never minify code**: When agents write or edit code, it must be clean, unminified, readable, and properly indented with consistent spacing.
4. **Follow the modular hierarchy**:
   - Feature-specific UI belongs inside `modules/<feature>/components/`.
   - Cross-cutting components belong inside `shared/components/`.
   - Navigation links must be defined in `shared/constants/links.ts`.
5. **TypeScript conventions**:
   - `verbatimModuleSyntax` is enabled: always use `import type { ... }` for types.
   - Strict typing with zero `any`.
   - No unused variables or imports.

---

## 5. Server Application Architecture (`apps/server`)

Keep route and transport handlers thin. Business logic, integrations, and reusable operations should be extracted into services:

- Cross-cutting services shared by multiple server features belong in `apps/server/src/shared/services/`.
- Feature- or domain-specific services belong in `apps/server/src/services/<feature>/`.
- Prefer focused service files over placing substantial business logic directly in routes, procedures, middleware, or entry points.

---

## 6. Background Jobs & Bunqueue LLM Documentation

### Bunqueue Overview

- **bunqueue** is a high-performance job queue for the Bun runtime with BullMQ-compatible API, one-file SQLite / memory persistence, and saga workflow engine.
- Install when adding queues: `bun add bunqueue`
- Imports:
  - Client SDK: `import { Queue, Worker, FlowProducer, Bunqueue } from "bunqueue/client";`
  - Workflows: `import { Workflow, Engine } from "bunqueue/workflow";`

### Bunqueue Documentation References

- **Local documentation index**: `docs/bunqueue/llms.txt`
- **Upstream LLM index**: `http://bunqueue.dev/llms.txt`
- **Update local copy**: `bun run docs:bunqueue`

### Agent Protocol for Bunqueue

1. **Consult before implementing**: When implementing background jobs, cron tasks, message processing, or multi-step workflows, consult `docs/bunqueue/llms.txt` or `http://bunqueue.dev/llms.txt`.
2. **Follow upstream guides**:
   - Queue API: `https://bunqueue.dev/guide/queue/` (priorities, delays, retries, deduplication)
   - Worker API: `https://bunqueue.dev/guide/worker/` (concurrency, heartbeats, lock ownership)
   - Hono Integration: `https://bunqueue.dev/guide/hono/` (embedded background jobs in Hono apps)
   - Workflows: `https://bunqueue.dev/guide/workflow/` (saga compensation, branching, parallel steps)
3. **No hallucinated queue options**: Check the official types from `bunqueue/client` and documentation before configuring queue or worker settings.
