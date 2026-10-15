# Edupro Theme — Improvement Roadmap

**Companion to:** `theme-audit-2026-09-14.md` (full findings, evidence, and per-finding detail)
**Date:** 2026-09-14

This roadmap sequences all 67 audit findings into four phases. Sequencing logic:

- **Phase 1** fixes things that are cheap, isolated, and either broken (bugs) or visibly wrong (contrast, motion, touch targets) — no dependencies on each other, safe to parallelize across developers.
- **Phase 2** builds the three shared systems the brief's biggest requirements depend on: the filter bar, the navigation restructure, and the modal size/mobile/guard system — plus rolling out the type/spacing tokens Phase 1 defined.
- **Phase 3** is the big structural one: rebuilding "tables" as real tables, and adding form validation — both genuinely large, both best done once Phase 2's shared patterns exist to build on.
- **Phase 4** is everything that's either low-urgency, a product decision rather than a pure technical fix, or scales with how many of the app's 58 list pages get migrated (a number that can legitimately keep growing after this roadmap's initial pass).

---

## Phase 1 — Immediate

**Total effort: ~6.5 days** (safely parallelizable — no finding in this phase depends on another finding in this phase)

| Finding | Fix | Effort |
|---|---|---|
| AUD-026 | Fix ⌘K hardcoding the Bursar's sidebar for every role | 4h |
| AUD-010 | Token-ize the 5 status-badge tones (light + dark) | 1d |
| AUD-011 | Darken good/warning/info tones to clear AA contrast | 4h (bundled with AUD-010) |
| AUD-013 | Define light+dark values together for the new tokens | — (bundled with AUD-010) |
| AUD-012 | Darken secondary (ZiG) money-figure color to clear AAA | 2h |
| AUD-014 | Separate destructive-button color from primary | 3h |
| AUD-050 | Add `aria-label` to every icon-only button (~30 sites) | 1d |
| AUD-051 | Bump icon-button touch target to 44px | 3h |
| AUD-052 | Add global `prefers-reduced-motion` rule | 3h |
| AUD-053 | Verify/add `SkipToMain` on `PortalLayout` | 1h |
| AUD-067 | Add `@media print` light-mode override | 1h |
| AUD-028 | Manually verify ⌘K keyboard nav (↑↓/Enter/Esc) | 1h |
| AUD-002 | Define typography-scale tokens (not yet rolled out) | 4h |
| AUD-006 | Define spacing-scale tokens (not yet rolled out) | 4h |
| AUD-064 | Verify the 5 densest pages at 360/768/1024/1440 | 4h |

**Expected outcome:** the app's most visible bugs and accessibility failures are gone (broken cross-role search, failing-contrast status chips, unlabelled icon buttons, undersized touch targets, no reduced-motion support), and the token foundation Phase 2's larger rollouts need is in place.

**Dependencies:** none — this phase can start immediately and run in parallel across developers.

---

## Phase 2 — Short-term (this sprint)

**Total effort: ~15 days**

### 2a. Filter system (the brief's largest single requirement)
| Finding | Fix | Effort |
|---|---|---|
| AUD-019 | Build shared `<FilterBar>`/`<FilterDrawer>`, composable AND filtering | 3d |
| AUD-020 | Persist filter state to localStorage; add "Save this view" | +1d |
| AUD-021 | Removable filter chips | bundled |
| AUD-022 | Reuse existing `Sheet` primitive for the drawer | bundled (cost saving, not extra) |
| AUD-023 | Mobile "Filters (n)" collapse | bundled |
| AUD-024 | Wire `EmptyState` into every filtered list | bundled |
| — | Retrofit onto Students, Invoices, Receipts, Debtors (highest traffic) | 0.5d × 4 = 2d |

**Subtotal: ~6 days.** Remaining ~26 filterable lists follow in Phase 4 as an ongoing rollout, not a one-time cost.

### 2b. Navigation restructure
| Finding | Fix | Effort |
|---|---|---|
| AUD-015 | Consolidate Bursar's 10 nav groups into 6 | 1d |
| AUD-016 | Add breadcrumbs (build on the new, shallower structure) | 0.5d |
| AUD-017 | Extract shared back-link pattern for detail routes | 2h |
| AUD-049 | Spot-check nested active-state contrast in dark mode | 1h |

**Subtotal: ~2 days.**

### 2c. Modal system
| Finding | Fix | Effort |
|---|---|---|
| AUD-029 | Named size tiers (400/600/900/1200) on `DialogContent` | 1d |
| AUD-008 | Density-linked modal padding | bundled |
| AUD-030 | Mobile full-screen behavior | 1d |
| AUD-031 | Shared unsaved-changes guard hook, wired into top ~10 dialogs | 1d |
| AUD-032 | Shared `<ConfirmDestructiveDialog>`, retrofit ~6 inconsistent flows | 1d |

**Subtotal: ~4 days.**

### 2d. Typography/spacing rollout + minor cleanup
| Finding | Fix | Effort |
|---|---|---|
| AUD-001 | Roll the new 12px-base tokens out across the app (codemod + QA) | 2d |
| AUD-003, 004, 005, 007, 009 | Section-label utility, row truncation, font-role docs, card-padding rule, retire CompactField special-casing | ~1d combined |

**Subtotal: ~3 days.**

**Expected outcome:** the three requirements the brief spends the most words on — filters, search (already fixed in Phase 1), and modals — are structurally in place for the app's highest-traffic surfaces; the Bursar's navigation is back under the 6-group cap; the app is visibly at its target density on the pages that got the 12px rollout.

**Dependencies:** AUD-002/006 (Phase 1 tokens) must land before AUD-001's rollout; AUD-022 benefits from (but doesn't strictly require) AUD-019 being scoped first.

