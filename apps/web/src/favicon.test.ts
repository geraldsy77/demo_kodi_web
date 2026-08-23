import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('gLabs branding assets', () => {
  it('declares the repository-owned g logo as the SVG favicon', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const logo = readFileSync(
      new URL('../public/g-logo.svg', import.meta.url),
      'utf8',
    );

    expect(html).toContain(
      '<link rel="icon" type="image/svg+xml" href="/g-logo.svg" />',
    );
    expect(logo).toContain('<path');
    expect(logo).not.toContain('<text');
  });
});
