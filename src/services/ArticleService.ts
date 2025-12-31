// Third-party imports
import { eq } from 'drizzle-orm';
import { load } from 'js-yaml';
import type { D1Database } from '@cloudflare/workers-types';
import type { Article } from '../types/article';
import { getDb } from '../db';
import { articles } from '../db/schema';

// Metadata type for listing articles without content/rendered fields
export type ArticleMetadata = Omit<Article, 'content' | 'rendered'>;
import { CacheService } from './CacheService';
import { RSS_EVENTS } from './RSSService';
import { EventBus } from '../utils/eventbus';
import { generateSlug, extractSummary } from '../utils/article';
import { MarkdownRenderer } from '../utils/markdown';

export class ArticleService {
  private cache: CacheService;
  private db;
  private markdownRenderer: MarkdownRenderer;
  private eventBus: EventBus;

  constructor(d1: D1Database) {
    this.cache = new CacheService('articles');
    this.db = getDb(d1);
    this.markdownRenderer = MarkdownRenderer.getInstance();
    this.eventBus = EventBus.getInstance();
  }

  private extractMetaFromContent(content: string): { meta: Record<string, any> | null, content: string } {
    const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    let meta: Record<string, any> | null = null;
    let cleanContent = content;

    if (frontMatterMatch) {
      try {
        const frontMatter = load(frontMatterMatch[1]) as Record<string, any>;
        // Filter out privateplot- prefixed keys and store the rest in meta
        const filteredMeta = Object.entries(frontMatter).reduce((acc, [key, value]) => {
          if (!key.startsWith('privateplot-')) {
            acc[key] = value;
          }
          return acc;
        }, {} as Record<string, any>);

        // Only set meta if there are any non-privateplot keys
        if (Object.keys(filteredMeta).length > 0) {
          meta = filteredMeta;
        }

        // Remove the frontmatter from content
        cleanContent = content.slice(frontMatterMatch[0].length).trim();
      } catch (e) {
        console.error('Error parsing frontmatter:', e);
      }
    }

    return { meta, content: cleanContent };
  }

  /**
   * Invalidates article-related cache entries
   * This is more precise than clearing the entire cache
   */
  private async invalidateCache(): Promise<void> {
    // Clear the article list caches
    await this.cache.delete('list');
    await this.cache.delete('list-metadata');

    // Get all articles to clear individual article caches
    const dbArticles = await this.db.select({ slug: articles.slug }).from(articles);

    // Clear cache for each article by slug
    await Promise.all(
      dbArticles.map(article => this.cache.delete(`article/${article.slug}`))
    );

    // Notify RSS service that cache has been invalidated
    this.eventBus.emit(RSS_EVENTS.CACHE_INVALIDATED);
  }

  /**
   * List all articles with full content
   * Note: Articles are pre-rendered during create/update, no runtime rendering needed
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
   * List all articles with metadata only (no content/rendered)
   * Use this for listing pages where full content is not needed
   */
  async listMetadata(): Promise<ArticleMetadata[]> {
    const cacheKey = 'list-metadata';
    const cachedData = await this.cache.get<ArticleMetadata[]>(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    const dbArticles = await this.db
      .select({
        id: articles.id,
        title: articles.title,
        slug: articles.slug,
        summary: articles.summary,
        meta: articles.meta,
        createdDate: articles.createdDate,
        updatedDate: articles.updatedDate,
      })
      .from(articles);

    await this.cache.set(cacheKey, dbArticles);
    return dbArticles as ArticleMetadata[];
  }

  /**
   * Get a single article by slug
   * Note: Articles are pre-rendered during create/update, no runtime rendering needed
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
      return article;
    }

    return undefined;
  }

  /**
   * Create a new article
   */
  async create(article: Omit<Article, 'id' | 'createdDate' | 'updatedDate' | 'slug' | 'summary' | 'rendered' | 'meta'> & {
    summary?: string | null | undefined;
    slug?: string;
  }): Promise<Article> {
    await this.markdownRenderer.initialize();

    const { meta, content } = this.extractMetaFromContent(article.content);

    const newArticle = {
      ...article,
      content,
      slug: article.slug || generateSlug(article.title),
      summary: article.summary ?? extractSummary(content),
      rendered: this.markdownRenderer.render(content),
      meta: meta as Record<string, any> | null,
    };

    const results = await this.db.insert(articles).values(newArticle).returning();

    await this.invalidateCache();
    return results[0] as Article;
  }

  /**
   * Update an existing article
   */
  async update(id: string, article: Partial<Omit<Article, 'id' | 'createdDate' | 'slug' | 'summary' | 'updatedDate' | 'rendered' | 'meta'>> & {
    summary?: string | null;
  }): Promise<Article | undefined> {
    await this.markdownRenderer.initialize();

    const updateData: Record<string, any> = {
      ...article,
      updatedDate: new Date(),
    };

    if (article.content) {
      const { meta, content } = this.extractMetaFromContent(article.content);
      updateData.content = content;
      updateData.meta = meta as Record<string, any> | null;
      updateData.rendered = this.markdownRenderer.render(content);

      // Generate new summary if content is updated and summary is not provided
      if (article.summary === undefined) {
        updateData.summary = extractSummary(content);
      }
    }

    const results = await this.db
      .update(articles)
      .set(updateData)
      .where(eq(articles.id, id))
      .returning();

    await this.invalidateCache();
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

    await this.invalidateCache();
    return results.length > 0;
  }
}
