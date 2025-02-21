export interface Settings {
  instanceHost?: string;
  internalAuthToken?: string;
}

export interface PublishOptions {
  concurrency?: number;
}

export interface FrontMatter {
  'privateplot-id'?: string;
  'privateplot-host'?: string;
  'privateplot-last-published'?: string;
  title?: string;
  summary?: string;
  slug?: string;
  /**
   * Whether this article is a draft
   */
  draft?: boolean;
  [key: string]: any;
}

export interface ArticleResponse {
  id: string;
  title: string;
  content: string;
  summary?: string;
  slug?: string;
}

export interface PublishStats {
  total: number;
  published: number;
  skipped: number;
  failed: number;
}

export interface FailedArticle {
  path: string;
  title: string;
  error: string;
  retries: number;
}
