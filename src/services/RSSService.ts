import rss from '@astrojs/rss';
import { ArticleService } from './ArticleService';
import { CacheService } from './CacheService';
import { EventBus } from '../utils/eventbus';
import { XMLValidator } from '../utils/xml';

export const RSS_EVENTS = {
  CACHE_INVALIDATED: 'rss:cache:invalidated',
} as const;

export class RSSService {
  private static instance: RSSService;
  private cache: CacheService;
  private articleService: ArticleService;
  private eventBus: EventBus;
  private readonly env: Env;

  private constructor(env: Env) {
    this.cache = new CacheService('rss');
    this.articleService = new ArticleService(env.DB);
    this.eventBus = EventBus.getInstance();
    this.env = env;
    // Listen to RSS cache invalidation events
    this.eventBus.on(RSS_EVENTS.CACHE_INVALIDATED, () => {
      this.invalidateCache();
    });
  }

  public static getInstance(env: Env): RSSService {
    if (!RSSService.instance) {
      RSSService.instance = new RSSService(env);
    }
    return RSSService.instance;
  }

  private async invalidateCache(): Promise<void> {
    await this.cache.delete('feed');
  }

  public async generateFeed(siteUrl: URL): Promise<Response> {
    const cachedFeed = await this.cache.get<string>('feed');
    if (cachedFeed) {
      // Validate the cached XML before returning it
      if (XMLValidator.isValid(cachedFeed, {
        rootElement: 'rss',
        requiredElements: ['channel', 'title'],
        logPrefix: 'RSS'
      })) {
        return new Response(cachedFeed, {
          headers: {
            'Content-Type': 'application/xml',
          },
        });
      } else {
        // If cached XML is invalid, invalidate the cache
        console.warn('Invalid RSS XML found in cache, regenerating...');
        await this.invalidateCache();
      }
    }

    const articles = await this.articleService.list();
    const feed = await rss({
      title: this.env.SITE_TITLE,
      description: this.env.SITE_DESCRIPTION,
      site: siteUrl,
      items: articles.map((article) => ({
        title: article.title,
        description: article.summary || '',
        link: `/article/${article.slug}/`,
        pubDate: new Date(article.createdDate),
      })),
    });

    // Store the raw XML string in cache
    const cloned = feed.clone();
    const feedText = await cloned.text();

    // Validate the generated XML before caching
    if (XMLValidator.isValid(feedText, {
      rootElement: 'rss',
      requiredElements: ['channel', 'title'],
      logPrefix: 'RSS'
    })) {
      await this.cache.set('feed', feedText, 3600); // Cache for 1 hour
    } else {
      console.error('Generated RSS XML is invalid, not caching');
    }

    return feed;
  }
}
