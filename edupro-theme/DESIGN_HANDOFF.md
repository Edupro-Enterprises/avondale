# Edupro Theme — Design & Engineering Handoff

> The frontend UI theme for **Edupro SMS**, Edupro Cloud's school management system. This document is written for a designer (or design-minded engineer) picking up the project fresh.

---

## 1. What this project is

Edupro Theme is a **finance-first, mock-data frontend** covering six role-scoped experiences from one codebase:

- **Bursar** — the primary desk: billing, cash office, debtor management, procurement, finance/GL, school setup
- **School Head** — read-only oversight plus final sign-off on payment vouchers and receipt reversals
- **SDC** (School Development Committee) — Fund B (SDC/SDA) oversight and co-approval
- **System Admin** — user/role/session/audit-log administration
- **Parent** and **Student** — lightweight portals (payments, statements, payment plans)

Every screen, label, and dataset is modelled on a real Zimbabwean secondary school's finance workflows (fee structures, terms, boarding, BEAM/scholarship funding, MoPSE/PRAZ compliance numbers, SDC governance) rather than generic placeholder content. **There is no backend** — all data lives in typed mock arrays under `src/data/`, shaped realistically so wiring a real API later should be close to a drop-in replacement. The platform is **USD-only** (no secondary/dual-currency display).

## 2. Tech stack (for context, not something a designer needs to touch)

