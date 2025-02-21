import type { APIRoute } from 'astro';
import { ArticleService } from '../../services/ArticleService';

const ITEMS_PER_PAGE = 10;

export const GET: APIRoute = async ({ request, locals }) => {
  const url = new URL(request.url);
  const articleService = new ArticleService(locals.runtime.env.DB);

  const page = Number(url.searchParams.get('page')) || 1;
  const articles = await articleService.list();
  const sortedArticles = articles.sort((a, b) =>
    new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime()
  );

  const start = (page - 1) * ITEMS_PER_PAGE;
  const end = Math.min(start + ITEMS_PER_PAGE, sortedArticles.length);

  const paginatedArticles = sortedArticles.slice(start, end).map(article => ({
    id: article.id,
    title: article.title,
    summary: article.summary,
    createdAt: new Date(article.createdDate).toISOString(),
    updatedAt: article.updatedDate ? new Date(article.updatedDate).toISOString() : '',
    slug: article.slug,
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