---

## Phase 3 — Medium-term (next 2 sprints)

**Total effort: ~20 days**

### 3a. Table rebuild
| Finding | Fix | Effort |
|---|---|---|
| AUD-034 | Build shared `<DataList>` real-table primitive | 4d |
| AUD-035 | 34px/44px row height, single-line + truncate | bundled |
| AUD-036 | Column sorting | bundled (+1d for state management) |
| AUD-037 | Pagination (or virtualization for Journal Entries/Audit Log) | bundled (+1d) |
| AUD-038 | Row selection + bulk-action bar | bundled (+1.5d) |
| AUD-039 | Loading skeleton | bundled |
| AUD-040 | Empty state | bundled |
| — | Migrate top 10 highest-traffic lists onto the new primitive | 0.5–1d × 10 ≈ 8d |

**Subtotal: ~15.5 days.** Remaining ~48 lists continue in Phase 4.

### 3b. Form validation
| Finding | Fix | Effort |
|---|---|---|
| AUD-044 | Adopt React Hook Form + Zod as the standard for every data-entry dialog | 3d shared pattern |
| AUD-043 | Apply `required` indicator consistently, driven by real schemas | 0.5d |
| AUD-045 | Extract `<DualCurrencyInput>`, apply to ~4 more dialogs | 0.5d + few hrs each |
| AUD-046 | Unsaved-changes guard on Institution Profile (reuses AUD-031's hook) | 2h |

**Subtotal: ~4.5 days.**

### 3c. Performance + consistency
| Finding | Fix | Effort |
|---|---|---|
| AUD-055 | ~~Route-level code-splitting~~ — already done (`autoCodeSplitting: true`), corrected finding | 0d |
| AUD-056 | Hoist repeated `.find()` lookups to a `Map` on hot paths | 0.5d |
| AUD-058 | Confirm/document the list-vs-dashboard header split | 1h |
| AUD-059 | Document button-hierarchy rule — spot-fix dropped, none found on re-check | 2h |

**Subtotal: ~0.75 day** (down from ~2.5d — AUD-055 needed no work and AUD-059 had nothing to spot-fix, see Phase 3c completion notes).

**Expected outcome:** the app's "tables" are real tables on its highest-traffic screens (sort, paginate, bulk-act all work), every data-entry form gives real-time validation feedback, and the JS bundle no longer ships the whole app to every role on first load.

**Dependencies:** 3a benefits from 2c's modal work (bulk-action confirmations reuse `<ConfirmDestructiveDialog>`); 3b's dual-currency work reuses the Receipts dialog pattern already in the app.

---

## Phase 4 — Long-term (backlog)

**Total effort: ongoing — not a fixed one-time cost**

| Finding | Fix | Effort |
|---|---|---|
| — | Migrate the remaining ~48 list pages onto `<DataList>` (3a) and ~26 lists onto `<FilterBar>` (2a) | ~0.5d per list, batched by role/priority |
| AUD-018 | "Needs attention today" priority strip on Bursar/School Head dashboards | 1d each (product-design decision, sequence after user feedback on Phases 1–3) |
| AUD-047 | Recent/pinned items in ⌘K | 0.5d |
| AUD-057 | Replace Recharts with a lighter chart if it remains the only chart | 0.5d (optional) |
| AUD-041 | Verify + fix mobile stacking for dialog sub-tables | 2h |
| AUD-063 | Confirm Parent/Student top-nav (vs. bottom-nav) is an intentional decision | 0 (confirmation only) |
| AUD-033 | Apply the "max 3 steps" rule when the first real multi-step modal is built | N/A — guidance, not a current task |

**Expected outcome:** full-app consistency once every list and filter has been migrated; the roadmap's structural work (Phases 1–3) pays off incrementally as each additional page is migrated, rather than requiring a single big-bang rollout.

**Dependencies:** everything in Phase 4 depends on the shared primitives built in Phases 2–3 already existing.

---

## Quick Wins (Top 10)

*(Reproduced from the audit report for convenience — see the audit for full evidence on each.)*

1. AUD-026 — Fix ⌘K's wrong-role bug (4h)
2. AUD-010/011 — Token-ize + fix status-badge contrast (1.5d)
3. AUD-052 — Global `prefers-reduced-motion` rule (3h)
4. AUD-051 — 44px icon-button touch target (3h)
5. AUD-050 — `aria-label` on every icon button (1d)
6. AUD-067 — `@media print` light-mode override (1h)
7. AUD-012 — Secondary money-figure AAA contrast (2h)
8. AUD-014 — Separate destructive color from primary (3h)
9. AUD-022 — (cost note) reuse the existing `Sheet` primitive for filters — reduces Phase 2's real cost
10. AUD-002 — Define typography-scale tokens (0.5d, unblocks Phase 2's biggest rollout)

---

## Recommended Order of Execution

1. **Phase 1, all findings, in parallel** across as many developers as available — nothing here blocks anything else, and it removes every currently-broken or currently-failing thing in the app within about a week of calendar time even with one developer.
2. **Phase 2a (filters) and 2b (navigation) in parallel** — different files, no shared dependency, both deliver highly visible wins.
3. **Phase 2c (modals)** — sequence after 2a/2b since the retrofit lists benefit from knowing the final nav structure and filter-bar shape.
4. **Phase 2d (typography rollout)** — do last in Phase 2, once every earlier Phase 2 component has settled on its final spacing so the 12px codemod only has to run once.
5. **Phase 3a (tables) and 3b (validation) in parallel** — independent systems, both large, both benefit from Phase 2's modal/filter work already existing.
6. **Phase 3c (performance/consistency)** — any time after 3a/3b, lower urgency, good "fill the gaps" work between other phases.
7. **Phase 4** — ongoing, prioritize by which list/filter pages the school's actual daily usage touches most (Students, Invoices, Receipts, Debtors, Payment Vouchers first — already the Phase 2/3 pilot set, so this is largely "keep going" rather than a new decision).

**Total effort across all four phases: roughly 6.5 + 15 + 20 + (ongoing) ≈ 42 days of fixed, one-time work**, plus an open-ended Phase 4 tail that scales with how much of the app's 58-list, 30-filter surface gets migrated onto the new shared primitives.