| Layer | Choice |
|---|---|
| Framework | React 19 + TypeScript, Vite 8 |
| Routing | TanStack Router (file-based, auto code-split) |
| Data/state | TanStack Query (wired at the root; mock data doesn't need it yet) + Zustand (`persist` for auth/school-branding state) |
| Styling | Tailwind CSS v4 + shadcn/ui (Radix primitives) |
| Tables | `@tanstack/react-table`, wrapped as the shared `<DataList>` primitive |
| Charts | Recharts |
| Forms | React Hook Form + Zod |
| Toasts | Sonner |

Run locally: `pnpm install && pnpm run dev`, then open `http://localhost:5173`.

## 3. Brand & theme system

All brand colors live in **`src/styles/theme.css`** as hex CSS variables (matching the exact values documented in the platform's own brand references — `eduprocloud/DESIGN.md` and `edupro-sms-reference/DESIGN.md`, both the real Edupro brand, not invented for this theme), split into `:root` (light) and `.dark` blocks. This is the single file to touch for palette changes — nothing is hardcoded in components.

- **Primary** — Edupro brand red (`#ff0527` light / `#ff3b52` dark, lightened for contrast on the dark background) — used for primary actions, active nav, links, focus rings, chart series #1. Per the brand's own "one accent rule," red is the *only* brand hue — it's used sparingly (buttons, active states, icons), never as a large background fill.
- **Secondary / Accent** — neutral gray (`#f3f4f6` / `#f9fafb` light, dark grays in `.dark`) — the real brand system has no second brand color, so highlight chips/secondary buttons are neutral rather than a second hue.
- **Destructive** — the brand's own darker red (`#c8021e` light / `#e0364a` dark), reserved for reject/delete actions specifically so it reads as distinct from the brighter primary red.
- **Status tones** (`--status-good/-warning/-bad/-neutral/-info`, each with a paired `-bg`) — the shared color language for every status chip and priority indicator in the app; each pair is verified to clear WCAG AA against its own background in both themes.
- **Sidebar tokens** are separate variables (`--sidebar`, `--sidebar-primary`, `--sidebar-accent`, etc.) — active nav items use a light red tint (`#fff0f2` light / dark red tint `#3a1620` dark) with red text, matching how the real live portal renders its own active nav state.
- **Chart palette** — 5 preset chart colors (`--chart-1` … `--chart-5`): brand red, dark navy/light slate (theme-dependent), neutral gray, and the brand's own semantic green/amber for genuinely semantic series only, never decorative.
- Global gradients, scrollbar color, selection color, and card/dialog radii (`--radius: 0.85rem`) are also defined here.

**Logo & favicon** — the school's logo isn't hardcoded: `useSchoolBrandingStore` (`src/stores/school-branding-store.ts`, Zustand + `persist`) is the single source of truth for the logo URL and school name shown in every header/sidebar across all six role shells. It defaults to `public/brand/edupro-logo.png` / "Mbare High School," but School Setup → Institution Profile lets a Bursar upload a custom logo, which is what a real backend-backed School Setup record would eventually replace this local persistence with. `public/images/favicon-*.png` are cropped from the same default logo (16/32/48/180px, raster-only — there's no SVG source).

**`src/styles/index.css`** imports Tailwind + this theme file and adds the page-level background gradient (a barely-there neutral vignette in light mode, since a colored one would violate the "never fill background with red" rule; a whisper of red glow is kept in dark mode) plus a couple of small global animations (collapsible slide).

Design system status: color, radius, spacing, and typography tokens are all locked in (see `docs/audit/theme-roadmap-2026-09-14.md` Phase 1/2 for how the 12px-base type scale and spacing scale were rolled out) — this is no longer "template defaults," it's Edupro's own system.

## 4. Information architecture

Each of the six role shells has its own pathless layout route and its own sidebar data file — there's no single sidebar to document, so this is the pattern to follow rather than a static tree:

| Role | Route group | Sidebar data |
|---|---|---|
| Bursar | `src/routes/_authenticated/bursar/**` | `src/components/layout/data/sidebar-data.ts` |
| School Head | `src/routes/_school-head/**` | `src/components/layout/data/school-head-sidebar-data.ts` |
| SDC | `src/routes/_sdc/**` | `src/components/layout/data/sdc-sidebar-data.ts` |
| System Admin | `src/routes/_system-admin/**` | `src/components/layout/data/system-admin-sidebar-data.ts` |
| Parent / Student | `src/routes/_portal/**`, `src/routes/_student/**` | lightweight `PortalLayout`, no sidebar |

Bursar (the primary desk) groups its ~10 top-level route folders — `admissions`, `billing`, `cash-office`, `debtors`, `finance`, `guardians`, `procurement`, `reports`, `school-setup`, `students` — into 6 sidebar nav groups (see AUD-015 in the audit for why 6, not 10). Each of Bursar/School Head/SDC/System Admin also gets a "Continue as \<role\>" entry on the sign-in quick-entry grid for demoing without real auth.

## 5. Where to check build/feature status

This doc intentionally doesn't carry a page-by-page status table — with 6 shells and ~50 routes, that goes stale within a day. The authoritative, actively-maintained source is **`docs/audit/`**:

- `theme-audit-2026-09-14.md` — the full 67-finding audit (evidence, severity, per-finding detail)
- `theme-roadmap-2026-09-14.md` — the 4-phase execution plan, sequencing, and dependencies
- `theme-executive-summary-2026-09-14.md` — the short version

As of this writing, Phases 1–4 of that roadmap are functionally complete: every list page identified in the original audit is migrated onto the shared `DataList`/`FilterBar` primitives, every data-entry dialog uses React Hook Form + Zod, and the one open product-design item (a "needs attention today" dashboard strip) has shipped for Bursar and School Head. Check `git log` for what's landed since.

## 6. Design patterns already established (follow these for new screens)

1. **Header + Main shell**: every authenticated route renders a role-specific `<XHeader>` (breadcrumbs, global `Search`/⌘K, `ThemeSwitch`, `ConfigDrawer`, `ProfileDropdown`) then `<Main>` for page content. Copy this scaffold for any new route.
2. **Modal-first mutations**: anything that mutates data (record a payment, approve a voucher) happens in a `Dialog` (max 2 CTAs, named size tiers on `DialogContent`, full-screen on mobile), never a separate page. Destructive/discard-in-progress flows go through the shared `<ConfirmDialog>` and `useUnsavedChangesGuard`/`usePageUnsavedGuard` hooks.
3. **Filter-first, search-first**: every list page composes `useFilters` + `<FilterBar>` (search input, a `Sheet`-based filter drawer, removable chips, localStorage-persisted state and named saved views) — not a one-off `DropdownMenu`. ⌘K search is cross-entity (students, invoices, receipts, debtor cases, vouchers, fixed assets) and scoped per role.
4. **Real tables, not `divide-y` lists**: every list of any real size renders through `<DataList>` (`src/components/data-list.tsx`) — sortable columns, pagination, row-density toggle, bulk-action bar, loading/empty states. See the JSDoc above `DataListColumn` for the one non-obvious convention (row-action icon buttons need `className='h-7! w-7!'` to not blow out row height under the mobile touch-target rule).
5. **Status color language** (used everywhere via `<StatusBadge tone=…>` — keep consistent): `good` → green, `warning` → amber, `bad` → red, `neutral` → slate, `info` → blue. Each page maps its own status enum to a tone; the component only renders the chip.
6. **Toast feedback**: every action button calls `toast.success / .error / .info` (via Sonner) rather than silently doing nothing.
7. **Currency formatting**: USD only, via `<Money usd={…} />` (`src/components/money.tsx`) — never a raw number. `compact` abbreviates for dense list rows (`$480k`, `$6.84M`).
8. **Forms**: React Hook Form + Zod on every data-entry dialog, `<CompactField>` for the label/error/required-indicator wrapper.

## 7. Data & state (for context on what's "real" vs. mock)

- All data (`mockStudents`, `mockFeeStructures`, `mockReceipts`, `mockDebtorCases`, `mockPaymentVouchers`, `mockFixedAssets`, etc. — 38 files) lives under `src/data/`, one module per entity, each exporting its TypeScript interface(s) alongside the mock array. Several also export a `*ById` `Map` (e.g. `costCentersById`) for O(1) lookups in list rows instead of `.find()` in a loop.
- Zustand is used narrowly, not as a general store: `src/stores/auth-store.ts` (session/role) and `src/stores/school-branding-store.ts` (logo/school name, `persist`-backed). There's no generic "app state" store — most UI state is local `useState`/`useFilters`.
- TanStack Query is wired at the root (`src/main.tsx`, `src/routes/__root.tsx`) but isn't doing real fetching yet, since there's no backend — it's there for when one exists.

## 8. Suggested next priorities

See `docs/audit/theme-roadmap-2026-09-14.md` Phase 4 for the live backlog. As of this writing the only open items are:

1. **AUD-057** (optional) — replace Recharts with a lighter chart library if it remains the app's only chart dependency; low priority, already mitigated by working route-level code-splitting.
2. Anything flagged by `/impeccable audit` or a fresh design pass — the design system itself (tokens, primitives) is stable, so new work should extend it rather than introduce parallel patterns.

## 9. Where to look in code for each concern

| Concern | File(s) |
|---|---|
| Brand colors / theme tokens | `src/styles/theme.css` |
| Global background/gradients | `src/styles/index.css` |
| School logo/name (per-tenant) | `src/stores/school-branding-store.ts` |
| Sidebar structure per role | `src/components/layout/data/*-sidebar-data.ts` |
| Shared table primitive | `src/components/data-list.tsx` |
| Shared filter system | `src/hooks/use-filters.ts`, `src/components/filter-bar.tsx` |
| Cross-entity search | `src/lib/search-index.ts`, `src/components/command-menu.tsx` |
| Money formatting | `src/lib/currency.ts`, `src/components/money.tsx` |
| Status chips | `src/components/status-badge.tsx` |
| Confirm/unsaved-changes dialogs | `src/components/confirm-dialog.tsx`, `src/hooks/use-unsaved-changes-guard.ts`, `src/hooks/use-page-unsaved-guard.ts` |
| Bursar routes | `src/routes/_authenticated/bursar/**` |
| School Head / SDC / System Admin routes | `src/routes/_school-head/**`, `src/routes/_sdc/**`, `src/routes/_system-admin/**` |
| Parent / Student portals | `src/routes/_portal/**`, `src/routes/_student/**` |
| All mock data | `src/data/*.ts` |
| Audit/roadmap (authoritative status) | `docs/audit/*.md` |
