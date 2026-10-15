# Edupro Theme — Executive Summary

**For:** School Head and SDC
**Date:** 2026-09-14
**In plain terms:** we asked for a design and usability review of the new finance system's screens (not the accounting logic itself, and not the Frappe server behind it — just the part staff actually look at and click on). This is what we found.

---

## What Is Working Well

- **The system looks and feels professional.** The Edupro brand (red, black, the logo) is applied consistently on every screen, in both light and dark mode.
- **Every screen was built to the same pattern**, which is unusual and valuable — it means most of the fixes below get applied once, centrally, rather than needing to be redone on every single page.
- **The underlying building blocks are solid.** Keyboard accessibility, focus highlighting, and dark mode are all well implemented at the foundation level — the issues found are mostly in how those good foundations were *used* on individual screens, not in the foundations themselves.
- **The money display is correct and trustworthy** — every amount shows in US Dollars first, with the ZiG equivalent alongside, using properly aligned figures throughout.

## What Needs Fixing

Three things matter more than everything else in this report:

1. **The search bar (press Ctrl+K anywhere) doesn't actually search for students, invoices, or receipts today — it only searches page names.** A bursar can't type a student's name and find their record this way yet. This is the single most-requested capability in the original brief, and it's the first thing we recommend fixing.
2. **Filtering is basic.** Staff can filter a list by one or two things (e.g., fee status), but not by the combinations they actually need day to day (e.g., "Form 2A, unpaid, Term 1" in one view). Building this properly is the largest piece of work in this report, but also the highest-value one.
3. **The screens show fewer rows at once than they should.** Lists are roughly twice as tall per row as a compact finance tool needs to be, meaning more scrolling than necessary for a bursar working through a long list of accounts.

There are also a handful of accessibility gaps (a few status labels — like "Overdue" — don't have quite enough color contrast for everyone to read comfortably, and some small icon buttons are missing labels for screen-reader users) and one real bug: staff who aren't the Bursar (School Head, SDC, front-office admin) currently see the *Bursar's* menu when they press Ctrl+K, not their own. That one is a quick fix.

None of this is a fundamental problem with the system's direction — it's a well-built app that needs its search, filtering, and table density brought up to the standard the brief asked for.

## What the School Will Gain

- **Faster daily work for the Bursar's office** — finding any record in one or two clicks instead of scrolling through a list, and seeing more of that list at once.
- **A search bar that actually works for everyone**, not just the Bursar.
- **A system that's comfortably usable for staff and parents using assistive technology**, and that reads clearly under normal office lighting.
- **A foundation that scales** — once the shared "search everything," "filter everything," and "real table" building blocks exist, every future screen gets them for free.

## What It Will Cost (Rough Effort)

| Phase | What it covers | Rough time |
|---|---|---|
| **1 — Immediate** | The search bug, the accessibility gaps, the color-contrast fixes | ~1 week |
| **2 — Short-term** | Proper filtering, a cleaner main menu, better pop-up forms | ~3 weeks |
| **3 — Medium-term** | Real, sortable tables; forms that catch mistakes as staff type | ~4 weeks |
| **4 — Long-term** | Rolling the above out to every remaining screen | ongoing, as time allows |

**All figures are developer-days of focused work, not wall-clock time with interruptions** — a single developer working through this roadmap end-to-end would take roughly 8–9 weeks for Phases 1–3; two developers working in parallel where the plan allows (most of Phase 1, and parts of Phase 2) would be meaningfully faster.

## Recommended Next Step

Approve **Phase 1** to start immediately — it is low-risk, fixes the most visible problems (including the cross-role search bug), and takes about a week. Review progress after Phase 1 before committing to Phases 2–4, since Phase 2 is where the bulk of the cost sits and is worth a deliberate go/no-go decision once Phase 1's results are visible.
