# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FPL Saúde is a web application for managing physiotherapy clinics and sports health services. It handles patient management, professional scheduling, appointments (including recurring), financial tracking, packages, and subscriptions.

## Commands

```bash
npm run dev          # Start dev server on http://localhost:8080
npm run build        # Production build
npm run build:dev    # Development build with sourcemaps
npm run lint         # Run Oxlint
npm run lint:fix     # Run Oxlint with auto-fix
npm run format       # Format with Prettier
npm run test         # Run Vitest (single-run)
npm run test:watch   # Run Vitest in watch mode
```

## Tech Stack

- **React 19** + TypeScript + Vite (rolldown-vite fork)
- **Firebase** (Firestore, Auth, Storage) — primary backend
- **Tailwind CSS** + Shadcn UI (Radix UI primitives)
- **React Hook Form** + Zod for forms and validation
- **date-fns** / **date-fns-tz** for date handling
- **Recharts** for KPI dashboards
- **jsPDF** / **Docx** for document generation
- **Oxlint** (not ESLint) for linting; **Prettier** for formatting

## Architecture

### Service Layer (`src/services/`)
All data access goes through service modules. Each module (e.g., `appointments.ts`, `clients.ts`, `financials.ts`) exposes async functions that interact with Firestore directly. There is an adapter pattern supporting Firebase/Supabase switching via `VITE_DB_PROVIDER`, though Firebase is the current default.

### Types (`src/types/index.ts`)
All domain entities (Appointment, Client, Professional, Service, Package, SubscriptionPlan, Partnership, Schedule, etc.) are defined here. Check here first before creating new types.

### Routing (`src/App.tsx`)
Three user roles: `admin`, `professional`, `client`.
- `/admin/*` — admin-only (guarded by `RoleGuard`)
- `/profissional/*` — professional + admin (guarded by `RoleGuard`)
- Public routes: `/login`, `/register`, `/forgot-password`, `/reset-password`

### Authentication (`src/providers/AuthProvider.tsx`)
Firebase Auth with email/password. Exposes `useAuth()` hook with `user`, `session`, `role`, `professionalId`.

### Components
- `src/components/admin/` — admin management UI (appointments, patients, financials, KPIs)
- `src/components/professional/` — professional-facing UI (agenda, time tracking, availability)
- `src/components/ui/` — Shadcn primitives (do not modify these directly)

## Code Style

- Single quotes, no semicolons (Prettier config)
- Path alias: `@/*` → `./src/*`
- Oxlint enforces strict rules: no `any`, no non-null assertions, exhaustive React hook dependencies
- Tailwind dark mode via CSS classes; custom HSL color variables for theming

## Environment Variables

Required in `.env`:
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

## Additional Documentation

- `docs/BLUEPRINT.md` — comprehensive architecture documentation with design patterns, data domains, and navigation flows
