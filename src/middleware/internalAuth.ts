import type { APIContext, MiddlewareNext } from 'astro';

export async function internalAuth(
  { request, locals }: APIContext,
  next: MiddlewareNext
) {
  // Check if the request is for an internal API
  if (!request.url.includes('/api/internal/')) {
    return next();
  }

  const authToken = request.headers.get('X-Internal-Auth-Token');
  const expectedToken = import.meta.env.INTERNAL_AUTH_TOKEN;

  if (!expectedToken) {
    console.error('INTERNAL_AUTH_TOKEN is not configured');
    return new Response(JSON.stringify({
      error: 'Internal server configuration error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!authToken || authToken !== expectedToken) {
    return new Response(JSON.stringify({
      error: 'Unauthorized access to internal API'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return next();
}
