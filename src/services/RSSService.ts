import rss from '@astrojs/rss';
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

  /**
   * Validates if the XML string is well-formed
   * @param xml The XML string to validate
   * @returns True if the XML is valid, false otherwise
   */
  private isValidXML(xml: string): boolean {
    try {
      // Basic structure validation
      if (!xml || typeof xml !== 'string') {
        console.error('Invalid RSS: Not a string');
        return false;
      }

      // Check if it starts with XML declaration or RSS tag
      if (!xml.trim().startsWith('<?xml') && !xml.trim().startsWith('<rss')) {
        console.error('Invalid RSS: Missing XML declaration or RSS root element');
        return false;
      }

      // Check for basic RSS structure
      if (!xml.includes('<rss') || !xml.includes('</rss>')) {
        console.error('Invalid RSS: Missing RSS tags');
        return false;
      }

      // Check for channel element
      if (!xml.includes('<channel>') || !xml.includes('</channel>')) {
        console.error('Invalid RSS: Missing channel tags');
        return false;
      }

      // Check for required elements in channel
      if (!xml.includes('<title>') || !xml.includes('</title>')) {
        console.error('Invalid RSS: Missing title tags');
        return false;
      }

      // Check for well-formed XML by looking for unmatched tags
      // This is a simplified check and not a full XML parser
      const openTags: string[] = [];
      const tagRegex = /<\/?([a-zA-Z0-9:]+)[^>]*>/g;
      let match;

      while ((match = tagRegex.exec(xml)) !== null) {
        const fullTag = match[0];
        const tagName = match[1];

        // Skip self-closing tags and processing instructions
        if (fullTag.endsWith('/>') || fullTag.startsWith('<?')) {
          continue;
        }

        // Check if it's an opening or closing tag
        if (fullTag.startsWith('</')) {
          // Closing tag
          if (openTags.length === 0 || openTags[openTags.length - 1] !== tagName) {
            console.error(`Invalid RSS: Unmatched closing tag ${tagName}`);
            return false;
          }
          openTags.pop();
        } else {
          // Opening tag
          openTags.push(tagName);
        }
      }

      // Check if all tags are closed
      if (openTags.length > 0) {
        console.error(`Invalid RSS: Unclosed tags: ${openTags.join(', ')}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error('XML validation error:', error);
      return false;
    }
  }

  public async generateFeed(siteUrl: URL): Promise<Response> {
    const cachedFeed = await this.cache.get<string>('feed');
    if (cachedFeed) {
      // Validate the cached XML before returning it
      if (this.isValidXML(cachedFeed)) {
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
    if (this.isValidXML(feedText)) {
      await this.cache.set('feed', feedText, 3600); // Cache for 1 hour
    } else {
      console.error('Generated RSS XML is invalid, not caching');
    }

    return feed;
  }
}
