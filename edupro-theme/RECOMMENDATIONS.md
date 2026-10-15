# Top 20 Recommendations

Summary of the top 20 fixes from the full design/UX audit (`docs/audit/theme-audit-2026-09-14.md`). Full evidence, impact, and implementation detail for each is in that report; this is a scannable index.

| # | Finding | Severity | Effort | Recommendation |
|---|---|---|---|---|
| 1 | AUD-026 | Critical | 4h | Fix `command-menu.tsx` hardcoding the Bursar's sidebar — every other role's ⌘K search currently shows the wrong navigation menu. |
| 2 | AUD-025 | Critical | 2d | Build cross-entity search (students, invoices, receipts, debtors, vouchers, assets) into ⌘K — today it only searches page names. |
| 3 | AUD-019 | Critical | 3d + 2d rollout | Build a shared composable, multi-dimension `<FilterBar>` — every list today supports only 1–2 filter dimensions at once. |
| 4 | AUD-034 | Critical | 4d + 8d rollout | Rebuild list "tables" (currently `Card`+`divide-y` rows) as a real table primitive with sort/paginate/bulk-select. |
| 5 | AUD-035 | Critical | bundled with #4 | Cut list-row height from ~56–72px to the brief's 34px compact target (44px comfortable toggle). |
| 6 | AUD-011 | Critical | 4h | Darken 3 of 5 status-badge tones — computed contrast ratios (3.19–4.44:1) fail WCAG AA today. |
| 7 | AUD-010 | Critical | 1d | Move status-badge colors from hard-coded Tailwind classes onto proper design tokens. |
| 8 | AUD-050 | Critical | 1d | Add `aria-label` to every icon-only button — 22 files have none today, a real screen-reader barrier. |
| 9 | AUD-015 | Critical | 1d | Consolidate the Bursar's sidebar from 10 top-level groups down to the brief's 6-group cap. |
| 10 | AUD-020 | Critical | 1d | Persist filters to localStorage and add named "saved views" — currently zero filter persistence anywhere. |
| 11 | AUD-031 | Major | 1d | Add an unsaved-changes guard to modals — every form dialog today discards input silently on Esc/misclick. |
| 12 | AUD-044 | Major | 3d | Adopt React Hook Form + Zod validation as the standard for every data-entry dialog — no field-level validation exists today. |
| 13 | AUD-029 | Major | 1d | Add named modal size tiers (400/600/900/1200px) — every dialog today defaults to one fixed 512px size. |
| 14 | AUD-030 | Major | 1d | Make modals go full-screen on mobile — they render as a small centered card at every viewport width today. |
| 15 | AUD-012 | Major | 2h | Darken the secondary (ZiG) money-figure color — it clears AA (4.84:1) but fails the brief's own AAA bar for financial figures. |
| 16 | AUD-051 | Major | 3h | Bump icon-button touch targets from 36px to the 44px minimum. |
| 17 | AUD-052 | Major | 3h | Add a global `prefers-reduced-motion` rule — currently absent despite animation on every dialog/dropdown. |
| 18 | AUD-036/AUD-038 | Major | bundled with #4 | Add sorting and bulk row-selection — both are entirely absent from all 58 list pages today. |
| 19 | AUD-055 | Major | 1.5d | Add route-level code-splitting — two JS chunks consistently exceed 500kB with no lazy-loading anywhere. |
| 20 | AUD-001 | Critical | 2d | Roll the app's base body text down from 14px (`text-sm`) to the brief's specified 12px compact base. |

**See also:** `docs/audit/theme-audit-2026-09-14.md` (full 67-finding report), `docs/audit/theme-roadmap-2026-09-14.md` (phased plan), `docs/audit/theme-executive-summary-2026-09-14.md` (plain-language summary for the School Head/SDC).

**This is an audit-only deliverable.** No source files were modified to produce this list. Fixes proceed only on explicit request.
