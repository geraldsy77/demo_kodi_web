import type { SnapshotMovie, SnapshotTvShow } from '../types/snapshot.js';

interface UploadPayload {
  snapshotId: string;
  version: number;
  batchId: string;
  action: 'upsert' | 'complete';
  movies: SnapshotMovie[];
  tvShows: SnapshotTvShow[];
}

interface UploaderOptions {
  endpoint: string;
  token: string;
  maxRetries: number;
  fetchImplementation?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
}

export interface SnapshotUploader {
  upload(payload: UploadPayload): Promise<void>;
}

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function retryDelay(response: Response | null, attempt: number): number {
  const retryAfter = Number(response?.headers.get('retry-after'));
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(retryAfter * 1_000, 10_000);
  }
  return Math.min(250 * 2 ** attempt, 10_000);
}

export function createSnapshotUploader(options: UploaderOptions): SnapshotUploader {
  const request = options.fetchImplementation ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  return {
    async upload(payload) {
      for (let attempt = 0; attempt <= options.maxRetries; attempt += 1) {
        let response: Response | null = null;
        try {
          response = await request(options.endpoint, {
            method: 'POST',
            headers: {
              authorization: `Bearer ${options.token}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify(payload),
          });
        } catch (error) {
          if (attempt === options.maxRetries) {
            throw new Error('Synchronization upload failed after bounded retries.', { cause: error });
          }
        }
        if (response?.ok) return;
        if (response && response.status !== 429 && response.status < 500) {
          throw new Error(`Synchronization request was rejected (${response.status}).`);
        }
        if (attempt === options.maxRetries) {
          throw new Error('Synchronization upload failed after bounded retries.');
        }
        await sleep(retryDelay(response, attempt));
      }
    },
  };
}
