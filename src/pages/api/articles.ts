import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

const ITEMS_PER_PAGE = 10;

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);

  const page = Number(url.searchParams.get('page')) || 1;
  const articles = await getCollection('article');
  const sortedArticles = articles.sort((a, b) => b.data.createdDate.getTime() - a.data.createdDate.getTime());

  const start = (page - 1) * ITEMS_PER_PAGE;
  const end = Math.min(start + ITEMS_PER_PAGE, sortedArticles.length);

  const paginatedArticles = sortedArticles.slice(start, end).map(article => ({
    title: article.data.title,
    summary: article.data.summary || article.body?.slice(0, 200) + '...',
    createdAt: article.data.createdDate.toISOString(),
    updatedAt: article.data.updatedDate ? article.data.updatedDate.toISOString() : '',
    slug: article.id,
  }));

  return new Response(JSON.stringify({
    articles: paginatedArticles,
    hasMore: sortedArticles.length > end,
    total: articles.length
  }), {
    headers: {
      'Content-Type': 'application/json'
    }
  });
};
