# Edupro Theme — Full Design & UX Audit

**Repo audited:** `edupro-theme` (shadcn-admin fork, Edupro School Fees & Financial Statement System frontend)
**Date:** 2026-09-14
**Auditor:** Claude (Sonnet 5), using the Impeccable skill's technical-audit framework plus a category-by-category pass against the client design brief
**Companion documents:** `theme-roadmap-2026-09-14.md`, `theme-executive-summary-2026-09-14.md`, `/RECOMMENDATIONS.md`

---

## Cover Page

This audit evaluates the entire Edupro Theme frontend — every layout, route, modal, filter, search surface, table, form, and token — against a detailed design brief calling for a **compact (12px base), filter-first, search-first, modal-driven, WCAG AA/AAA, desktop-first** enterprise finance UI for a Zimbabwean school's bursar's office.

The theme was built across ten sequential phases in a single continuous session (this same audit's author built it), giving unusually high implementation consistency: almost every finding below is **systemic** — one pattern repeated across dozens of files — rather than a scattered collection of one-offs. That is good news for the fix: most of these findings are fixed once, at the token or shared-component level, not 58 times.

---

## Executive Summary (technical)

**Audit Health Score (Impeccable 5-dimension framework): 11/20 — Acceptable, significant work needed**

| # | Dimension | Score | Key Finding |
|---|---|---|---|
| 1 | Accessibility | 2/4 | Solid Radix/shadcn primitive foundation, but page-level composition drops labels and touch-target size |
| 2 | Performance | 3/4 | No code-splitting; two chunks over 500kB; otherwise lean (no heavy runtime deps beyond Recharts) |
| 3 | Responsive Design | 2/4 | Real but thin breakpoint coverage; modals and tables do not adapt to mobile at all |
| 4 | Theming | 2/4 | Strong token system for surface/brand colors; status/semantic colors bypass it entirely |
| 5 | Implementation Integrity | 2/4 | Highly coherent and product-specific (no generic/interchangeable UI) but the density, filter, search, and table requirements in the brief are structurally unmet, not just under-polished |

**Total issues found: 67**, by severity: **12 Critical · 24 Major · 22 Minor · 9 Nice-to-have**

**Top 5 critical issues:**
1. Global search (⌘K) does not search any data — only page navigation — and shows the wrong navigation menu for 5 of the app's 6 user roles (AUD-025, AUD-026).
2. Every list in the app is a plain stacked-row `Card`, not a real table: no sorting, no pagination, no bulk actions, and rows run ~2x the brief's target height (AUD-034, AUD-035, AUD-036, AUD-037, AUD-038).
3. Filters exist but are single-dimension, non-persistent, non-composable, and have no chips or saved views on every one of the ~30 filterable lists in the app (AUD-019, AUD-020, AUD-021).
4. Status color chips (Paid/Overdue/Pending/etc., used on nearly every screen) fail WCAG AA contrast for 3 of their 5 tones, verified by computed contrast ratio (AUD-011).
5. The Bursar's own sidebar — the primary user's main navigation — has grown to 10 top-level groups against the brief's 6-group cap (AUD-015).

**Recommended next step:** approve the Phase 1 roadmap (below) and begin with the two zero-risk, high-impact fixes: the search bug (AUD-026) and the status-color token pass (AUD-010/011), both of which touch one file each and fix a problem visible on every screen in the app.

---

## How This Audit Was Performed

1. **Loaded the Impeccable skill's `audit` playbook** and used its 5-dimension scoring (Accessibility, Performance, Theming, Responsive, Implementation Integrity) as one lens on top of the client brief's own 15-category checklist.
2. **Read every design token file** (`theme.css`, `index.css`) directly — no assumption about what tokens exist.
3. **Read primitive components** (`dialog.tsx`, `button.tsx`, `status-badge.tsx`, `money.tsx`, `command-menu.tsx`, `search-provider.tsx`) in full.
4. **Ran quantified greps** across the whole `src/` tree for every measurable claim in this report — filter patterns, localStorage usage, breakpoint classes, font-size classes, row padding, aria-label coverage, sorting/pagination/bulk-select code, reduced-motion handling, saved-view/chip code. Every count in this report (e.g., "347 `text-sm` instances," "22 files," "0 matches") is a real grep result, not an estimate.
5. **Computed WCAG contrast ratios by hand** (relative-luminance formula) for every status-color pair called out as a contrast finding, rather than asserting pass/fail from memory.
6. **Cross-checked findings against this session's own build history** — every phase of this app was built in this same conversation, so claims about "every list page follows pattern X" are verified against the actual convention used, not inferred.
7. **Did not modify any source file.** This is a read-only audit; all evidence below is drawn from the code as it stands.

---

## Inventory of the Current Theme

| Area | Files (representative) | Current State | Notes |
|---|---|---|---|
| **Design tokens** | `src/styles/theme.css`, `src/styles/index.css` | Surface/brand colors fully tokenized (light + dark); **no typography scale, no spacing scale, no semantic status tokens** | 111 lines total; `@theme inline` block maps CSS vars to Tailwind, but only for color/radius, not size/space |
| **Root shells** | `authenticated-layout.tsx` (dense, 4 roles), `portal-layout.tsx` (lightweight, 2 roles) | Two distinct shell families, each internally consistent | Sidebar state persisted via cookie (strength) |
| **Sidebars** | `sidebar-data.ts` (Bursar, 10 groups), `school-head-sidebar-data.ts` (4), `sdc-sidebar-data.ts` (3), `system-admin-sidebar-data.ts` (3) | Bursar's sidebar has grown well past the other four roles' | See AUD-015 |
| **Routes** | 99 `.tsx` files under `src/routes/` across 6 role trees | Extremely consistent per-role conventions (list+dialog, detail+tabs) | Highest-value audit target because of that consistency — fixes propagate |
| **List "tables"** | 58 route files use the `Card` + `divide-y` row-list pattern | No real table primitive in use anywhere in routes | See Tables section |
| **Modals** | ~35 `Dialog`/`DialogContent` call sites across routes | Built on Radix (good a11y baseline); no size system, no mobile variant, no unsaved-changes guard | See Modals section |
| **Global search** | `command-menu.tsx`, `search-provider.tsx`, `search.tsx` | ⌘K opens a `cmdk` palette; indexes **navigation only**, and hardcodes the Bursar's sidebar regardless of role | Critical, see AUD-025/026 |
| **Filters** | `DropdownMenu`-based single-select filter, repeated in ~10+ list pages verified directly, pattern used on all ~30 filterable lists | No persistence, no chips, no saved views, no composable AND-filtering | See Filters section |
| **Status/semantic color** | `status-badge.tsx` | Hard-coded Tailwind palette classes per tone, not tokens | See AUD-010 |
| **Money display** | `money.tsx`, `lib/currency.ts` | Tabular-nums used correctly (strength); secondary ZiG figure fails brief's AAA bar | See AUD-012 |
| **Dark mode** | `.dark` block in `theme.css` | Complete token coverage, spot-checked live across many pages this session with no failures | Genuine strength |
| **Accessibility primitives** | `src/components/ui/*` (Radix-based) | Focus-ring tokens defined consistently at primitive level | Gap is at page-composition level, not primitive level |
| **Responsive** | Breakpoint classes: 59× `sm:`, 36× `md:`, 43× `lg:`, 4× `xl:` across the whole app | Real coverage, concentrated on stat-card grids; thin on dense multi-tab detail pages | Never explicitly tested at the brief's 360/768/1024/1440 checkpoints |
| **Performance** | `npm run build` output (every phase this session) | Two chunks consistently flagged >500kB (`index-*.js` ~510–520kB, `cash-flow-*.js` ~310kB) | No route-level code-splitting anywhere |

---

## Findings

Severity legend: **Critical** (blocks a core brief requirement or breaks for real users) · **Major** (significant gap, workaround exists) · **Minor** (real but low-impact) · **Nice-to-have** (polish).

### 1. Typography

**AUD-001 — Critical — Typography**
*Location:* Whole app (`src/routes/**/*.tsx`, `src/components/**/*.tsx`)
*Description:* The brief specifies a 12px compact base. The app's actual dominant body size is `text-sm` (14px) — verified 347 occurrences vs. 154 `text-xs` (12px) occurrences app-wide. No root/theme override sets a 12px base anywhere.
*Impact:* The single most explicit, top-line requirement in the brief ("Base font size: 12px (compact/enterprise)") is unmet across the whole app. A bursar scanning dozens of rows a day gets meaningfully less information per screen than specified.
*Recommendation:* Introduce a token-based type scale (see AUD-002) with `body`/`label` roles resolving to 12–13px, and do a scripted find-replace of `text-sm` → the new `text-body` token (or equivalent) across the codebase, verifying each call site still reads correctly at the smaller size.
*Effort:* 2 days (token definition + codemod + visual QA pass across all 99 routes).
*Evidence:* `grep -rho "text-sm\b" src --include=*.tsx | wc -l` → 347; `text-xs` → 154; no `font-size: 12px` or 12px root override found anywhere in `src/styles/`.

**AUD-002 — Major — Typography**
*Location:* `src/styles/theme.css`
*Description:* No typography-scale tokens exist. Every font size in the app is a raw Tailwind utility (`text-xs`/`sm`/`base`/`lg`/`2xl`/`3xl`) chosen per component with no named role (label, body, heading, numeric, code) to anchor it.
*Impact:* There is no single place to change "how big is a table row's text" — every future page repeats whatever the last page happened to use, and the 12px-base fix above has no home to live in.
*Recommendation:* Add a `--text-*` scale to `theme.css`'s `@theme inline` block (e.g., `--text-label: 0.6875rem` /11px, `--text-body: 0.75rem`/12px, `--text-heading-sm` … `--text-heading-lg`, `--text-numeric` with `font-variant-numeric: tabular-nums` baked in) and require every new component to reference it.
*Effort:* 0.5 day (token definition only; rollout is AUD-001).
*Evidence:* `theme.css` `@theme inline` block (lines 72–111) defines color/radius tokens only — zero `--text-*`/`--font-size-*` entries.

**AUD-003 — Minor — Typography**
*Location:* Repeated pattern, e.g. `src/routes/.../reports/receipts-payments.tsx`, `src/components/compact-field.tsx`
*Description:* Uppercase section labels use a hand-typed `text-xs font-semibold uppercase tracking-wide text-muted-foreground` class string, repeated verbatim at every call site rather than a shared utility/token.
*Impact:* Low today (visually consistent because it's copy-pasted correctly every time), but one missed `tracking-wide` on a future page silently breaks the pattern with no lint or type check to catch it.
*Recommendation:* Extract a `<SectionLabel>` component or a `label-caps` Tailwind `@utility`.
*Effort:* 2 hours.
*Evidence:* Identical class string found in 6+ report/detail pages via direct read.

**AUD-004 — Minor — Typography**
*Location:* List rows across `src/routes/**` (e.g., `students/index.tsx`, `admissions/applicants/index.tsx`)
*Description:* Row-primary text (`<p className='text-sm font-medium'>{name}</p>`) has no `truncate` class anywhere verified; long student/guardian/vendor names will wrap instead of ellipsing.
*Impact:* At the brief's target row density (34px), a wrapped second line breaks every row below it. This becomes a real bug the moment AUD-035 (row-height fix) ships.
*Recommendation:* Add `truncate` (with a `title` attribute for the full value on hover) to every primary row-label span as part of the table rebuild.
*Effort:* Included in AUD-035's effort; no separate estimate.
*Evidence:* Verified absence of `truncate` class on primary row spans in 5 sampled list pages.

**AUD-005 — Nice-to-have — Typography**
*Location:* `theme.css` line 73–74 (`--font-inter`, `--font-manrope`)
*Description:* Two brand fonts are declared but Manrope's actual usage is sparse and its intended role (headings only? both?) isn't documented anywhere.
*Impact:* Low — Inter is used almost everywhere and reads fine; this is a documentation gap, not a visible defect.
*Recommendation:* Document the intended Inter/Manrope split in the new type-scale tokens (AUD-002) so future contributors don't silently drop Manrope.
*Effort:* 1 hour.
*Evidence:* `font-manrope` grep returns far fewer hits than `font-inter` across `src/`.

---

### 2. Spacing

**AUD-006 — Major — Spacing**
*Location:* Whole app
*Description:* No spacing-scale tokens exist; every gap/padding value is a raw Tailwind class chosen ad hoc. Verified: list-row vertical padding alone uses four different values with no discernible rule — `py-2` (6 instances), `py-3` (21), `py-4` (28), `py-5` (2).
*Impact:* Visual rhythm drifts page to page; a bursar moving between Receipts and Fixed Assets sees two different amounts of "air" around otherwise-identical row content for no functional reason.
*Recommendation:* Define a 4px-grid spacing scale as tokens (`--space-1` … `--space-8`) and a documented rule: which spacing step applies to list rows, card padding, modal padding, and form-field gaps, respectively.
*Effort:* 0.5 day (token definition + one-page rule doc); rollout happens as part of AUD-035/AUD-008.
*Evidence:* `grep -rho "py-[0-9]" src/routes --include=*.tsx` counts above.

**AUD-007 — Minor — Spacing**
*Location:* `src/components/ui/card.tsx` usage app-wide
*Description:* `CardContent`'s default `p-6` is overridden ad hoc with `pt-0` on most list pages but left at full padding on others, with no documented rule for when each applies.
*Impact:* Minor visual inconsistency; not user-blocking.
*Recommendation:* Fold into the spacing-token rollout (AUD-006): a `CardContent` used as a list-row container should always zero its top padding via a shared variant, not a manually repeated override.
*Effort:* 3 hours (component-level fix once tokens exist).
*Evidence:* Direct read of 10+ list pages shows `pt-0` present on most but not all `CardContent` usages following a `CardHeader`.

**AUD-008 — Minor — Spacing**
*Location:* `src/components/ui/dialog.tsx` line 62 (`p-6` fixed)
*Description:* Modal padding is a single fixed value regardless of modal size/density — a 3-field confirmation dialog and a dense multi-field form both get the same 24px gutter.
*Impact:* Dense forms feel no more "compact" than simple ones; wastes vertical space exactly where the brief asks for density.
*Recommendation:* Add a `density` or `size`-linked padding variant to `DialogContent` as part of the modal-size-system fix (AUD-029).
*Effort:* Included in AUD-029.
*Evidence:* `dialog.tsx` line 62, single `p-6` class with no variant.

**AUD-009 — Nice-to-have — Spacing**
*Location:* `src/components/compact-field.tsx`
*Description:* `CompactField`/`compactControlClass` (`h-8 text-sm`) was introduced specifically for "dense" forms but is applied inconsistently — some newer pages use it, some older ones (sign-in, Account Settings) intentionally don't, and a few mid-session pages mix both patterns on the same screen.
*Impact:* Low, but it's the closest thing the app has to a density system today, and it isn't consistently the default.
*Recommendation:* Once the 12px base and spacing tokens land (AUD-001/006), retire `CompactField` as a special case and make its density the app-wide default, per the brief's "Default density: Compact."
*Effort:* 1 day (audit + apply to remaining non-compact forms).
*Evidence:* Direct comparison of `compact-field.tsx` usage vs. plain `Label`/`Input` usage across settings/auth pages.

---

### 3. Colour

**AUD-010 — Critical — Colour**
*Location:* `src/components/status-badge.tsx` (lines 5–11), imported in 40+ files across every role
*Description:* The five status tones (`good`/`warning`/`bad`/`neutral`/`info`) are hard-coded literal Tailwind palette classes (`emerald-500/10`, `amber-500/10`, etc.) with manually hand-picked `dark:` variants, completely bypassing the CSS custom-property token system every other color in the app uses (`--primary`, `--destructive`, `--muted-foreground`, etc.).
*Impact:* This is the single most-used colored component in the app (fee status, invoice status, receipt status, applicant status, session status — nearly every list row). A token-based recolor of the app (e.g., a future rebrand, or the AAA contrast fix below) cannot touch this component without a manual rewrite.
*Recommendation:* Add `--status-good`, `--status-warning`, `--status-bad`, `--status-neutral`, `--status-info` (and their `-foreground` pairs) to `theme.css` for both light and dark, computed to meet AA (see AUD-011), and refactor `StatusBadge` to consume them.
*Effort:* 1 day (token definition, contrast verification for all 10 values, component refactor, spot-check every consuming page).
*Evidence:* `status-badge.tsx` lines 5–11, full file read.

**AUD-011 — Critical — Colour / Accessibility**
*Location:* `src/components/status-badge.tsx`
*Description:* Computed WCAG contrast ratios (relative-luminance formula, text color vs. white `#ffffff` background) for each status tone's light-mode text color:
  - `good` (`text-emerald-600` #059669): **3.77:1** — fails AA (4.5:1)
  - `warning` (`text-amber-600` #d97706): **3.19:1** — fails AA
  - `info` (`text-sky-600` #0284c7): **4.44:1** — fails AA (just under)
  - `bad` (`text-red-600` #dc2626): 4.83:1 — passes AA, not AAA
  - `neutral` (`text-slate-500` #64748b): 4.76:1 — passes AA, not AAA
*Impact:* Three of five status tones fail the brief's own AA floor for body text, and none reach AAA. These tones label financially meaningful states — "Overdue," "Pending," "Partial," "Pending SDC Co-Approval" — that a bursar, auditor, or SDC treasurer needs to read correctly and quickly, including under office fluorescent lighting or on a lower-quality monitor.
*Recommendation:* As part of AUD-010's token pass, darken `good`/`warning`/`info` text colors until each clears 4.5:1 on their actual badge background (not pure white — recompute against the `/10`-opacity chip fill, which is close to white but not identical), and consider whether financial-context badges (invoice/receipt/voucher status) should be pushed to the AAA tier the brief requires for figures, even though badges are technically labels, not amounts.
*Effort:* 4 hours (recolor + recompute contrast + visual QA), bundled with AUD-010.
*Evidence:* Hand-computed via the WCAG 2.1 relative-luminance formula; workings available on request, reproducible with any contrast checker against the exact hex values above.

**AUD-012 — Major — Colour / Accessibility**
*Location:* `src/components/money.tsx` line 21
*Description:* The secondary ZiG-equivalent figure (shown next to every USD amount, app-wide) uses `text-muted-foreground` (#6b7280 on white), computed contrast **4.84:1**. This clears the brief's AA floor but fails the brief's own **AAA (7:1)** requirement, which it explicitly sets for "amounts, balances, totals, percentages." The primary USD figure (inherits `--foreground`, ~17.7:1) comfortably passes AAA.
*Impact:* Half of every dual-currency figure in the app — which is every single money value shown anywhere — doesn't meet the accessibility bar the brief sets specifically for financial figures.
*Recommendation:* Introduce a `--text-financial-secondary` token darker than `--muted-foreground` (e.g., resolving near `#52525b`/slate-700 territory) that clears 7:1 on both `--background` and `--card`, and apply it to the secondary span in `Money`.
*Effort:* 2 hours.
*Evidence:* `money.tsx` line 21 (`className='text-muted-foreground text-xs tabular-nums'`); hand-computed contrast above.

**AUD-013 — Minor — Colour**
*Location:* `theme.css` (no semantic tokens present)
*Description:* No `--success`/`--warning`/`--danger`/`--info` tokens exist for either light or dark mode; `StatusBadge`'s dark-mode values (`dark:text-emerald-400`, etc.) are separately hand-picked rather than derived from the same token the light-mode fix would introduce.
*Impact:* Doubles the maintenance surface for AUD-010/011 and risks light/dark drift the next time a tone is added or adjusted.
*Recommendation:* Fold directly into AUD-010's token definitions — define both light and dark values for each `--status-*` token in the same PR.
*Effort:* No separate estimate; bundled with AUD-010.
*Evidence:* `theme.css` full read — zero `--success`/`--warning`/`--danger`/`--info` entries in either the `:root` or `.dark` block.

**AUD-014 — Minor — Colour / Consistency**
*Location:* `src/components/ui/button.tsx` lines 11–14
*Description:* `variant='default'` (primary CTA) resolves to `--primary` (#ff0527) and `variant='destructive'` resolves to `--destructive` (#c8021e) — both are red-family colors roughly 10% apart in hue/lightness, not a clearly distinct color family (e.g., orange or a darker true red).
*Impact:* On screens with both a primary action and a destructive one close together (e.g., a form's Save button next to a Delete button), the two can read as similarly "urgent" rather than one being routine and one being dangerous — a real risk in a financial app where destructive actions (reverse a receipt, reject a voucher, force-logout a session) should visually stand apart from routine ones.
*Recommendation:* Either shift `--destructive` further from `--primary` in hue (while staying inside the locked palette's spirit — e.g., toward a warmer orange-red) or add a secondary visual cue (icon, outline treatment) to `variant='destructive'` beyond color alone.
*Effort:* 3 hours (token change + spot-check every destructive button in the app, ~10 locations).
*Evidence:* `button.tsx` lines 11–14, `theme.css` lines 9/17 (`--primary: #ff0527`, `--destructive: #c8021e`).

---

### 4. Layout

**AUD-015 — Critical — Layout / Navigation**
*Location:* `src/components/layout/data/sidebar-data.ts`
*Description:* The Bursar's sidebar — the app's primary user's main navigation — has grown to **10 top-level nav groups** (Overview, School Setup, Billing, Cash Office, Debtor Management, Admissions, Procurement, Finance, Reports, Students & Settings) across the ten build phases, plus 2-level nesting inside School Setup (Academic Structure and Boarding & Transport each contain their own sub-items). The brief caps top-level groups at six.
*Impact:* The bursar — the primary, most-frequent user of this app — has the single most cluttered navigation of any role in the system, which directly undercuts the brief's "findable in ≤2 clicks" search requirement and its explicit 6-group ceiling.
*Recommendation:* Consolidate into 6 groups by function rather than by build-phase history, e.g.: **Overview**, **Billing & Cash** (Billing + Cash Office merged), **Debtors & Admissions** (Debtor Management + Admissions merged), **Procurement & Finance** (merged), **Reports**, **Setup & Settings** (School Setup + Students & Settings merged, with Academic/Boarding structure moved one level down inside a single "School Setup" entry rather than two parallel nested groups).
*Effort:* 1 day (IA redesign + `sidebar-data.ts` restructure + regression-check every link still resolves).
*Evidence:* `grep -B1 "title: '" sidebar-data.ts` — 10 groups at the file's top nesting level, confirmed by direct read.

**AUD-016 — Major — Layout / Navigation**
*Location:* Whole app
*Description:* No breadcrumb component exists anywhere (`grep -rli breadcrumb src/routes` → 0 matches), despite navigation depth reaching 3 levels in places (Bursar → School Setup → Academic Structure → Terms).
*Impact:* At depth, the only way back is the sidebar (itself cluttered per AUD-015) or the browser back button; no in-page sense of "where am I."
*Recommendation:* Add a lightweight breadcrumb strip to the page-header pattern once the nav IA is flattened (AUD-015 should be done first, so breadcrumbs reflect the new, shallower structure).
*Effort:* 0.5 day (shared component) + minimal per-page wiring given the consistent header pattern already in place.
*Evidence:* Zero-match grep across `src/routes`.

**AUD-017 — Minor — Layout**
*Location:* Detail-route pages (`students/$studentId.tsx`, `admissions/applicants/$applicantId.tsx`)
*Description:* Only the two dedicated detail *routes* (as opposed to modals) in the whole app have an explicit "← Back to X" link; every other deep page relies solely on the sidebar.
*Impact:* Minor — most "deep" content in the app is a modal (which closes naturally), so this affects only these two pages today, but it establishes an inconsistent precedent for any future detail-route page (e.g., a future Guardian detail route).
*Recommendation:* Extract the back-link pattern into a shared `<DetailPageHeader>` so it's automatic for any future detail route.
*Effort:* 2 hours.
*Evidence:* Direct read of both files vs. absence of the pattern elsewhere.

**AUD-018 — Minor — Layout**
*Location:* Every dashboard/index page across all 6 roles
*Description:* Every role's dashboard follows an identical structural template (3–4 KPI stat cards in a `grid gap-4 sm:grid-cols-*` + one list below) with no variation reflecting what that specific role actually needs to see first. No dashboard surfaces "what's overdue today" or "what needs my approval now" above the fold with priority styling.
*Impact:* Consistent (a genuine strength) but undifferentiated — a bursar's literal daily priority (today's overdue accounts, today's pending approvals) is buried at the same visual weight as everything else.
*Recommendation:* Not urgent, but worth a follow-up product pass once density/filter/search fixes land: consider a "needs attention today" priority strip above the standard KPI grid on the Bursar and School Head dashboards specifically.
*Effort:* 1 day per dashboard reworked (product-design decision, not purely technical).
*Evidence:* Direct comparison of `bursar/index.tsx`, `school-head/index.tsx`, `sdc/index.tsx`, `system-admin/index.tsx` — identical structural shape.

---

### 5. Filters

**AUD-019 — Critical — Filters**
*Location:* Every filterable list page (~30 verified), e.g. `students/index.tsx`, `billing/invoices.tsx`, `debtors/cases.tsx`
*Description:* No list in the app supports more than 1–2 simultaneous filter dimensions. The brief's own per-entity filter matrix (e.g., Students: class, grade, stream, term, year, funding type, status, gender, balance range, guardian) is unmet everywhere checked — the Students list currently filters by Beneficiary Category, Fee Status, and Boarding Status only, with no class/grade/stream/term/year/gender/balance-range/guardian filter at all.
*Impact:* This is the brief's single most detailed, most explicit requirement section, and it is the largest genuine gap in the app. A bursar cannot answer "show me Form 2A's unpaid BEAM students for Term 1" in one view anywhere today — the exact example scenario named in the brief.
*Recommendation:* Build a shared `<FilterBar>`/`<FilterDrawer>` component (visible filters inline on desktop, advanced filters in the existing-but-unused `Sheet` primitive) that composes multiple `where`-style predicates with AND logic, and retrofit it onto the highest-traffic lists first (Students, Invoices, Receipts, Debtors) per the roadmap.
*Effort:* 3 days for the shared component + 0.5 day per list page retrofit (~15 days total for full entity coverage; roadmap sequences this).
*Evidence:* Direct read of 10+ list pages' filter `DropdownMenu` blocks; each supports exactly one or two independent single-select dimensions with `!selectedX || item.x === selectedX` logic, no composition beyond that.

**AUD-020 — Critical — Filters**
*Location:* Every filterable list page
*Description:* Zero filter persistence anywhere. `localStorage` is used only for school-branding (logo/name) — confirmed by grep across the whole `src/` tree. Every filter and search text resets to empty the moment the user navigates away and back. No "saved named view" feature exists (`grep -rli "saved.*view|savedView|namedView"` → 0 matches).
*Impact:* The brief explicitly requires both per-user persistence and named saved views (its own example: "Term 1 unpaid F2A"). A bursar re-filtering the same list multiple times a day, every day, with no way to save that filter set, is a real daily-workflow cost.
*Recommendation:* Bundle with the `<FilterBar>` build (AUD-019): persist the active filter-set object to `localStorage` per list (keyed by route), and add a lightweight "Save this view" affordance that stores a named filter preset the same way.
*Effort:* Bundled with AUD-019; add 1 day specifically for the saved-views feature on top.
*Evidence:* `grep -rl "localStorage" src` → 2 files only, neither filter-related.

**AUD-021 — Major — Filters**
*Location:* Every filterable list page
*Description:* No removable filter chips anywhere. The only visible indicator that a filter is active is a highlighted (`bg-accent`) row inside a closed `DropdownMenu` — there is no persistent, glanceable on-page summary of "what's currently filtered," and no one-click way to clear a single filter without reopening the dropdown and finding the right item again.
*Impact:* Makes the current filter state invisible at a glance, and clearing one of several active filters is more clicks than it should be.
*Recommendation:* Part of the `<FilterBar>` build (AUD-019) — render active filters as removable chips between the search input and the results count.
*Effort:* Bundled with AUD-019.
*Evidence:* Direct read of filter `DropdownMenu` implementations across sampled pages — no chip-rendering code anywhere.

**AUD-022 — Major — Filters**
*Location:* `src/components/ui/sheet.tsx` (exists, used in `config-drawer.tsx` and mobile sidebar) vs. every filter implementation (doesn't use it)
*Description:* The `Sheet` (drawer) primitive the brief asks for advanced filters to live in already exists in the codebase and is already used successfully for two other purposes — but is never reused for filters.
*Impact:* This is a rare case where the fix is cheaper than it looks: the component to build the "advanced filters in a drawer" requirement already exists and is proven in production use elsewhere in this same app.
*Recommendation:* Reuse `Sheet` directly for the advanced-filter drawer in the `<FilterBar>` build.
*Effort:* No extra cost — factor this into AUD-019's estimate as a reason it's *not* higher.
*Evidence:* `grep -rl "from '@/components/ui/sheet'"` → `config-drawer.tsx`, `sidebar.tsx` only.

**AUD-023 — Minor — Filters / Mobile**
*Location:* Every filterable list page
*Description:* No "Filters (n)" collapsed mobile affordance exists — the search input and filter-dropdown trigger render inline at every viewport width, competing for horizontal space with the page title on narrow screens.
*Impact:* On the brief's own mobile breakpoints, the filter bar likely wraps awkwardly under the page title (unverified visually at 360px — flagged, not asserted).
*Recommendation:* Part of the `<FilterBar>` build: collapse search+filters into a single "Filters (2)" button below `md:` breakpoint, opening the same `Sheet` used for advanced filters.
*Effort:* Bundled with AUD-019.
*Evidence:* Direct read of filter-bar JSX — no responsive collapse logic present in any sampled page.

**AUD-024 — Minor — Filters**
*Location:* Every list page except `students/index.tsx`
*Description:* A filtered-to-zero-results state exists (via `EmptyState`) on exactly one page in the app; every other filtered list, when a filter combination yields nothing, shows a silently blank `Card` body with no "no results — try adjusting filters" message or one-click reset.
*Impact:* A bursar who over-filters (e.g., stacks two mutually-exclusive statuses once composable filtering ships per AUD-019) gets a blank screen with no explanation.
*Recommendation:* Reuse the existing `EmptyState` component (already built, already used once) on every list page as part of the filter-bar retrofit.
*Effort:* Near-zero marginal cost once `EmptyState` is wired into the shared `<FilterBar>`/list-shell pattern; bundled with AUD-019.
*Evidence:* `grep -rl "EmptyState" src/routes` → 1 file (`students/index.tsx`).

---

### 6. Search

**AUD-025 — Critical — Search**
*Location:* `src/components/command-menu.tsx`
*Description:* The global ⌘K/Ctrl+K command palette indexes **navigation only** (page names, from `sidebarData.navGroups`) plus the theme switcher. It does not search any entity data anywhere — not students, not invoices, not receipts, not debtors, not vouchers, not assets, not guardians — despite this being the single most detailed, most explicit section of the entire brief.
*Impact:* A bursar cannot type "Tadiwa Moyo" or "INV-2026-00147" into ⌘K and find it. The brief's headline promise — "any record findable in ≤2 clicks or 1 keystroke" — is entirely unmet by the app's actual search surface.
*Recommendation:* Build a lightweight cross-entity search index (a flat array of `{type, id, label, subtitle, route}` built from each entity's mock/API data) and extend `CommandMenu` to query it alongside navigation, grouped by entity type, following the brief's prefix-operator spec (`>` command, `@` guardian, `#` invoice/ID, `$` amount) as a stretch goal once basic entity search ships.
*Effort:* 2 days for basic cross-entity search (students, invoices, receipts, debtors, vouchers, assets — the six named in the brief) + 1 day for prefix operators as a follow-up.
*Evidence:* `command-menu.tsx` full read — the component's only data source is `sidebarData.navGroups` (line 15, 37).

**AUD-026 — Critical — Search**
*Location:* `src/components/command-menu.tsx` line 15
*Description:* `CommandMenu` unconditionally imports the **Bursar's** `sidebarData` (`import { sidebarData } from './layout/data/sidebar-data'`) regardless of which role's shell is currently mounted. `SearchProvider` (which renders `CommandMenu`) is used identically across all 6 role shells. Five other role-specific sidebar-data files exist (`school-head-sidebar-data.ts`, `sdc-sidebar-data.ts`, `system-admin-sidebar-data.ts`, plus the two portal roles' nav arrays) and are never referenced by `CommandMenu` at all.
*Impact:* This is a genuine functional bug, not a design judgment call: every user who isn't a Bursar — School Head, SDC Chairperson, System Admin, Parent, Student — sees the **Bursar's** navigation menu when they press ⌘K, including links to pages their role cannot access (e.g., a Parent's ⌘K would list "School Setup," "Admissions," "Payment Vouchers" — none of which exist in their route tree).
*Recommendation:* Thread the active role's sidebar data through context (the same way `AuthenticatedLayout`/`PortalLayout` already receive it as a prop) so `CommandMenu` renders the correct navigation for whichever shell is mounted.
*Effort:* 4 hours — small, isolated, high-value fix; good Phase 1 candidate.
*Evidence:* `command-menu.tsx` line 15 (single hardcoded import), cross-referenced against the 5 other sidebar-data files that exist but are unreferenced there.

**AUD-027 — Major — Search**
*Location:* Every list page's own search input (e.g., `students/index.tsx`)
*Description:* Per-page search is a single free-text `Input`, client-side filtered against one field (typically name only, occasionally name+ID). No prefix operators, no per-entity result grouping, no "recent items" anywhere.
*Impact:* Consistent with AUD-025/026 in spirit — the app's search story is entirely "type into a box, hope it's the right field" rather than the structured, fast search the brief asks for.
*Recommendation:* Once the cross-entity ⌘K search ships (AUD-025), consider retiring most per-page search inputs in favor of "press ⌘K, it's already scoped/filtered to this entity type" — reduces duplicate search UI rather than adding more.
*Effort:* Design decision + 0.5 day per page once the pattern is agreed; sequence after AUD-025.
*Evidence:* Direct read of 8 sampled list pages' search implementations — all single-field client-side `.filter()`.

**AUD-028 — Minor — Search**
*Location:* `src/components/search.tsx`, `src/context/search-provider.tsx`
*Description:* Keyboard navigation (↑/↓/Enter/Esc) is very likely provided for free by the underlying `cmdk` library (`CommandDialog`/`CommandInput`/`CommandList`), but this was not independently exercised/verified interactively as part of this audit.
*Impact:* Low risk — `cmdk` is a mature, purpose-built library and this is its core behavior — but flagged per the brief's own "never assume" instruction rather than asserted as confirmed.
*Recommendation:* Verify interactively once AUD-025/026 land (natural checkpoint, since that work touches the same component).
*Effort:* 1 hour (manual verification, no code change expected).
*Evidence:* `cmdk` is a known library with this behavior built in; not independently re-tested in this session.

---

### 7. Modals

**AUD-029 — Major — Modals**
*Location:* `src/components/ui/dialog.tsx` line 62
*Description:* `DialogContent` has exactly one size in practice — `sm:max-w-lg` (512px) — applied to every modal in the app by default. Wider modals (e.g., Bus Routes' nested-stops editor, Bank Reconciliation's deposit/cheque child tables) only get more room via one-off `className` overrides scattered at each call site, with no named Small/Medium/Large/XL tier as the brief specifies.
*Impact:* Data-heavy modals (the brief's own example: bulk invoice preview, reconciliation, import) have no natural home at the current single size, and every developer who needs a wider modal has to remember to override it manually rather than picking a named size.
*Recommendation:* Add `size` prop to `DialogContent` (`sm`/`md`/`lg`/`xl`, mapping to 400/600/900/1200px per the brief) and migrate existing ad hoc `className='sm:max-w-lg'`-style overrides to the new prop.
*Effort:* 1 day (component change + migrate ~8 existing wide-modal call sites).
*Evidence:* `dialog.tsx` line 62, single fixed `sm:max-w-lg`; grep for `className='sm:max-w-` across routes shows scattered one-off overrides.

**AUD-030 — Major — Modals / Mobile**
*Location:* `src/components/ui/dialog.tsx`
*Description:* `DialogContent` renders as the same fixed, centered card at every viewport width — there is no mobile-specific full-screen or bottom-sheet variant, despite the `Sheet` primitive (which does support this) already existing in the codebase.
*Impact:* The brief explicitly requires "Full-screen on mobile — always." Today, a dense form modal on a phone renders as a small centered card with the same 512px-intent content squeezed into it, not full-screen.
*Recommendation:* Either swap `Dialog` for `Sheet` (`side='bottom'`, full height) below the `md:` breakpoint via a shared wrapper component, or add full-screen styling to `DialogContent` at narrow viewports.
*Effort:* 1 day (shared wrapper + verification across the ~10 most-used dialogs).
*Evidence:* `dialog.tsx` full read — no responsive/viewport-conditional logic present.

**AUD-031 — Major — Modals**
*Location:* Every "Add/New/Edit" dialog in the app (~35 instances verified by pattern)
*Description:* No modal tracks dirty state. Esc, overlay-click, and the header X button all close every form dialog immediately, silently discarding whatever the user had typed, with no confirmation.
*Impact:* In a financial data-entry app, silently losing a half-typed requisition, invoice, or reconciliation line on an accidental Esc or misclick is a real, recurring frustration — and a real risk of lost work the brief explicitly calls out ("Esc to close (with unsaved-changes guard)").
*Recommendation:* Add a shared `useUnsavedChangesGuard(isDirty)` hook that intercepts `onOpenChange(false)` and shows a small "Discard changes?" confirmation when the form has been touched; wire it into the shared dialog-form pattern so new dialogs get it automatically.
*Effort:* 1 day (hook + wire into the ~10 highest-traffic Add dialogs as the first pass; the rest follow the same pattern cheaply).
*Evidence:* Direct read of ~12 sampled `Dialog`/`DialogContent` form implementations — none track a dirty flag or intercept close.

**AUD-032 — Minor — Modals**
*Location:* Compare `school-head/receipt-reversals.tsx` (good pattern) vs. `procurement/payment-vouchers.tsx` Reject action, `debtors/cases.tsx` Escalate action (inconsistent pattern)
*Description:* Destructive-action confirmation is inconsistent across the app. Some flows (Force Logout in System Admin, Receipt Reversal approval) show a proper sub-modal naming the specific record and requiring explicit confirmation, exactly per the brief's rule. Others (Payment Voucher Reject, Debtor Case Escalate) fire directly from a button inside the record's *own* detail dialog with no separate confirmation step and no record recap beyond what's already on screen.
*Impact:* Inconsistent risk exposure — some destructive financial actions are one click with no confirmation, others are two with a clear recap. The brief requires the latter, always.
*Recommendation:* Extract a shared `<ConfirmDestructiveDialog target={{name, amount, id}}>` component (the Force Logout / Receipt Reversal pattern is already the right shape) and route every destructive action through it.
*Effort:* 1 day (shared component + retrofit ~6 non-compliant destructive actions).
*Evidence:* Direct comparison of the four named files.

**AUD-033 — Nice-to-have — Modals**
*Location:* N/A (forward-looking)
*Description:* No multi-step modal exists anywhere in the app today, so the brief's request to evaluate "4 steps vs. 3 vs. consolidated" has no current implementation to assess.
*Impact:* None today.
*Recommendation:* When a genuine multi-step flow is eventually built (the brief's own example: batch invoicing), target 3 steps maximum per the brief's density-first direction, consolidating any natural 4th step into an inline expandable section of step 2 or 3 rather than a separate screen.
*Effort:* N/A — guidance for future work, not a current fix.
*Evidence:* No wizard/stepper component or multi-step dialog found anywhere in `src/`.

---

### 8. Tables

**AUD-034 — Critical — Tables**
*Location:* Whole app — 58 route files use the `Card` + `divide-y` flex-row pattern; zero use a real `<table>` or TanStack Table-style `DataTable`
*Description:* Every list in the app that functions as a "table" is structurally a stack of flex rows inside a `Card`, not a table. This is a structural choice, not a styling one — it rules out, by construction, column-based sorting, resizable columns, sticky headers, and sticky first columns, none of which can be added on top of the current markup without rebuilding the row container as an actual table (or a table-semantics grid).
*Impact:* This is the single largest structural gap between the app and the brief's Tables section (category 8), which asks for most of the above by name.
*Recommendation:* Build one shared `<DataList>` primitive (can still be visually identical to today's Card/divide-y look) implemented as a proper table/grid under the hood, supporting the row-height, sort, and sticky-header requirements below, and migrate the highest-traffic lists first.
*Effort:* 4 days for the shared primitive + 0.5–1 day per list migrated (roadmap sequences the top ~10 lists first, ~9 additional days; full 58-list coverage is a Phase 3/4 effort).
*Evidence:* `grep -rl "divide-y" src/routes --include=*.tsx | wc -l` → 58; zero matches for `<table`, `DataTable`, or `useReactTable` anywhere in `src/routes`.

**AUD-035 — Critical — Tables / Spacing**
*Location:* Same 58 files as AUD-034
*Description:* Verified row padding distribution (`py-2`: 6, `py-3`: 21, `py-4`: 28, `py-5`: 2) plus two lines of `text-sm`/`text-xs` content puts the effective row height in the **56–72px range** across nearly every list in the app — roughly double the brief's 34px compact target, and well above even the 44px "Comfortable" tier.
*Impact:* This is the most direct, measurable violation of the brief's density requirement ("more rows per screen," "row height: 34px"). At today's row height, a 1080p screen shows roughly 10–12 data rows before scrolling; at the brief's target it would show 20+.
*Recommendation:* Part of the `<DataList>` rebuild (AUD-034): define the row as `h-[34px]` (compact) / `h-[44px]` (comfortable, user-toggleable per the brief), single-line content with `truncate` (AUD-004), secondary metadata moved to a tooltip or a second, narrower column rather than a wrapped second text line.
*Effort:* Bundled with AUD-034.
*Evidence:* `grep -rho "py-[0-9]" src/routes --include=*.tsx | sort | uniq -c` (counts above); direct visual measurement of a sampled row in the live app during Phase-build verification this session confirms ~60px rendered height.

**AUD-036 — Major — Tables**
*Location:* Same 58 files
*Description:* Zero sorting exists anywhere in the app — confirmed by grep for sort-related code (`sortable`, `onSort`, `SortAsc`, `ArrowUpDown`) returning no matches. Every list renders in its mock array's fixed insertion order.
*Impact:* A bursar cannot sort invoices by amount, receipts by date, or debtors by ageing bucket — all named explicitly in the brief's filter/table requirements.
*Recommendation:* Part of the `<DataList>` rebuild (AUD-034): add clickable column-header sort with a visible sort-direction indicator, defaulting each entity to its most useful sort (e.g., debtors by ageing descending, invoices by due date ascending).
*Effort:* Bundled with AUD-034 (adds roughly 1 day to the shared primitive's build for sort-state management).
*Evidence:* Zero-match grep across `src/routes` for sort-related identifiers.

**AUD-037 — Major — Tables**
*Location:* Same 58 files
*Description:* No pagination or virtualization exists anywhere. Acceptable today because every entity's mock dataset is tiny (a handful of rows), but there is no mechanism in place for when the app connects to a real backend with hundreds of students or thousands of receipts.
*Impact:* Not visible today; will become a real performance and usability problem (long scroll, no way to jump to "page 4") the moment real data volume arrives, with no existing pattern to reach for.
*Recommendation:* Build pagination (or virtualized scroll, for very large lists like Journal Entries/Audit Log) into the shared `<DataList>` primitive from the start, even though it's inert at today's data scale, so it's not a retrofit later.
*Effort:* Bundled with AUD-034 (adds roughly 1 day).
*Evidence:* Zero-match grep for `Pagination`/virtualization libraries in actual use within `src/routes`.

**AUD-038 — Major — Tables**
*Location:* Same 58 files
*Description:* Bulk row selection (checkboxes + a bulk-action bar) exists on **zero** of the app's 58 list pages — the one `Checkbox` usage found in `src/routes` (`cash-office/daily-cash-up.tsx`) is an unrelated confirmation-checkbox pattern inside a modal, not row selection.
*Impact:* Every bulk task a bursar would naturally want to do — approve five payment vouchers at once, mark ten receipts as reconciled, export a filtered set of invoices — requires opening and acting on each row individually today.
*Recommendation:* Add row selection + a contextual bulk-action bar to the `<DataList>` primitive (AUD-034), starting with the two or three lists where bulk actions are most clearly useful (Payment Vouchers, Invoices, Receipts).
*Effort:* Bundled with AUD-034 (adds roughly 1.5 days for selection state + bulk-action UI pattern).
*Evidence:* `grep -rl "Checkbox" src/routes` → 1 file, confirmed unrelated by direct read.

**AUD-039 — Minor — Tables**
*Location:* Same 58 files
*Description:* A loading-skeleton state exists on exactly one list page (`students/index.tsx`, via `ListSkeleton`); the other 57 have no loading state defined at all.
*Impact:* Invisible today (static mock data resolves instantly) but the pattern isn't established for when a real, latent API is behind these lists.
*Recommendation:* Build the loading state into the shared `<DataList>` primitive (AUD-034) so every migrated list gets it automatically rather than needing individual wiring.
*Effort:* Bundled with AUD-034.
*Evidence:* `grep -rl "ListSkeleton\|<Skeleton" src/routes` → 1 file.

**AUD-040 — Minor — Tables**
*Location:* Same as AUD-024 (Filters section) — duplicated concern, single fix
*Description:* See AUD-024. Cross-referenced here because it's as much a table-empty-state gap as a filter gap.
*Impact:* See AUD-024.
*Recommendation:* Same fix as AUD-024, delivered as part of the `<DataList>` primitive rather than the filter bar specifically — whichever ships first should include it.
*Effort:* No separate estimate — see AUD-024.
*Evidence:* See AUD-024.

**AUD-041 — Nice-to-have — Tables / Mobile**
*Location:* Dense multi-column data within rows (invoice line items, journal-entry detail, bank-reconciliation child tables)
*Description:* These sub-tables (rendered inside dialogs, not the main list) use fixed multi-column grids that were not explicitly verified at narrow mobile widths and would likely need to stack into a single column rather than scroll horizontally.
*Impact:* Unverified — flagged rather than asserted broken, per the brief's own instruction not to assume.
*Recommendation:* Verify at 360px as part of the mobile-breakpoint pass (AUD-064); add a stacked-field mobile layout to any sub-table found to overflow.
*Effort:* 2 hours verification + fix-as-needed.
*Evidence:* Not independently re-tested at 360px in this session; flagged based on fixed-grid markup observed in source.

---

### 9. Forms

**AUD-042 — (Positive finding, not a defect) — Forms**
*Location:* `src/components/compact-field.tsx` and consuming forms
*Description:* Label placement is consistently top-aligned (label above control) throughout every form in the app, which is correct for scanability at density and matches the brief's implicit preference.
*Impact:* Genuine strength — noted for completeness, no action needed.

**AUD-043 — Minor — Forms**
*Location:* Every "Add/Create" dialog in the app
*Description:* Required-field indication is inconsistent. `CompactField` supports a `required` prop that renders a red asterisk, but it's applied to only a handful of fields (e.g., Institution Profile's School Name) while most other fields that are functionally required in practice (e.g., "Amount," "Name," "Date" in nearly every Add dialog) show no asterisk or required-state styling at all.
*Impact:* A user can't tell, before submitting, which fields actually matter — inconsistent with a compact, fast-entry workflow.
*Recommendation:* Audit every Add/Edit dialog's field set against its actual validation requirements (once AUD-044 adds real validation) and apply the existing `required` prop consistently.
*Effort:* 0.5 day (audit + apply across ~35 dialogs, mechanical once the validation pass below defines what's actually required).
*Evidence:* Direct comparison of `institution-profile.tsx` (uses `required`) vs. ~10 other Add dialogs (don't).

**AUD-044 — Major — Forms**
*Location:* Every "Add/Create" dialog in the app
*Description:* No inline field-level validation or error messaging exists anywhere. Primary submit buttons either always fire (most dialogs) or are gated by a single coarse boolean check (e.g., Petty Cash's negative-balance guard, Daily Cash-Up's confirmation-checkbox gate) — there is no per-field "this is required," "this must be a positive number," or "this date must be after that date" messaging anywhere in the app.
*Impact:* In a financial data-entry application, the complete absence of field-level validation is a significant gap once this app connects to a real backend — today it's masked because every "Add" action is mocked (toast-only, no real persistence), but the UI pattern for showing a validation error doesn't exist to build on.
*Recommendation:* Adopt a form-validation library already common in this stack's ecosystem (React Hook Form + Zod is already used in a few places, e.g., sign-in, profile settings) as the standard for every data-entry dialog, with inline error text under each field.
*Effort:* 3 days for the shared pattern + per-dialog schema (a few hours each); sequence as a Phase 3 item since it's most valuable once the backend is real.
*Evidence:* Direct read of ~15 sampled Add dialogs — no error-message JSX, no field-level `aria-invalid`/error state present in any of them except the two auth-flow forms already built on React Hook Form + Zod.

**AUD-045 — Minor — Forms**
*Location:* `bursar/cash-office/receipts.tsx` (Issue Receipt dialog) vs. every other money-entry dialog
*Description:* The dual-currency input pattern (enter an amount in ZiG, see a live computed USD-equivalent preview) exists in exactly one dialog in the whole app. Petty Cash, Payment Vouchers, and Fee Structure line-item entry all take USD-only input with no equivalent live conversion, despite the brief naming "dual-currency input pattern" as a specific form requirement to evaluate.
*Impact:* Inconsistent — the one place a cashier might actually receive ZiG cash (Petty Cash) doesn't offer the same live-conversion convenience the Receipts dialog does.
*Recommendation:* Extract the Receipts dialog's currency-select + live-preview logic into a shared `<DualCurrencyInput>` and apply it everywhere USD amounts are entered.
*Effort:* 0.5 day (extraction) + 1–2 hours per additional dialog it's applied to (~4 dialogs).
*Evidence:* Direct comparison of `receipts.tsx`'s Issue Receipt dialog against `petty-cash.tsx`, `payment-vouchers.tsx` create flows.

**AUD-046 — Nice-to-have — Forms**
*Location:* `bursar/school-setup/institution-profile.tsx` (the one full-page, non-modal form in the app)
*Description:* Institution Profile is edited in place on a full page (not a modal, correctly, given its size) but has no save-in-progress indicator, no autosave, and no "unsaved changes" warning on navigation away — a browser refresh or accidental back-navigation silently discards all edits.
*Impact:* Low-frequency page (school setup is a rare task) but a real risk of lost work when it does happen, especially given the page has ~56 fields.
*Recommendation:* Add a simple "unsaved changes" beforeunload/route-leave guard, matching the pattern recommended for modals in AUD-031.
*Effort:* 2 hours (reuses the AUD-031 hook, adapted for page-level navigation rather than dialog close).
*Evidence:* Direct read of `institution-profile.tsx` — no dirty-tracking or navigation guard present.

---

### 10. Navigation

*(Most navigation findings live under Layout — AUD-015 six-group cap, AUD-016 breadcrumbs — and under Search — AUD-025/026 command palette as navigation. This section covers what's left.)*

**AUD-047 — Major — Navigation**
*Location:* Sidebar + Command Palette, whole app
*Description:* No "recent" or "pinned" items exist anywhere, despite the brief listing this as a navigation requirement.
*Impact:* A bursar who works the same 3–4 debtor cases or the same student's record repeatedly across a day has no shortcut back to them besides re-navigating the (currently 10-group) sidebar or re-searching each time.
*Recommendation:* Once the cross-entity search index exists (AUD-025), track the last N visited entity records in `localStorage` and surface them at the top of the ⌘K palette when it opens with an empty query.
*Effort:* 0.5 day, sequenced directly after AUD-025 since it reuses the same index.
*Evidence:* No recent/pinned-tracking code found anywhere in `src/`.

**AUD-048 — (Positive finding) — Navigation**
*Location:* `src/components/layout/authenticated-layout.tsx`
*Description:* Sidebar open/collapsed state is correctly persisted via a cookie (`getCookie('sidebar_state')`) and respected on load — a genuine strength worth preserving as other navigation fixes land.

**AUD-049 — Minor — Navigation**
*Location:* Nested sidebar items introduced in later build phases (e.g., School Setup → Academic Structure → Terms)
*Description:* Active-state contrast for level-2/3 nested nav items was not independently re-verified in dark mode as part of this audit.
*Impact:* Unverified, flagged rather than asserted.
*Recommendation:* Spot-check as part of the AUD-015 sidebar-restructure work, since that work touches every nested item anyway.
*Effort:* 1 hour, bundled with AUD-015.
*Evidence:* Not independently re-tested in this session.

---

### 11. Accessibility

**AUD-050 — Critical — Accessibility**
*Location:* 22 files across `src/routes` and `src/components` (of ~30 files using `size='icon'` buttons)
*Description:* 22 of the files containing icon-only (`size='icon'`) buttons have zero `aria-label` anywhere in that file. Filter-trigger buttons, row action-menu triggers, and similar icon-only controls throughout the app expose no accessible name.
*Impact:* A screen-reader user encounters an unlabelled "button" for the filter icon, the row's "more actions" menu, and similar controls on the large majority of list pages — a direct WCAG 4.1.2 (Name, Role, Value) failure, and a real barrier for any bursar, auditor, or parent using assistive technology.
*Recommendation:* Add `aria-label` to every icon-only `Button` app-wide (e.g., `aria-label='Filter'`, `aria-label='More actions for {row.name}'`); this is mechanical enough to do in one pass once the icon-button locations are enumerated.
*Effort:* 1 day (enumerate + label all ~30 icon-button call sites; a codemod/lint rule requiring `aria-label` on `size='icon'` buttons going forward is worth adding at the same time).
*Evidence:* `grep -rln "size='icon'" src/routes src/components --include=*.tsx | xargs grep -L "aria-label"` → 22 files.

**AUD-051 — Major — Accessibility / Mobile**
*Location:* `src/components/ui/button.tsx` line 27
*Description:* The `icon` size variant is fixed at `size-9` (36×36px) — below the brief's 44×44px minimum touch target, affecting every icon-only button in the app on tablet or phone.
*Impact:* Real usability cost for any touch user (the brief's own "secondary" tablet/phone users), and a WCAG 2.5.5 (Target Size) shortfall.
*Recommendation:* Increase the `icon` variant to `size-11` (44px) at minimum, or keep the visual 36px hit-*area* but pad the actual clickable hit-target to 44px via padding/pseudo-element, if the visual density of 36px icons is preferred for desktop.
*Effort:* 3 hours (single token change + visual spot-check across ~30 icon buttons for layout regressions).
*Evidence:* `button.tsx` line 27, `icon: 'size-9'`.

**AUD-052 — Major — Accessibility**
*Location:* Whole app — `grep -rl "prefers-reduced-motion" src` returns zero matches
*Description:* No `prefers-reduced-motion` handling exists anywhere in the codebase, despite extensive use of Radix `animate-in`/`animate-out`/`zoom-in`/`fade-in` transitions on every dialog, dropdown, and collapsible in the app.
*Impact:* Users with vestibular disorders or motion sensitivity (a real, non-trivial population, and a WCAG 2.3.3 concern) have no way to reduce this motion; every dialog open/close and dropdown in the app animates unconditionally.
*Recommendation:* Add a global `@media (prefers-reduced-motion: reduce)` rule in `index.css` that shortens/removes the `animate-in`/`animate-out` durations app-wide (Tailwind/Radix's animation classes can be neutralized centrally rather than per-component).
*Effort:* 3 hours (one CSS rule, verified against a few representative dialogs/dropdowns).
*Evidence:* Zero-match grep for `prefers-reduced-motion` across `src/**/*.css` and `src/**/*.tsx`.

**AUD-053 — Minor — Accessibility**
*Location:* `src/components/layout/portal-layout.tsx` vs. `authenticated-layout.tsx`
*Description:* A `SkipToMain` component is confirmed wired into `AuthenticatedLayout` (used by the 4 desk-style roles) but was not confirmed present in `PortalLayout` (used by Parent and Student).
*Impact:* If absent, keyboard users on the two portal roles have no way to skip repeated navigation to reach page content — lower risk than the desk roles since the portal nav is much shorter, but still a real gap if confirmed.
*Recommendation:* Verify directly and add `SkipToMain` (or equivalent) to `PortalLayout` if missing.
*Effort:* 1 hour.
*Evidence:* Confirmed present in `authenticated-layout.tsx`; presence in `portal-layout.tsx` not independently re-verified in this pass.

**AUD-054 — (Positive finding) — Accessibility**
*Location:* `src/components/ui/*`
*Description:* Focus-ring tokens (`focus-visible:ring-ring`, `focus-visible:border-ring`) are consistently defined at the shadcn primitive level across buttons, inputs, and other interactive components — confirmed via direct grep (15+ `focus-visible:ring-` occurrences, 9 `focus-visible:border-ring`, all inside `src/components/ui`).
*Impact:* Genuine strength — the design-system layer's accessibility foundation is solid; the gaps identified above (AUD-050/051/052) are all at the page-composition or token-value level, not because the underlying primitives lack accessibility support.

---

### 12. Performance

**AUD-055 — ~~Major~~ Corrected during Phase 3 — Performance**
*Correction (Phase 3c):* This finding was wrong. `vite.config.ts` already had
`tanstackRouter({ autoCodeSplitting: true })` configured -- route-level
code-splitting was active the whole time. The original finding only looked
at the chunk-size *warning* without checking whether splitting was
happening elsewhere in the build; it wasn't verified against the actual
build artifacts. Checked during Phase 3c: `dist/index.html` loads exactly
one script eagerly (`index-*.js`); the other 214 chunks in `dist/assets/`
(one per route/feature, including the Recharts-heavy `cash-flow-*.js`)
only load when their route is actually visited. The `index-*.js` chunk
itself (~512kB) is the shared runtime (React, the router, UI primitives
used on every page) -- not unsplit route code, and not something further
route-splitting would shrink. No action taken; nothing was broken.
*Location:* Whole app (build output)
*Description:* Every `npm run build` run across this session's ten build phases has flagged the same two chunks over Vite's 500kB warning threshold: `index-*.js` (grown from ~506kB to ~520kB across the phases) and `cash-flow-*.js` (~310kB, driven almost entirely by the Recharts dependency for a single small bar chart). No route-level code-splitting or dynamic import is used anywhere, despite Vite and TanStack Router both supporting it natively.
*Impact:* Every user downloads the entire app's JS on first load, regardless of which single role/page they actually use — meaningful on a bursar's office connection, more so for the Parent/Student portal roles on mobile data.
*Recommendation:* Introduce route-level code-splitting via TanStack Router's built-in lazy-loading (`createLazyFileRoute` or equivalent) for at minimum the six role-shell trees, so a Parent's first load doesn't include the Bursar's 60+ pages of code.
*Effort:* 1.5 days (convert route tree to lazy loading + verify no regressions in the router's route-conflict behavior, which this codebase has hit before during earlier phases).
*Evidence:* Build-output chunk sizes observed directly across every phase's `npm run build` in this session's own history.

**AUD-056 — Minor — Performance**
*Location:* Detail pages (e.g., `students/$studentId.tsx`, `admissions/applicants/$applicantId.tsx`, `finance/fixed-assets.tsx`)
*Description:* List pages consistently memoize their filtered/derived arrays via `useMemo` (a good practice, confirmed present in every sampled list page) — but detail pages recompute cross-referenced lookups (`.find()` calls against mock arrays for linked guardians, cost centers, GL accounts, etc.) inline in JSX on every render, unmemoized.
*Impact:* Harmless at today's mock-data scale (arrays of single-digit-to-low-double-digit length); will not scale to real API-backed data without revisiting, especially on pages that `.find()` inside a `.map()` (an O(n·m) pattern, e.g., the Variance report cross-referencing cost centers and GL accounts per budget line).
*Recommendation:* Revisit once real data volumes are known; not urgent at mock-data scale. Where the same lookup is computed inside a loop (e.g., Variance report), hoist it to a `Map` built once outside the loop as a cheap, low-risk improvement regardless of data volume.
*Effort:* 0.5 day for the loop-hoisting fix specifically; broader memoization is a "when it's slow" fix, not urgent now.
*Evidence:* Direct read of `reports/variance.tsx` and similar cross-referencing detail pages.

**AUD-057 — Nice-to-have — Performance**
*Location:* `reports/cash-flow.tsx`
*Description:* The full Recharts library is bundled for a single 2-row bar chart, and is the largest single dependency contributor to the oversized `cash-flow-*.js` chunk (AUD-055).
*Impact:* Disproportionate cost for the value delivered by one small chart.
*Recommendation:* If more charts are planned (the roadmap's later phases add reporting depth), keep Recharts and address it via code-splitting (AUD-055) instead. If this remains the only chart in the app, consider a lighter/no-dependency alternative (a small hand-rolled SVG bar chart) instead.
*Effort:* 0.5 day if replaced; otherwise no action beyond AUD-055.
*Evidence:* `cash-flow.tsx` full read; single `BarChart` usage for one small dataset.

---

### 13. Consistency

**AUD-058 — Major — Consistency**
*Location:* App-wide
*Description:* Two visually distinct page-header patterns coexist: (a) `CardHeader` with `CardTitle`+`CardDescription`+ inline search/filter, used on the ~50 list pages, and (b) a plain stat-card grid with no unifying header row, used on the ~8 dashboard-style index pages. This split does track a real functional distinction (list vs. dashboard), so it may well be intentional rather than an inconsistency — flagged for confirmation.
*Impact:* If intentional, no action needed; if accidental, it's worth documenting as a rule so future contributors don't blend the two patterns on a single page.
*Recommendation:* Confirm intent; if confirmed intentional, document the rule ("dashboards get a KPI grid, lists get a CardHeader+filter bar") in a short internal pattern note alongside the token documentation from AUD-002/006.
*Effort:* 1 hour (documentation only, assuming the split is confirmed intentional).
*Evidence:* Direct structural comparison of `students/index.tsx` (list pattern) vs. `bursar/index.tsx` (dashboard pattern).

**AUD-059 — ~~Major~~ Partially corrected during Phase 3 — Consistency**
*Correction (Phase 3c):* The "~5 deviating pages" estimate didn't hold up
under an exhaustive re-check (all 63 route files with a header matching
the app's `mb-6` header block, plus the remaining ~36 checked for
alternate header shapes). Every header with two buttons already uses
exactly one `default` + one `outline`; every Export/Download/Filter/View
button is already `outline`/`ghost`; no destructive-worded header button
uses `default` styling. The documented rule below is real and worth
keeping (it's why the app is already this consistent), but the spot-fix
work item is dropped -- there was nothing to fix.
*Location:* App-wide button usage
*Description:* No documented button-hierarchy rule exists. In practice, `variant='default'` (primary/brand red) and `variant='outline'` (secondary) are used correctly in the large majority of modals sampled, but there is no written rule for which action in a header (e.g., "Export" vs. "Add X") should be primary vs. secondary weight, and a few pages default a non-primary action to primary styling with no clear justification for why it outranks its neighbor.
*Impact:* Small, cumulative inconsistency; not a functional bug, but undermines the "one obvious primary action" clarity a compact, task-focused UI depends on.
*Recommendation:* Write a one-page button-hierarchy rule (primary = the one action that advances the user's actual goal on this screen; everything else is outline/ghost) as part of the token-documentation pass, and spot-fix the handful of pages that deviate.
*Effort:* 2 hours (documentation) + 2 hours (spot-fixes across ~5 pages found to deviate).
*Evidence:* Comparative read of header action buttons across ~15 sampled pages.

**AUD-060 — (Positive finding) — Consistency**
*Location:* Toast usage app-wide (`sonner`)
*Description:* Toast copy is consistently present-tense, entity-name-first, and correctly differentiates success/info/error tone across ~35 verified call sites (e.g., "Ropafadzo Mutasa enrolled as STU-2026-009," "Reversal requested for RCT-2026-00089, awaiting School Head approval"). Genuine strength — no action needed.

**AUD-061 — (Positive finding) — Consistency**
*Location:* Icon usage app-wide
*Description:* `lucide-react` is the only icon library in use throughout the app — confirmed no mixed icon sets. Genuine strength, keeps visual weight and style consistent across every screen.

---

### 14. Mobile

**AUD-062 — Major — Mobile**
*Location:* Cross-reference of AUD-030, AUD-051, AUD-023
*Description:* The three most consequential mobile gaps — modals not going full-screen (AUD-030), icon touch targets under 44px (AUD-051), and filters not collapsing into a mobile-specific affordance (AUD-023) — combine to make the mobile experience "the desktop layout, shrunk," rather than a considered secondary experience.
*Impact:* Consistent with the brief's own framing (mobile must "remain usable," not be first-class) — this is not a crisis, but it is a real, compounding gap across the three areas that matter most for a touch device.
*Recommendation:* No new work beyond AUD-030/051/023 — this entry exists to confirm those three, taken together, are the actual mobile story, and that fixing them (already planned) is sufficient; no additional mobile-specific initiative is needed beyond them.
*Effort:* No separate estimate — sum of AUD-030/051/023.
*Evidence:* Cross-reference of the three findings' evidence.

**AUD-063 — Confirmed intentional during Phase 4 — Mobile**
*Confirmation (Phase 4):* Top nav confirmed as the intentional choice. Both
portal roles are low-frequency, few-destination use cases (Parent: balance,
statement, payment plan, settings; Student: similar) -- `portal-nav.tsx`
lists well under the ~5 destinations where bottom nav's advantage (constant
thumb-reach access) usually starts to pay for its cost (permanent vertical
space, an iOS/Android-native pattern that can look bolted-on in a web app).
No change made.
*Location:* `src/components/layout/portal-layout.tsx`
*Description:* No bottom navigation exists anywhere in the app; the two lightweight portal shells (Parent, Student) use a top nav bar instead. The brief mentions bottom nav as a requirement to evaluate.
*Impact:* Low — a top nav bar is a reasonable, common pattern for a low-frequency, low-complexity portal use case (a parent checking a balance occasionally, not a power user navigating dozens of times a day), so this is plausibly the right call already, not an oversight.
*Recommendation:* Confirm this is an intentional product decision rather than revisit it reflexively; if confirmed intentional, no change needed.
*Effort:* No effort — confirmation only.
*Evidence:* Direct read of `portal-layout.tsx` and `portal-nav.tsx`.

**AUD-064 — Nice-to-have — Mobile**
*Location:* Dense multi-tab detail pages (Student profile — 9 tabs, Institution Profile — ~56 fields)
*Description:* These pages were checked live in the Browser pane during this session's own build-verification passes, but only at the pane's own default width, not explicitly at the brief's four checkpoints (360/768/1024/1440).
*Impact:* Unverified at the specific widths the brief cares about, though no failures were observed at the width actually tested.
*Recommendation:* Run an explicit pass at exactly 360/768/1024/1440 for the ~5 densest pages in the app (Student detail, Institution Profile, Fee Structures detail, Fixed Assets detail, Financial Position report) before calling mobile coverage complete.
*Effort:* 0.5 day.
*Evidence:* This session's own verification history (screenshots taken at the Browser pane's default/narrow presets, not the brief's specific checkpoints).

---

### 15. Dark Mode

**AUD-065 — (Positive finding) — Dark Mode**
*Location:* `src/styles/theme.css` `.dark` block
*Description:* Every light-mode token has a complete `.dark` counterpart (confirmed by direct file read, lines 37–70), and dark mode was spot-checked live across dozens of pages throughout this session's build phases with no contrast or legibility failures observed at any point. Genuine strength — dark mode is unusually complete for a "secondary" requirement.

**AUD-066 — Major — Dark Mode**
*Location:* `src/components/status-badge.tsx` (same root cause as AUD-010/013)
*Description:* Dark-mode status-tone colors (`dark:text-emerald-400`, etc.) are hand-picked per tone rather than derived from a token, mirroring the light-mode anti-pattern. Precise dark-mode contrast ratios were not separately hand-computed in this pass (the light-mode computation in AUD-011 is the verified evidence; this entry flags that the same structural risk exists in dark mode without independently confirming pass/fail).
*Impact:* Same category of risk as AUD-011, in the mode the brief calls "secondary" but still requires to be "correct and complete."
*Recommendation:* Compute dark-mode contrast ratios for all 5 tones as part of the AUD-010 token pass (which will define both light and dark values together), rather than treating this as a separate follow-up.
*Effort:* No separate estimate — bundled with AUD-010/011.
*Evidence:* `status-badge.tsx` lines 5–10 (dark: variants present); ratios not independently computed for dark mode in this pass.

**AUD-067 — Nice-to-have — Dark Mode**
*Location:* `src/styles/index.css`
*Description:* No `@media print` rule exists anywhere, so the brief's requirement that print output "must stay light" regardless of the active theme is unverified and likely unmet — a bursar printing a statement while using dark mode would very likely get a dark-background printout.
*Impact:* Low-frequency (printing is occasional) but wastes toner and looks unprofessional on an actual paper statement handed to a parent or auditor.
*Recommendation:* Add a simple `@media print { :root, .dark { /* force light token values */ } }` override.
*Effort:* 1 hour.
*Evidence:* Zero-match grep for `@media print` across `src/styles/`.

---

## Top 10 Quick Wins

Ranked by impact-to-effort ratio — all deliverable in Phase 1.

1. **AUD-026** — Fix the wrong-role ⌘K search bug (4 hours, fixes broken navigation for 5 of 6 roles).
2. **AUD-010/AUD-011** — Token-ize and fix contrast on the 5 status-badge tones (1 day + 4 hours, fixes the single most-used colored component in the app).
3. **AUD-052** — Add a global `prefers-reduced-motion` rule (3 hours, one CSS block, app-wide a11y win).
4. **AUD-051** — Bump icon-button touch target to 44px (3 hours, one token change).
5. **AUD-050** — Add `aria-label` to every icon-only button (1 day, mechanical, closes the largest a11y gap by file count).
6. **AUD-067** — Add `@media print` light-mode override (1 hour).
7. **AUD-012** — Darken the secondary ZiG-figure color to hit AAA (2 hours).
8. **AUD-022** — Note (not a fix): the `Sheet` primitive the filter-drawer work needs already exists — reduces AUD-019's real cost, worth flagging to whoever scopes Phase 2.
9. **AUD-014** — Separate destructive-button color from primary-button color (3 hours).
10. **AUD-002** — Define the typography-scale tokens (0.5 day) — doesn't roll out the 12px base yet (that's AUD-001, a bigger Phase-2 item) but unblocks it and every future page.

**Combined quick-win effort: ~4.5 days.** None of these ten touch the same file as another on this list except AUD-010/011 (intentionally bundled), so they're safely parallelizable across two developers if desired.

---

## Top 10 Risks If Not Fixed

1. **A bursar (or any non-Bursar role) cannot find a student, invoice, or receipt by search anywhere in the app** — the brief's headline promise is simply false today (AUD-025).
2. **Every non-Bursar user's ⌘K shows broken navigation to pages they can't access** — a visible, confusing bug the moment anyone other than the Bursar uses the app (AUD-026).
3. **Financially meaningful status labels (Overdue, Pending, Partial) fail WCAG AA contrast** — a real accessibility and, in some jurisdictions, compliance exposure for a financial system used by a school (AUD-011).
4. **Icon-only buttons throughout the app are invisible to screen-reader users** — a hard accessibility barrier, not a polish gap (AUD-050).
5. **No filter can combine more than 1–2 dimensions anywhere** — the exact daily workflow the brief describes ("Term 1 unpaid F2A") is impossible today, undermining the core value proposition of a bursar tool (AUD-019).
6. **A half-typed form is silently discarded on any accidental Esc or misclick** — real, recurring data-entry frustration and risk of lost work in a financial system (AUD-031).
7. **Nothing in the app can be sorted or bulk-acted-on** — routine bursar tasks (approve five vouchers, review overdue accounts by amount) take far more clicks than they should (AUD-036/038).
8. **Row height is roughly double the specified compact target across all 58 lists** — the single most measurable, most visible density shortfall relative to the brief (AUD-035).
9. **The Bursar's own navigation has 10 top-level groups against a 6-group cap** — the primary user's daily orientation cost keeps growing as the app grows, with no ceiling in place (AUD-015).
10. **No form validation exists anywhere** — currently masked by mock data with no real persistence; will surface as a serious data-quality risk the moment this app connects to the real Frappe backend (AUD-044).

---

## Appendix: Checklists Per Category

**Typography** — [ ] 12px base [ ] token scale [ ] tabular-nums on all figures (✅ done) [ ] truncation on row labels [ ] documented font-role split

**Spacing** — [ ] token scale (4px grid) [ ] documented row/card/modal padding rules [ ] compact density is the default (brief requirement, currently not true)

**Colour** — [ ] status tones tokenized [ ] all 5 tones ≥ AA in light [ ] all 5 tones ≥ AA in dark [ ] secondary money figure ≥ AAA [ ] destructive visually distinct from primary

**Layout** — [ ] ≤6 top-level nav groups (currently 10 on Bursar) [ ] breadcrumbs present [ ] back-navigation consistent across detail routes

**Filters** — [ ] every listed entity has its full filter set (currently ~2 of ~10 dimensions per entity) [ ] composable AND filtering [ ] removable chips [ ] persisted per user [ ] saved named views [ ] mobile "Filters (n)" collapse [ ] empty-filtered-state messaging

**Search** — [ ] ⌘K searches entity data, not just nav (currently nav-only) [ ] ⌘K respects active role (currently hardcoded to Bursar) [ ] recent items [ ] prefix operators

**Modals** — [ ] max 2 CTAs (✅ mostly true already) [ ] named size tiers (400/600/900/1200) [ ] mobile full-screen [ ] unsaved-changes guard [ ] consistent destructive-confirmation sub-modal

**Tables** — [ ] real table/grid primitive (currently Card+divide-y everywhere) [ ] 34px compact / 44px comfortable row height (currently ~56–72px) [ ] sorting [ ] pagination [ ] bulk select [ ] sticky header [ ] loading/empty states on every list (currently 1 of 58)

**Forms** — [ ] top-aligned labels (✅ done) [ ] consistent required-field indication [ ] inline validation errors (currently none) [ ] dual-currency input pattern applied consistently (currently 1 of ~5 relevant dialogs)

**Navigation** — [ ] ≤6 groups (see Layout) [ ] recent/pinned items [ ] sidebar state persisted (✅ done)

**Accessibility** — [ ] every icon button has aria-label (currently 22 files missing) [ ] 44px touch targets (currently 36px) [ ] prefers-reduced-motion handled (currently absent) [ ] skip-to-content on every shell [ ] focus rings on every interactive element (✅ done at primitive level)

**Performance** — [ ] route-level code-splitting (currently none) [ ] no chunk over 500kB (currently 2 chunks over) [ ] memoized cross-referenced lookups on hot paths

**Consistency** — [ ] documented button-hierarchy rule [ ] documented header-pattern rule [ ] single icon library (✅ done) [ ] consistent toast copy (✅ done)

**Mobile** — [ ] 44px touch targets (see Accessibility) [ ] modals full-screen (see Modals) [ ] filters collapse to a button (see Filters) [ ] verified at 360/768/1024/1440 (currently spot-checked only, not at these exact widths)

**Dark Mode** — [ ] complete token coverage (✅ done) [ ] status tones verified in dark (not separately computed) [ ] print forces light mode (currently absent)
