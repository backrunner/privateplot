import type { D1Database } from '@cloudflare/workers-types';
import rss from '@astrojs/rss';
import { SITE_TITLE, SITE_DESCRIPTION } from '../consts';
import { ArticleService } from './ArticleService';
import { CacheService } from './CacheService';
import { EventBus } from '../utils/eventbus';

export const RSS_EVENTS = {
  CACHE_INVALIDATED: 'rss:cache:invalidated',
} as const;

export class RSSService {
  private static instance: RSSService;
  private cache: CacheService;
  private articleService: ArticleService;
  private eventBus: EventBus;

  private constructor(d1: D1Database) {
    this.cache = new CacheService('rss');
    this.articleService = new ArticleService(d1);
    this.eventBus = EventBus.getInstance();

    // Listen to RSS cache invalidation events
    this.eventBus.on(RSS_EVENTS.CACHE_INVALIDATED, () => {
      this.invalidateCache();
    });
  }

  public static getInstance(d1: D1Database): RSSService {
    if (!RSSService.instance) {
      RSSService.instance = new RSSService(d1);
    }
    return RSSService.instance;
  }

  private async invalidateCache(): Promise<void> {
    await this.cache.delete('feed');
  }

  public async generateFeed(siteUrl: URL): Promise<Response> {
    const cachedFeed = await this.cache.get<string>('feed');
    if (cachedFeed) {
      return new Response(cachedFeed, {
        headers: {
          'Content-Type': 'application/xml',
        },
      });
    }

    const articles = await this.articleService.list();
    const feed = await rss({
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      site: siteUrl,
      items: articles.map((article) => ({
        title: article.title,
        description: article.summary || '',
        link: `/article/${article.slug}/`,
        pubDate: new Date(article.createdDate),
      })),
    });

    // Store the raw XML string in cache
    const feedText = feed.text();
    await this.cache.set('feed', feedText, 3600); // Cache for 1 hour

    return feed;
  }
}
