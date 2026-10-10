import 'server-only';

/**
 * One HTTP call to an AI provider, with timeout and retry with exponential
 * backoff on 408 / 429 / 5xx / network errors. Keys never leave the server;
 * errors carry a status and a short, log-safe message (never the payload).
 */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: 'not_configured' | 'refused' | 'rate_limited' | 'unavailable' | 'bad_response' | 'timeout' | 'network'
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export interface CallOptions {
  url: string;
  key: string;
  body: unknown;
  timeoutMs?: number;
  retries?: number;
  provider: string;
}

const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);
export const backoff = (attempt: number) => Math.min(8000, 400 * 2 ** attempt) + Math.floor(Math.random() * 200);

export async function postJson<T = unknown>(o: CallOptions): Promise<T> {
  const retries = o.retries ?? 2;
  for (let attempt = 0; ; attempt++) {
    let status = 0;
    try {
      const res = await fetch(o.url, {
        method: 'POST',
        headers: { authorization: `Bearer ${o.key}`, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(o.body),
        signal: AbortSignal.timeout(o.timeoutMs ?? 30_000),
      });
      status = res.status;
      const text = await res.text();
      if (res.ok) {
        try {
          return JSON.parse(text) as T;
        } catch {
          throw new ProviderError(`${o.provider}: unreadable answer`, 502, 'bad_response');
        }
      }
      if (!RETRYABLE.has(status) || attempt >= retries) {
        const code = status === 401 || status === 403 ? 'refused' : status === 429 ? 'rate_limited' : status >= 500 ? 'unavailable' : 'refused';
        throw new ProviderError(`${o.provider}: HTTP ${status}`, status, code);
      }
    } catch (e) {
      if (e instanceof ProviderError) throw e;
      const timeout = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError');
      if (attempt >= retries) throw new ProviderError(`${o.provider}: ${timeout ? 'timeout' : 'network error'}`, 0, timeout ? 'timeout' : 'network');
    }
    await new Promise((r) => setTimeout(r, backoff(attempt)));
  }
}

/** Text of the first choice of an OpenAI-compatible chat completion. */
export function chatText(body: unknown): string {
  const b = body as { choices?: { message?: { content?: unknown } }[] };
  const c = b?.choices?.[0]?.message?.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) return c.map((p) => (typeof p === 'object' && p && 'text' in p ? String((p as { text: unknown }).text) : '')).join('');
  return '';
}

/** Token usage of an OpenAI-compatible answer, for the CostGuard. */
export function chatUsage(body: unknown): { input: number; output: number } {
  const u = (body as { usage?: { prompt_tokens?: number; completion_tokens?: number } })?.usage;
  return { input: u?.prompt_tokens ?? 0, output: u?.completion_tokens ?? 0 };
}
