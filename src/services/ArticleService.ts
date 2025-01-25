import { eq } from 'drizzle-orm';
import type { D1Database } from '@cloudflare/workers-types';
import { getDb } from '../db';
import { articles } from '../db/schema';
import type { Article } from '../types/article';
import { generateSlug, extractSummary } from '../utils/article';
import { CacheService } from './CacheService';
import { MarkdownRenderer } from '../utils/markdown';

export class ArticleService {
  private cache: CacheService;
  private db;
  private markdownRenderer: MarkdownRenderer;

  constructor(d1: D1Database) {
    this.cache = new CacheService('articles');
    this.db = getDb(d1);
    this.markdownRenderer = MarkdownRenderer.getInstance();
  }

  private async ensureRendered(article: Article): Promise<Article> {
    if (article.rendered !== null) {
      return article;
    }

    await this.markdownRenderer.initialize();
    const renderedArticle = {
      ...article,
      rendered: this.markdownRenderer.render(article.content)
    };

    // Update the rendered content in database
    await this.db
      .update(articles)
      .set({ rendered: renderedArticle.rendered })
      .where(eq(articles.id, article.id));

    return renderedArticle;
  }

  /**
   * List all articles
   */
  async list(): Promise<Article[]> {
    const cachedData = await this.cache.get<Article[]>('list');
    if (cachedData) {
      return Promise.all(cachedData.map(article => this.ensureRendered(article)));
    }

    const dbArticles = await this.db.select().from(articles);
    const renderedArticles = await Promise.all(dbArticles.map(article => this.ensureRendered(article)));
    await this.cache.set('list', renderedArticles);
    return renderedArticles;
  }

  /**
   * Get a single article by slug
   */
  async getBySlug(slug: string): Promise<Article | undefined> {
    const cachedData = await this.cache.get<Article>(`article/${slug}`);
    if (cachedData) {
      return this.ensureRendered(cachedData);
    }

    const results = await this.db
      .select()
      .from(articles)
      .where(eq(articles.slug, slug));

    const article = results[0];
    if (article) {
      const renderedArticle = await this.ensureRendered(article);
      await this.cache.set(`article/${slug}`, renderedArticle);
      return renderedArticle;
    }

    return undefined;
  }

  /**
   * Create a new article
   */
  async create(article: Omit<Article, 'id' | 'createdDate' | 'updatedDate' | 'slug' | 'summary' | 'rendered'> & {
    summary?: string | null | undefined;
    slug?: string;
  }): Promise<Article> {
    await this.markdownRenderer.initialize();

    const newArticle = {
      ...article,
      slug: article.slug || generateSlug(article.title),
      summary: article.summary ?? extractSummary(article.content),
      rendered: this.markdownRenderer.render(article.content),
    };

    const results = await this.db.insert(articles).values(newArticle).returning();

    await this.cache.clear();
    return results[0] as Article;
  }

  /**
   * Update an existing article
   */
  async update(id: string, article: Partial<Omit<Article, 'id' | 'createdDate' | 'slug' | 'summary' | 'updatedDate' | 'rendered'>> & {
    summary?: string | null;
  }): Promise<Article | undefined> {
    await this.markdownRenderer.initialize();

    const updateData: Record<string, any> = {
      ...article,
      updatedDate: new Date(),
    };

    // Generate new summary if content is updated and summary is not provided
    if (article.content && article.summary === undefined) {
      updateData.summary = extractSummary(article.content);
    }

    // Re-render content if it's updated
    if (article.content) {
      updateData.rendered = this.markdownRenderer.render(article.content);
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
