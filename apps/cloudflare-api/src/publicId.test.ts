import { describe, expect, it } from 'vitest';

import { decodePublicId, encodePublicId } from './publicId';

describe('opaque public identifiers', () => {
  it('matches the cross-runtime token contract', () => {
    const movie = encodePublicId('movie', 7);
    const show = encodePublicId('tvshow', 12);
    expect(decodePublicId('movie', movie)).toBe(7);
    expect(decodePublicId('tvshow', show)).toBe(12);
    expect(decodePublicId('movie', show)).toBeNull();
    expect(decodePublicId('tvshow', movie)).toBeNull();
    expect(decodePublicId('movie', '7')).toBeNull();
  });
});
