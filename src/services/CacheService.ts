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
   * Get data from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const cache = await this.getCache();
    if (!cache) return null;

    const cacheKey = this.getCacheKey(key);

    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
      const data = await cachedResponse.json() as T;
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
