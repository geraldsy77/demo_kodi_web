import { describe, expect, it, vi } from 'vitest';

import { observeSyncRun, type SyncRunStatus, type SyncRunStatusStore } from './syncRunStatus.js';

function store(previous: SyncRunStatus | null = null) {
  const save = vi.fn<(status: SyncRunStatus) => Promise<void>>().mockResolvedValue(undefined);
  return { value: { load: vi.fn().mockResolvedValue(previous), save } satisfies SyncRunStatusStore, save };
}

describe('observeSyncRun', () => {
  it('records successful duration and row counts without secrets', async () => {
    const target = store();
    const times = [new Date('2026-08-09T01:00:00Z'), new Date('2026-08-09T01:00:05Z')];
    await observeSyncRun(async () => ({ movieCount: 10, tvShowCount: 4 }), target.value, () => times.shift()!);
    expect(target.save).toHaveBeenCalledWith(expect.objectContaining({
      outcome: 'success', durationMilliseconds: 5000, movieCount: 10, tvShowCount: 4,
      lastSuccessAt: '2026-08-09T01:00:05.000Z', failureCode: null,
    }));
    expect(JSON.stringify(target.save.mock.calls)).not.toContain('token');
  });

  it('records a stable failure and preserves the previous success', async () => {
    const previous: SyncRunStatus = {
      lastAttemptAt: '2026-08-08T01:00:00.000Z', lastSuccessAt: '2026-08-08T01:00:00.000Z',
      lastFailureAt: null, outcome: 'success', durationMilliseconds: 1000,
      movieCount: 8, tvShowCount: 3, failureCode: null,
    };
    const target = store(previous);
    const times = [new Date('2026-08-09T01:00:00Z'), new Date('2026-08-09T01:00:02Z')];
    await expect(observeSyncRun(async () => { throw new Error('secret detail'); }, target.value, () => times.shift()!))
      .rejects.toThrow('secret detail');
    expect(target.save).toHaveBeenCalledWith(expect.objectContaining({
      outcome: 'failure', failureCode: 'SYNC_FAILED', durationMilliseconds: 2000,
      lastSuccessAt: previous.lastSuccessAt, movieCount: 8, tvShowCount: 3,
    }));
    expect(JSON.stringify(target.save.mock.calls)).not.toContain('secret detail');
  });
});
