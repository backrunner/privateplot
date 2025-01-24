import { eq } from 'drizzle-orm';
import type { D1Database } from '@cloudflare/workers-types';
import { getDb } from '../db';
import { articles } from '../db/schema';
import type { Article } from '../types/article';
import { generateSlug, extractSummary } from '../utils/article';
import { CacheService } from './CacheService';

export class ArticleService {
  private cache: CacheService;
  private db;

  constructor(d1: D1Database) {
    this.cache = new CacheService('articles');
    this.db = getDb(d1);
  }

  /**
   * List all articles
   */
  async list(): Promise<Article[]> {
    const cachedData = await this.cache.get<Article[]>('list');
    if (cachedData) {
      return cachedData;
    }

    const dbArticles = await this.db.select().from(articles);
    await this.cache.set('list', dbArticles);
    return dbArticles;
  }

  /**
   * Get a single article by slug
   */
  async getBySlug(slug: string): Promise<Article | undefined> {
    const cachedData = await this.cache.get<Article>(`article/${slug}`);
    if (cachedData) {
      return cachedData;
    }

    const results = await this.db
      .select()
      .from(articles)
      .where(eq(articles.slug, slug));

    const article = results[0];
    if (article) {
      await this.cache.set(`article/${slug}`, article);
    }

    return article;
  }

  /**
   * Create a new article
   */
  async create(article: Omit<Article, 'id' | 'createdDate' | 'updatedDate' | 'slug' | 'summary'> & {
    summary?: string | null | undefined;
    slug?: string;
  }): Promise<Article> {
    const newArticle = {
      ...article,
      slug: article.slug || generateSlug(article.title),
      summary: article.summary ?? extractSummary(article.content),
    };

    const results = await this.db.insert(articles).values(newArticle).returning();

    await this.cache.clear();
    return results[0] as Article;
  }

  /**
   * Update an existing article
   */
  async update(id: string, article: Partial<Omit<Article, 'id' | 'createdDate' | 'slug' | 'summary' | 'updatedDate'>> & {
    summary?: string | null;
  }): Promise<Article | undefined> {
    const updateData: Record<string, any> = {
      ...article,
      updatedDate: new Date(),
    };

    // Generate new summary if content is updated and summary is not provided
    if (article.content && article.summary === undefined) {
      updateData.summary = extractSummary(article.content);
    }

    const results = await this.db
      .update(articles)
      .set(updateData)
      .where(eq(articles.id, id))
      .returning();

    await this.cache.clear();
    return results[0] as Article;
  }

  /**
   * Delete an article by id
   */
  async delete(id: string): Promise<boolean> {
    const results = await this.db
      .delete(articles)
      .where(eq(articles.id, id))
      .returning();

    await this.cache.clear();
    return results.length > 0;
  }
}
