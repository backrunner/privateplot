import { ArticleService } from './ArticleService';
import { CacheService } from './CacheService';
import { EventBus } from '../utils/eventbus';
import { XMLValidator } from '../utils/xml';

export const SITEMAP_EVENTS = {
  CACHE_INVALIDATED: 'sitemap:cache:invalidated',
} as const;

/**
 * Interface for static page entries in the sitemap
 */
export interface StaticPage {
  /** The path of the page relative to the site root (e.g., '/' for homepage) */
  path: string;
  /** The priority of the page (0.0 to 1.0) */
  priority: number;
  /** How frequently the page is likely to change */
  changefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  /** The last modified date of the page */
  lastmod?: Date;
}

export class SitemapService {
  private static instance: SitemapService;
  private cache: CacheService;
  private articleService: ArticleService;
  private eventBus: EventBus;
  private readonly env: Env;
  private staticPages: StaticPage[];

  private constructor(env: Env) {
    this.cache = new CacheService('sitemap');
    this.articleService = new ArticleService(env.DB);
    this.eventBus = EventBus.getInstance();
    this.env = env;

    // Default static pages
    this.staticPages = [
      {
        path: '/',
        priority: 1.0,
        changefreq: 'daily',
        lastmod: new Date()
      },
    ];

    // Listen to sitemap cache invalidation events
    this.eventBus.on(SITEMAP_EVENTS.CACHE_INVALIDATED, () => {
      this.invalidateCache();
    });
  }

  public static getInstance(env: Env): SitemapService {
    if (!SitemapService.instance) {
      SitemapService.instance = new SitemapService(env);
    }
    return SitemapService.instance;
  }

  private async invalidateCache(): Promise<void> {
    await this.cache.delete('sitemap');
  }

  /**
   * Generate the XML sitemap
   * @param siteUrl The base URL of the site
   * @returns Response containing the XML sitemap
   */
  public async generateSitemap(siteUrl: URL): Promise<Response> {
    const cachedSitemap = await this.cache.get<string>('sitemap');
    if (cachedSitemap) {
      // Validate the cached XML before returning it
      if (XMLValidator.isValid(cachedSitemap, {
        rootElement: 'urlset',
        logPrefix: 'Sitemap'
      })) {
        return new Response(cachedSitemap, {
          headers: {
            'Content-Type': 'application/xml',
          },
        });
      } else {
        // If cached XML is invalid, invalidate the cache
        console.warn('Invalid Sitemap XML found in cache, regenerating...');
        await this.invalidateCache();
      }
    }

    // Get all articles
    const articles = await this.articleService.list();

    // Generate sitemap XML
    const sitemap = this.generateSitemapXML(siteUrl, articles);

    // Validate and cache the sitemap
    if (XMLValidator.isValid(sitemap, {
      rootElement: 'urlset',
      logPrefix: 'Sitemap'
    })) {
      await this.cache.set('sitemap', sitemap, 3600); // Cache for 1 hour
    } else {
      console.error('Generated Sitemap XML is invalid, not caching');
    }

    return new Response(sitemap, {
      headers: {
        'Content-Type': 'application/xml',
      },
    });
  }

  /**
   * Generate the XML sitemap content
   * @param siteUrl The base URL of the site
   * @param articles List of articles to include in the sitemap
   * @returns XML string of the sitemap
   */
  private generateSitemapXML(siteUrl: URL, articles: any[]): string {
    const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>';
    const urlsetOpen = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
    const urlsetClose = '</urlset>';

    let urlEntries = '';

    // Add static pages first
    for (const page of this.staticPages) {
      const url = new URL(page.path, siteUrl).toString();
      const lastmod = page.lastmod ? `<lastmod>${page.lastmod.toISOString()}</lastmod>` : '';

      urlEntries += `
  <url>
    <loc>${XMLValidator.escape(url)}</loc>
    ${lastmod}
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority.toFixed(1)}</priority>
  </url>`;
    }

    // Add article pages
    for (const article of articles) {
      const url = new URL(`/article/${article.slug}/`, siteUrl).toString();
      const lastmod = article.updatedDate || article.createdDate;

      urlEntries += `
  <url>
    <loc>${XMLValidator.escape(url)}</loc>
    <lastmod>${new Date(lastmod).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`;
    }

    return `${xmlHeader}
${urlsetOpen}${urlEntries}
${urlsetClose}`;
  }
}
