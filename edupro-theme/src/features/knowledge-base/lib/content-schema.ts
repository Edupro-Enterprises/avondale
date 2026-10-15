import { z } from 'zod'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** YAML auto-types an unquoted `2026-09-19` scalar as a real Date (not a
 * string) -- confirmed live, gray-matter's underlying js-yaml parser does
 * this, and the spec's own frontmatter example writes dates unquoted. A
 * Date survives JSON.stringify (used to embed parsed frontmatter into
 * vite-plugin-kb-content.ts's generated virtual module) as a full ISO
 * timestamp, not the plain YYYY-MM-DD this schema needs. This accepts
 * either input shape and always normalizes to a clean YYYY-MM-DD string,
 * so content authors don't have to remember to quote dates. */
const kbDateField = z
  .union([z.string(), z.date()])
  .transform((value, ctx) => {
    if (value instanceof Date) {
      return value.toISOString().slice(0, 10)
    }
    const isoPrefix = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0]
    if (isoPrefix) return isoPrefix
    ctx.addIssue({ code: 'custom', message: 'must be a YYYY-MM-DD date' })
    return z.NEVER
  })
  .pipe(z.string().regex(DATE_RE))
import {
  KB_AUDIENCE_TAGS,
  KB_ARTICLE_TYPES,
  KB_SCHOOL_TYPES,
  KB_SCHOOL_LEVELS,
  KB_ARTICLE_STATUS,
  KB_LEGAL_INSTRUMENTS,
} from '@/features/knowledge-base/types/kb'

/** Matches the frontmatter block every KB article must have. Validated at
 * build time by content-loader.ts (every article, eagerly, on load) --
 * an invalid or missing field throws immediately rather than shipping a
 * broken article that only fails once a reader opens it. */
export const kbFrontmatterSchema = z.object({
  title: z.string().min(1, 'title is required'),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug must be lowercase-kebab-case'),
  section: z.string().min(1, 'section is required'),
  chapter: z.string().min(1, 'chapter is required'),
  audience: z
    .array(z.enum(KB_AUDIENCE_TAGS))
    .min(1, 'at least one audience tag is required'),
  article_type: z.enum(KB_ARTICLE_TYPES),
  read_time: z.number().int().positive(),
  last_reviewed: kbDateField,
  reviewed_by: z.string().min(1, 'reviewed_by is required'),
  current_as_of: kbDateField,
  version: z.number().int().positive(),
  legal_references: z.array(z.enum(KB_LEGAL_INSTRUMENTS)).default([]),
  tags: z.array(z.string().min(1)).default([]),
  related: z.array(z.string().min(1)).default([]),
  featured: z.boolean().default(false),
  draft: z.boolean().default(false),
  school_type: z.array(z.enum(KB_SCHOOL_TYPES)).optional(),
  school_level: z.array(z.enum(KB_SCHOOL_LEVELS)).optional(),
  status: z.enum(KB_ARTICLE_STATUS).default('current'),
  summary: z.string().optional(),
})

export type KbFrontmatterInput = z.input<typeof kbFrontmatterSchema>
export type KbFrontmatterOutput = z.output<typeof kbFrontmatterSchema>

export const kbMetaSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  order: z.number().int(),
  audience: z.array(z.enum(KB_AUDIENCE_TAGS)).optional(),
  icon: z.string().optional(),
})

/** Thrown by content-loader.ts for a specific file, carrying enough context
 * (path + zod's own field-level issues) that a content author can fix the
 * frontmatter without reading loader source. */
export class KbContentValidationError extends Error {
  constructor(
    public readonly filePath: string,
    public readonly issues: z.ZodIssue[]
  ) {
    const detail = issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n')
    super(`Invalid frontmatter in ${filePath}:\n${detail}`)
    this.name = 'KbContentValidationError'
  }
}

export function parseKbFrontmatter(filePath: string, raw: unknown): KbFrontmatterOutput {
  const result = kbFrontmatterSchema.safeParse(raw)
  if (!result.success) {
    throw new KbContentValidationError(filePath, result.error.issues)
  }
  return result.data
}
