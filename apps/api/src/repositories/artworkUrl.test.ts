import { describe, expect, it } from 'vitest';

import { safeArtworkUrl } from './artworkUrl.js';

describe('safeArtworkUrl', () => {
  it('accepts credential-free HTTPS artwork', () => {
    expect(safeArtworkUrl('https://images.example.test/poster.jpg'))
      .toBe('https://images.example.test/poster.jpg');
  });

  it.each([
    null,
    'http://images.example.test/poster.jpg',
    'image://https%3A%2F%2Fimages.example.test%2Fposter.jpg/',
    'smb://nas/media/poster.jpg',
    'https://user:secret@images.example.test/poster.jpg',
    'not a URL',
  ])('rejects unsupported or unsafe artwork: %s', (value) => {
    expect(safeArtworkUrl(value)).toBeNull();
  });
});
