import type { APIRoute } from 'astro';
import { getPaginatedArticles } from '../../mock/articles';

export const GET: APIRoute = async ({ url }) => {
  const page = Number(url.searchParams.get('page')) || 1;
  const data = await getPaginatedArticles(page);
  
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json'
    }
  });
}; 