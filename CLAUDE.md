# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FPL Saúde is a multi-tenant SaaS platform for managing physiotherapy clinics and sports health services (whitelabel product name: "Clínica Especialista"). It handles patient management, professional scheduling (including recurring appointments), financial tracking, packages, subscriptions, KPI dashboards, time tracking, and appointment confirmations. All user-facing strings are in Brazilian Portuguese.

## Commands

```bash
npm run dev          # Start dev server on http://localhost:8080
npm run build        # Production build
npm run build:dev    # Development build with sourcemaps
npm run lint         # Run Oxlint (not ESLint)
npm run lint:fix     # Run Oxlint with auto-fix
npm run format       # Format with Prettier
npm run test         # Run Vitest (single-run)
npm run test:watch   # Run Vitest in watch mode
npx vitest --run tests/app.test.tsx   # Run a single test file
```

Cloud Functions (separate package in `functions/`):

```bash
cd functions
npm run build        # tsc → lib/
npm run serve        # Build + local emulator
npm run deploy       # firebase deploy --only functions (runs build via predeploy)
npm run logs         # firebase functions:log
```

One-off admin/migration scripts in `scripts/` use `firebase-admin` and run with:

```bash
npx tsx scripts/<script>.ts
```

They need `GOOGLE_APPLICATION_CREDENTIALS` pointing to a service-account JSON, or `VITE_FIREBASE_PROJECT_ID` in `.env.local`.

## Tech Stack

- **React 19** + TypeScript + Vite — SPA with React Router v6
- **TanStack Query (React Query)** for server state (default `staleTime` 30s, set in `App.tsx`)
- **Firebase** (Firestore `southamerica-east1`, Auth, Storage) — the only backend (the old Supabase adapter was removed)
- **Firebase Cloud Functions** (Node 22, TypeScript) in `functions/`
- **Tailwind CSS** + Shadcn UI (Radix primitives) — theme via HSL CSS variables
- **React Hook Form** + Zod for forms/validation
- **date-fns** / **date-fns-tz**; **Recharts** for dashboards; **jsPDF** / **docx** for document export
- **Oxlint** for linting; **Prettier** for formatting; **Vitest** + happy-dom for tests (in `tests/`)
- Deployed on **Vercel** (SPA rewrite in `vercel.json`; `middleware.ts` is a Vercel Edge Middleware that rewrites `index.html` meta tags/branding per domain)

## Architecture

### Multi-tenancy (the most important concept)

Every tenant (clinic) is a document in the root `companies` collection, and **all domain data lives in subcollections**: `companies/{companyId}/appointments`, `.../clients`, `.../professionals`, `.../financial_records`, `.../services`, etc.

- `src/shared/lib/tenantStore.ts` — module-level store; services call `getCompanyId()` to build Firestore paths. `AuthProvider` calls `setCompanyId()` after resolving the user's company. Calling it before resolution throws.
- `src/shared/providers/TenantProvider.tsx` — loads the tenant's `CompanyConfig` (branding, enabled modules, role permissions) and injects branding colors as CSS variables.
- `src/shared/types/tenant.ts` — `CompanyConfig`, `ModuleKey`, `RolePermissions`, defaults.
- Root collections: `users/{uid}` (profile + `companyId` + `role`), `super_admins/{uid}`, `companies/{id}`.
- Auth custom claims (`companyId`, `role`) are set by the `onUserWrite` Cloud Function watching the root `users` collection; `firestore.rules` validates by claim with a document fallback, and enforces per-module RBAC (`roles.<role>.can_view` / `can_edit` on the company doc).
- Staff lifecycle runs through callable Cloud Functions (`createStaffUser`, `setStaffActive` in `functions/src/auth/staffLifecycle.ts`): creation is atomic (Auth + root `users` + `professionals`) with rollback; deactivation **disables** the Auth account (`disabled: true`, sessions revoked) and flips `is_active` flags — nothing is deleted or anonymized, and reactivation restores the same login. `onUserWrite` only syncs custom claims. Never write account-creation/deactivation flows client-side.

### Module structure (`src/modules/`)

Each domain is a self-contained module: `appointments`, `clients`, `professionals`, `financial`, `kpis`, `packages`, `subscriptions`, `partnerships`, `services-catalog`, `availability`, `time-tracking`, `notifications`, `messages`, `summaries`, `gallery`, `auth`, `landing`, `maintenance`, `super-admin`.

