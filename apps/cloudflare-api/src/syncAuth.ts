import { ApiError } from './http';

const encoder = new TextEncoder();

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

export async function authenticateSyncRequest(
  request: Request,
  secret: string | undefined,
): Promise<string> {
  if (!secret) {
    throw new ApiError(500, 'SYNC_NOT_CONFIGURED', 'Snapshot synchronization is not configured.');
  }
  const match = /^Bearer ([^\s]+)$/.exec(request.headers.get('authorization') ?? '');
  const presentedDigest = await digest(match?.[1] ?? '');
  const expectedDigest = await digest(secret);
  if (!match || !timingSafeEqual(presentedDigest, expectedDigest)) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authentication is required.');
  }
  return Array.from(expectedDigest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
