import { describe, expect, it } from 'vitest';
import { errorReason } from './tts-gemini';

describe('errorReason', () => {
  it('keeps the status and the quota ids, nothing else', () => {
    const body = JSON.stringify({ error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'long text', details: [{ '@type': 'QuotaFailure', violations: [{ quotaId: 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier' }, { quotaId: 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier' }] }, { '@type': 'RetryInfo', retryDelay: '20s' }] } });
    expect(errorReason(body)).toBe('RESOURCE_EXHAUSTED GenerateRequestsPerMinutePerProjectPerModel-FreeTier');
  });
  it('is empty for anything else', () => {
    expect(errorReason('<html>')).toBe('');
    expect(errorReason('{}')).toBe('');
  });
});