Typical module layout:

- `service.ts` — barrel re-exporting `services/queries.ts` + `services/mutations.ts` (Firestore access)
- `hooks/` — TanStack Query hooks (`useAppointments`, etc.)
- `components/`, `pages/`

Conventions:

- **`src/modules/registry.ts`** is the canonical module list. When creating a new tenant-facing module, add a `MODULE_REGISTRY` entry (and the `ModuleKey` type in `tenant.ts`) — the super-admin panel and `DEFAULT_MODULES` derive from it, and `AdminDashboard` shows/hides tabs based on the company's module config.
- `src/shared/services/index.ts` is a legacy barrel re-exporting all module services to keep old import paths alive; new code should import directly from the module.
- Shared domain entity types (Appointment, Client, Professional, Service, Package, SubscriptionPlan, Partnership, Schedule…) live in `src/shared/types/index.ts` — check there before creating new types. Dates are stored as ISO strings (e.g., appointments filter on `schedules.start_time`).

### Shared layer (`src/shared/`)

- `components/` — `Layout`, `ProtectedRoute`, `RoleGuard`, `DomainRouter` (chooses landing page by hostname: `fpl.*` → FPL landing, otherwise SaaS landing), `ErrorBoundary`, header/nav
- `providers/` — `AuthProvider` (Firebase Auth; exposes `useAuth()` with `user`, `session`, `role`, `professionalId`), `TenantProvider`
- `lib/` — `firebase.ts`, `functions.ts` (callable Cloud Functions wrappers, region `southamerica-east1`), `tenantStore.ts`, `utils.ts`, availability/event-layout logic
- `hooks/` — `usePermission` (role feature checks), `use-toast`, `use-mobile`
- `pages/` — role dashboards (`AdminDashboard`, `ProfessionalArea`, `Index`)
- `src/components/ui/` — Shadcn primitives only (do not modify directly)

### Routing & roles (`src/App.tsx`)

Four access levels: `super_admin` (platform owner), `admin`, `professional`, `client`.

- `/` — `DomainRouter` (landing per domain)
- `/login` and `/:companySlug/login` (tenant-branded login), `/register`, `/forgot-password`, `/reset-password`
- `/admin/*` — admin only (`RoleGuard`)
- `/profissional/*` — professional + admin
- `/super-admin/*` — `SuperAdminGuard` (manages companies: branding, modules, roles) — module `src/modules/super-admin/`

### Cloud Functions (`functions/src/`)

`index.ts` only re-exports; one folder per domain:

- `auth/onUserWrite.ts` — sets custom claims, handles soft delete
- `appointments/onAppointmentWrite.ts`, `financial/onFinancialRecordWrite.ts`, `subscriptions/onSubscriptionWrite.ts` — incremental updates to `monthly_summaries` aggregates
- `cron/dailyReconciliation.ts` — scheduled full recalculation of monthly summaries per company

The `monthly_summaries/{companyId}/{YYYY-MM}` aggregates (read via `src/modules/summaries/`) feed the KPI dashboard, avoiding full-collection scans on the client. `scripts/backfill-monthly-summaries.ts` backfills them.

## Code Style

- Single quotes, no semicolons (Prettier config)
- Path alias: `@/*` → `./src/*`
- Oxlint enforces strict rules: no `any`, no non-null assertions, exhaustive React hook dependencies
- Tailwind dark mode via CSS classes; theming uses HSL CSS variables — tenant branding hex values are converted and injected at runtime by `TenantProvider`

## Environment Variables

Required in `.env.local`:

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

## Additional Documentation

Planning docs (in Portuguese) describe intent and roadmap — trust the code over them when they conflict:

- `refactoring_plan.md` — phased refactor status (module split, TanStack Query adoption)
- `superadmin_multitenant_plan.md` — multi-tenant/super-admin roadmap
- `docs/plano_arquitetura_acessos.md` — access/whitelabel architecture plan
- `FINANCIAL_EVOLUTION.md` — planned expenses/cash-flow module
- `docs/BLUEPRINT.md` — **outdated** (describes the pre-refactor `src/services`/`src/pages` structure)
