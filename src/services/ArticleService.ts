// Third-party imports
import { eq } from 'drizzle-orm';
import { load } from 'js-yaml';
import type { D1Database } from '@cloudflare/workers-types';
import type { Article } from '../types/article';
import { getDb } from '../db';
import { articles } from '../db/schema';
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

  private async invalidateCache(): Promise<void> {
    await this.cache.clear();
    this.eventBus.emit(RSS_EVENTS.CACHE_INVALIDATED);
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
