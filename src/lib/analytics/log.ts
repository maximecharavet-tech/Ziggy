/**
 * Anonymised technical logs: request id, operation, status, latency, model,
 * estimated cost. Never a photo, a face, a prompt, a name or an email.
 */
export interface LogEvent {
  kind: 'generation' | 'safety' | 'api';
  operation: string;
  status: string;
  requestId?: string;
  latencyMs?: number;
  model?: string;
  provider?: string;
  estimatedCost?: number;
  detail?: string;
}

const SAFE_DETAIL = /^[\w .:/-]{0,80}$/;

export function logEvent(e: LogEvent): void {
  const line = { at: new Date().toISOString(), ...e, detail: e.detail && SAFE_DETAIL.test(e.detail) ? e.detail : undefined };
  console.info(`[ziggy] ${JSON.stringify(line)}`);
}

export const newRequestId = () =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`).slice(0, 36);
