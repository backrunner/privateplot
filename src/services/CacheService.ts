const DEFAULT_TTL = 3600; // 1 hour in seconds

export class CacheService {
  private cache: Cache | undefined;
  private namespace: string;
  private isCacheAvailable: boolean;

  constructor(namespace: string) {
    this.namespace = namespace;
    this.isCacheAvailable = typeof caches !== 'undefined';
  }

  private async getCache(): Promise<Cache | null> {
    if (!this.isCacheAvailable) {
      return null;
    }

    if (!this.cache) {
      this.cache = await caches.open(`${this.namespace}-cache`);
    }
    return this.cache;
  }

  private getCacheKey(key: string): string {
    return `http://${this.namespace}/${key}`;
  }

  /**
   * Recursively restores Date objects from ISO strings in the parsed JSON data
   * Detects ISO 8601 date strings and converts them back to Date objects
   */
  private restoreDates(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      // ISO 8601 date format regex
      const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/;
      if (isoDateRegex.test(obj)) {
        return new Date(obj);
      }
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.restoreDates(item));
    }

    if (typeof obj === 'object') {
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          obj[key] = this.restoreDates(obj[key]);
        }
      }
    }

    return obj;
  }

  /**
   * Get data from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const cache = await this.getCache();
    if (!cache) return null;

    const cacheKey = this.getCacheKey(key);

    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
      const rawData = await cachedResponse.json();
      // Restore Date objects from the parsed JSON
      const data = this.restoreDates(rawData) as T;
      return data;
    }

    return null;
  }

  /**
   * Set data to cache
   */
  async set<T>(key: string, data: T, ttl: number = DEFAULT_TTL): Promise<void> {
    const cache = await this.getCache();
    if (!cache) return;

    const cacheKey = this.getCacheKey(key);

    const response = new Response(JSON.stringify(data), {
      headers: {
        'Cache-Control': `max-age=${ttl}`
      }
    });

    await cache.put(cacheKey, response);
  }

  /**
   * Delete a specific key from cache
   */
  async delete(key: string): Promise<void> {
    const cache = await this.getCache();
    if (!cache) return;

    const cacheKey = this.getCacheKey(key);
    await cache.delete(cacheKey);
  }
}
