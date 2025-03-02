import type { APIContext, MiddlewareNext } from 'astro';

/**
 * CORS middleware that allows requests from specific origins
 * Only applies to requests to /api paths
 */
export async function cors(
  { request }: APIContext,
  next: MiddlewareNext
) {
  // Only apply CORS headers to /api routes
  if (!request.url.includes('/api')) {
    return next();
  }

  // Get the origin from the request
  const origin = request.headers.get('Origin');

  // List of allowed origins
  const allowedOrigins = [
    'app://obsidian.md',
    'https://backrunner.blog',
    'http://backrunner.blog',
  ];

  // Process the request
  const response = await next();

  // Create a new response with the appropriate headers
  const newResponse = new Response(response.body, response);

  // Set CORS headers if the origin is allowed
  if (origin && allowedOrigins.includes(origin)) {
		newResponse.headers.set("Access-Control-Allow-Origin", origin);
		newResponse.headers.set(
			"Access-Control-Allow-Methods",
			"GET, POST, PUT, DELETE, PATCH, OPTIONS"
		);
		newResponse.headers.set(
			"Access-Control-Allow-Headers",
			"Content-Type, Authorization, X-Requested-With, X-Internal-Auth-Token"
		);
		newResponse.headers.set("Access-Control-Allow-Credentials", "true");

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: newResponse.headers
      });
    }
  }

  return newResponse;
}
