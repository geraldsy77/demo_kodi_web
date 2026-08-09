import { authenticateSyncRequest } from './syncAuth';
import { enforceSyncRateLimit, ingestSnapshotBatch } from './syncRepository';
import { parseSyncPayload } from './syncValidation';

interface SyncSecretEnv extends Env { SYNC_TOKEN?: string }

async function sha256(value: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function synchronizeSnapshot(request: Request, env: Env): Promise<Response> {
  const syncEnv: SyncSecretEnv = env;
  const clientKey = await authenticateSyncRequest(request, syncEnv.SYNC_TOKEN);
  await enforceSyncRateLimit(env.DB, clientKey, Math.floor(Date.now() / 1000));
  const payload = await parseSyncPayload(request);
  const payloadHash = await sha256(JSON.stringify(payload));
  const result = await ingestSnapshotBatch(env.DB, payload, payloadHash, new Date().toISOString());
  return Response.json({
    snapshotId: payload.snapshotId,
    version: payload.version,
    ...result,
  });
}
