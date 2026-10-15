/**
 * Frappe REST client. Deployed on the same domain as the Frappe backend
 * (fees.edupro.co.zw, via Traefik PathPrefix -- see the backend repo's
 * ADR 0006), so requests are same-origin in production: no CORS, Frappe's
 * own session cookie carries auth automatically.
 *
 * Always relative -- there's no direct-to-backend browser fetch mode.
 * Locally (no staging exists yet), vite.config.ts's dev-server proxy
 * forwards these same relative paths to VITE_FRAPPE_URL, so the browser
 * always sees same-origin requests and never has to deal with Frappe's
 * CORS wall. Ported from the edupro-school-fees-financial-statement-system
 * repo's `web/src/lib/api.ts`, adapted from Next.js's direct-fetch-with-env
 * approach to Vite's proxy-based one.
 */
const BASE_URL = ''

export class FrappeApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public serverMessages?: string[]
  ) {
    super(message)
    this.name = 'FrappeApiError'
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Frappe-CSRF-Token': getCsrfToken() ?? '',
      ...options.headers,
    },
  })

  if (!res.ok) {
    let serverMessages: string[] | undefined
    try {
      const body = await res.json()
      serverMessages = body._server_messages
        ? JSON.parse(body._server_messages)
        : undefined
    } catch {
      // response wasn't JSON -- fall through with no server messages
    }
    throw new FrappeApiError(
      `Frappe API error: ${res.status}`,
      res.status,
      serverMessages
    )
  }

  return res.json() as Promise<T>
}

function getCsrfToken(): string | undefined {
  if (typeof document === 'undefined') return undefined
  const match = document.cookie.match(/(?:^|; )csrf_token=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : undefined
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),
  put: <T>(path: string, data?: unknown) =>
    request<T>(path, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}

/** Uploads a real file to Frappe's own File doctype (Frappe's standard
 * /api/method/upload_file endpoint), returning its file_url -- the same
 * value an Attach field expects. Deliberately bypasses the JSON request()
 * helper above: multipart/form-data needs the browser to set its own
 * Content-Type boundary, not "application/json". */
export async function uploadFile(
  file: File,
  opts: { isPrivate?: boolean } = {}
): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  form.append('is_private', opts.isPrivate === false ? '0' : '1')

  const res = await fetch(`${BASE_URL}/api/method/upload_file`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-Frappe-CSRF-Token': getCsrfToken() ?? '' },
    body: form,
  })
  if (!res.ok) {
    throw new FrappeApiError(`File upload failed: ${res.status}`, res.status)
  }
  const body = await res.json()
  return body.message.file_url as string
}

export interface FrappeListResponse<T> {
  data: T[]
}

export function listResource<T>(
  doctype: string,
  params: Record<string, string> = {}
) {
  const search = new URLSearchParams(params).toString()
  return api.get<FrappeListResponse<T>>(
    `/api/resource/${encodeURIComponent(doctype)}${search ? `?${search}` : ''}`
  )
}
