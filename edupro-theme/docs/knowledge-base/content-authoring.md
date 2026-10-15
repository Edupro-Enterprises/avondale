# Writing a Knowledge Base Article

## File location

`src/content/knowledge-base/<section>/<chapter>/<NN-slug>.mdx`

Section and chapter directories must already exist (see [`_meta.json`](#metajson), below) — `content-loader.ts` throws a build error for an article whose `section`/`chapter` frontmatter doesn't match the folder it's actually in, or whose section/chapter has no `_meta.json`.

## Frontmatter

Every field below is required unless marked optional. The full schema is [`content-schema.ts`](../../src/features/knowledge-base/lib/content-schema.ts); the controlled vocabularies (`audience`, `article_type`, `school_type`, `school_level`, `status`, `legal_references`) are in [`types/kb.ts`](../../src/features/knowledge-base/types/kb.ts) — a value outside those lists fails validation.

```yaml
---
title: "How to Do a Cash Up"
slug: "how-to-do-a-cash-up"          # lowercase-kebab-case, unique across the whole KB
section: "05-getting-money-in"        # must match the folder this file lives in
chapter: "02-cash-office"             # must match the folder this file lives in
audience: ["bursar", "cashier"]       # who this is for
article_type: "step-by-step"          # long-form | quick-read | step-by-step | checklist | template | case-study | faq | reference
read_time: 4                          # minutes, author's own estimate
last_reviewed: "2026-09-19"           # QUOTE dates -- see the gotcha below
reviewed_by: "Edupro Compliance"
current_as_of: "2026-09-19"           # QUOTE this one too
version: 1
legal_references: []                  # only values from KB_LEGAL_INSTRUMENTS in types/kb.ts
tags: ["cash-up", "receipting"]
related: []                           # slugs of other articles; a dead slug fails `npm run validate:kb`
featured: false
draft: true                           # false only once real, reviewed content replaces a placeholder
school_type: ["government", "all"]    # optional
school_level: ["primary"]             # optional
status: "current"                     # optional, defaults to "current"
summary: "One or two sentences for list views and search excerpts."  # optional
---
```

### The date-quoting gotcha

`last_reviewed`/`current_as_of` **must be quoted strings**. An unquoted YAML date (`last_reviewed: 2026-09-19`) is auto-parsed into a native JS `Date` by gray-matter's YAML parser, not a string — `content-schema.ts` tolerates this (it accepts either shape and normalizes to `YYYY-MM-DD`), but quoting from the start avoids relying on that normalization and matches every article already in the repo.

## Body content

Standard Markdown (GFM: tables, strikethrough, task lists) plus 13 custom components — see [`components/mdx/index.ts`](../../src/features/knowledge-base/components/mdx/index.ts) for the full list and each component's own file for its props. No import statements needed; they're already available as JSX tags:

```mdx
<Callout variant="tip" title="Before you start">
Make sure the till roll is loaded before opening the cash office.
</Callout>

<Steps>
<Step title="Count the drawer">Count cash by denomination.</Step>
<Step title="Compare to the system total">Open today's Cash Up screen.</Step>
</Steps>
```

## Placeholder articles

Every article in the repo today is a structural placeholder (`draft: true`, body says "pending source documents"). When writing a placeholder for a new section/chapter, keep that same honest framing — a draft article's body should never look like reviewed content.

## Validating your work

```bash
npm run validate:kb
```

Runs the real content loader against every article: frontmatter schema, duplicate slugs, section/chapter mismatches, and dead `related` slugs. This also runs automatically as part of `npm run build`.

## `_meta.json`

One per section folder and one per chapter folder:

```json
{
  "title": "Getting Money In",
  "description": "One or two sentences shown on section/chapter index cards.",
  "order": 5,
  "audience": ["bursar", "cashier"]
}
```

`order` controls sidebar/index ordering. `audience` is optional.
