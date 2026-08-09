import { describe, expect, it, vi } from 'vitest';

import { handlePublicApiRequest } from './apiProxy';

describe('Cloudflare Pages API proxy', () => {
  it('forwards public API requests through the service binding without caching', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ items: [] }));
    const request = new Request('https://preview.example.test/api/movies?page=2');
    const response = await handlePublicApiRequest(request, { fetch });

    expect(fetch).toHaveBeenCalledWith(request);
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({ items: [] });
  });

  it('does not expose the private synchronization route', async () => {
    const fetch = vi.fn();
    const response = await handlePublicApiRequest(
      new Request('https://example.test/api/internal/sync/snapshots'),
      { fetch },
    );

    expect(response.status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects write methods before invoking the read Worker', async () => {
    const fetch = vi.fn();
    const response = await handlePublicApiRequest(
      new Request('https://example.test/api/movies', { method: 'POST' }),
      { fetch },
    );
    expect(response.status).toBe(405);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns a stable response when the Worker binding is unavailable', async () => {
    const fetch = vi.fn().mockRejectedValue(new Error('binding unavailable'));
    const response = await handlePublicApiRequest(
      new Request('https://example.test/api/search?q=test'),
      { fetch },
    );
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: {
        code: 'API_UNAVAILABLE',
        message: 'The library service is temporarily unavailable.',
      },
    });
  });
});
