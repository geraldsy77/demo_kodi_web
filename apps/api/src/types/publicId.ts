export type PublicIdEntity = 'movie' | 'tvshow';

const alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ123456789';
const base = BigInt(alphabet.length);
const multiplier = 1_048_583n;
const minimumBodyLength = 8;
const checksumLength = 2;
const entityConfiguration: Record<PublicIdEntity, { marker: string; offset: bigint; seed: number }> = {
  movie: { marker: 'Q', offset: 37_000_019n, seed: 17 },
  tvshow: { marker: 'w', offset: 73_000_019n, seed: 43 },
};

function encodeNumber(input: bigint): string {
  let value = input;
  let encoded = '';
  do {
    encoded = alphabet[Number(value % base)] + encoded;
    value /= base;
  } while (value > 0n);
  return encoded;
}

function decodeNumber(input: string): bigint | null {
  let decoded = 0n;
  for (const character of input) {
    const index = alphabet.indexOf(character);
    if (index < 0) return null;
    decoded = decoded * base + BigInt(index);
  }
  return decoded;
}

function checksum(entity: PublicIdEntity, body: string): string {
  let value = entityConfiguration[entity].seed;
  for (const character of body) {
    value = (value * 131 + alphabet.indexOf(character) + 1) % Number(base ** 2n);
  }
  return encodeNumber(BigInt(value)).padStart(checksumLength, alphabet[0]);
}

export function encodePublicId(entity: PublicIdEntity, id: number): string {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error('A public identifier requires a positive safe integer.');
  }
  const configuration = entityConfiguration[entity];
  const body = encodeNumber(BigInt(id) * multiplier + configuration.offset)
    .padStart(minimumBodyLength, alphabet[0]);
  return `${configuration.marker}${body}${checksum(entity, body)}`;
}

export function decodePublicId(entity: PublicIdEntity, token: string): number | null {
  const configuration = entityConfiguration[entity];
  if (token.length < 1 + minimumBodyLength + checksumLength
    || token[0] !== configuration.marker) return null;
  const body = token.slice(1, -checksumLength);
  if (token.slice(-checksumLength) !== checksum(entity, body)) return null;
  const encoded = decodeNumber(body);
  if (encoded === null || encoded <= configuration.offset) return null;
  const candidate = encoded - configuration.offset;
  if (candidate % multiplier !== 0n) return null;
  const id = Number(candidate / multiplier);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
