import { describe, expect, it } from 'vitest';

import { decodePublicId, encodePublicId } from './publicId.js';

describe('opaque public identifiers', () => {
  it('creates stable, non-numeric, reversible entity-scoped tokens', () => {
    const movie = encodePublicId('movie', 7);
    const show = encodePublicId('tvshow', 12);

    expect(movie).toBe(encodePublicId('movie', 7));
    expect(show).toBe(encodePublicId('tvshow', 12));
    expect(movie).not.toMatch(/^\d+$/);
    expect(show).not.toMatch(/^\d+$/);
    expect(decodePublicId('movie', movie)).toBe(7);
    expect(decodePublicId('tvshow', show)).toBe(12);
    expect(decodePublicId('movie', show)).toBeNull();
    expect(decodePublicId('tvshow', movie)).toBeNull();
  });

  it.each(['7', '', 'not-a-token', 'Qaaaaaaaaaa'])('rejects malformed token %s', (token) => {
    expect(decodePublicId('movie', token)).toBeNull();
  });
});
