interface ApiService {
  fetch(request: Request): Promise<Response>;
}

const publicApiRoute = /^\/api\/(health|library\/summary|sync\/status|movies(?:\/[^/]+)?|tvshows(?:\/[^/]+)?|search)$/;

export async function handlePublicApiRequest(
  request: Request,
  api: ApiService,
): Promise<Response> {
  const url = new URL(request.url);
  if (!publicApiRoute.test(url.pathname)) {
    return Response.json({
      error: { code: 'NOT_FOUND', message: 'Route not found.' },
    }, { status: 404 });
  }
  if (request.method !== 'GET') {
    return Response.json({
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' },
    }, { status: 405 });
  }
  try {
    const upstream = await api.fetch(request);
    const headers = new Headers(upstream.headers);
    headers.set('Cache-Control', 'no-store');
    headers.set('X-Content-Type-Options', 'nosniff');
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });
  } catch {
    return Response.json({
      error: {
        code: 'API_UNAVAILABLE',
        message: 'The library service is temporarily unavailable.',
      },
    }, { status: 502 });
  }
}
