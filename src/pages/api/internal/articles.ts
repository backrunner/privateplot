import type { APIRoute } from 'astro';
import { ArticleService } from '../../../services/ArticleService';

export const GET: APIRoute = async ({ request, locals }) => {
  const articleService = new ArticleService(locals.runtime.env.DB);
  const articles = await articleService.list();

  const sortedArticles = articles.sort((a, b) =>
    new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime()
  );

  const simplifiedArticles = sortedArticles.map(article => ({
    id: article.id,
    title: article.title,
    createdAt: new Date(article.createdDate).toISOString(),
    updatedAt: article.updatedDate ? new Date(article.updatedDate).toISOString() : null,
  }));

  return new Response(JSON.stringify({
    articles: simplifiedArticles,
    total: articles.length
  }), {
    headers: {
      'Content-Type': 'application/json'
    }
  });
};
