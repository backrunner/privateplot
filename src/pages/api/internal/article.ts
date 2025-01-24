import type { APIContext, APIRoute } from 'astro';
import { z } from 'zod';
import { ArticleService } from '../../../services/ArticleService';

// Validation schemas
const createArticleSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be URL friendly').optional(),
  summary: z.string().optional(),
});

const updateArticleSchema = z.object({
  title: z.string().min(1, 'Title is required').optional(),
  content: z.string().optional(),
  summary: z.string().optional(),
});

const idParamSchema = z.object({
  id: z.string()
});

// Error handler
const handleError = (error: unknown) => {
  if (error instanceof z.ZodError) {
    return new Response(JSON.stringify({
      error: 'Validation Error',
      details: error.errors
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  console.error('API Error:', error);
  return new Response(JSON.stringify({
    error: 'Internal Server Error'
  }), {
    status: 500,
    headers: { 'Content-Type': 'application/json' }
  });
};

export const PUT: APIRoute = async ({ request, locals }: APIContext) => {
  try {
    const data = await request.json();
    const validatedData = createArticleSchema.parse(data);

    const articleService = new ArticleService(locals.runtime.env.DB);
    const article = await articleService.create(validatedData);

    return new Response(JSON.stringify(article), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return handleError(error);
  }
};

export const PATCH: APIRoute = async ({ request, locals }: APIContext) => {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const { id: validatedId } = idParamSchema.parse({ id });

    const data = await request.json();
    const validatedData = updateArticleSchema.parse(data);

    const articleService = new ArticleService(locals.runtime.env.DB);
    const article = await articleService.update(validatedId, validatedData);

    if (!article) {
      return new Response(JSON.stringify({
        error: 'Article not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(article), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return handleError(error);
  }
};

export const DELETE: APIRoute = async ({ request, locals }: APIContext) => {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const { id: validatedId } = idParamSchema.parse({ id });

    const articleService = new ArticleService(locals.runtime.env.DB);
    const success = await articleService.delete(validatedId);

    if (!success) {
      return new Response(JSON.stringify({
        error: 'Article not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    return handleError(error);
  }
};
