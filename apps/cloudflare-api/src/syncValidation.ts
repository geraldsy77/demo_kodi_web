import { z } from 'zod';

import { ApiError } from './http';
import type { SyncPayload } from './syncTypes';

export const MAX_SYNC_BODY_BYTES = 1_048_576;
export const MAX_SYNC_BATCH_RECORDS = 50;

const nullableFinite = z.number().finite().nullable();
const nullableNonnegative = z.number().finite().nonnegative().nullable();
const nullableInteger = z.number().int().nonnegative().nullable();
const nullableText = z.string().max(10_000).nullable();
const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/);
const artworkUrl = z.string().url().startsWith('https://').max(2_048).refine((value) => {
  try {
    return new URL(value).username === '' && new URL(value).password === '';
  } catch {
    return false;
  }
}).nullable();

const movie = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1).max(500),
  plot: nullableText,
  premiered: z.string().max(40).nullable(),
  userRating: nullableFinite,
  rating: nullableFinite,
  votes: nullableInteger,
  playCount: nullableInteger,
  lastPlayed: z.string().max(40).nullable(),
  dateAdded: z.string().max(40).nullable(),
  resumePositionSeconds: nullableNonnegative,
  resumeTotalSeconds: nullableNonnegative,
  artworkUrl,
}).strict();

const tvShow = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1).max(500),
  plot: nullableText,
  premiered: z.string().max(40).nullable(),
  userRating: nullableFinite,
  durationSeconds: nullableNonnegative,
  rating: nullableFinite,
  votes: nullableInteger,
  lastPlayed: z.string().max(40).nullable(),
  dateAdded: z.string().max(40).nullable(),
  totalEpisodes: nullableInteger,
  watchedEpisodes: nullableInteger,
  totalSeasons: nullableInteger,
  artworkUrl,
}).strict();

const payload = z.object({
  snapshotId: identifier,
  version: z.number().int().positive(),
  batchId: identifier,
  action: z.enum(['upsert', 'complete']),
  movies: z.array(movie).max(MAX_SYNC_BATCH_RECORDS).default([]),
  tvShows: z.array(tvShow).max(MAX_SYNC_BATCH_RECORDS).default([]),
}).strict().superRefine((value, context) => {
  if (value.movies.length + value.tvShows.length > MAX_SYNC_BATCH_RECORDS) {
    context.addIssue({ code: 'custom', message: 'Batch contains too many records.' });
  }
  if (value.action === 'complete' && (value.movies.length > 0 || value.tvShows.length > 0)) {
    context.addIssue({ code: 'custom', message: 'Completion batches cannot contain records.' });
  }
  if (new Set(value.movies.map(({ id }) => id)).size !== value.movies.length
    || new Set(value.tvShows.map(({ id }) => id)).size !== value.tvShows.length) {
    context.addIssue({ code: 'custom', message: 'Batch contains duplicate record identifiers.' });
  }
});

async function readBoundedBody(request: Request): Promise<string> {
  if (!request.body) return '';
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let body = '';
  let receivedBytes = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    receivedBytes += chunk.value.byteLength;
    if (receivedBytes > MAX_SYNC_BODY_BYTES) {
      await reader.cancel();
      throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Sync payload is too large.');
    }
    body += decoder.decode(chunk.value, { stream: true });
  }
  return body + decoder.decode();
}

export async function parseSyncPayload(request: Request): Promise<SyncPayload> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json.');
  }
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_SYNC_BODY_BYTES) {
    throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Sync payload is too large.');
  }

  const body = await readBoundedBody(request);
  let input: unknown;
  try {
    input = JSON.parse(body);
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'Request body must contain valid JSON.');
  }
  const result = payload.safeParse(input);
  if (!result.success) {
    throw new ApiError(400, 'INVALID_SYNC_PAYLOAD', 'Sync payload is invalid.');
  }
  return result.data;
}
