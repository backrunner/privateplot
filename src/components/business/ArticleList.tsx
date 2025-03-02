import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type { Article } from '../../types/article';

import { ArticleBlock } from './ArticleBlock';
import styles from './ArticleList.module.scss';
import type { DateFormatOptions } from '../../utils/date';

type ListArticle = Omit<Article, 'content' | 'rendered'>;

interface ArticleResponse {
  articles: Array<{
    title: string;
    summary: string;
    createdAt: string;
    updatedAt: string;
    slug: string;
    meta: Record<string, any> | null;
  }>;
  hasMore: boolean;
  total: number;
}

interface Props {
  initialArticles: ListArticle[];
  initialHasMore: boolean;
  total: number;
  dateFormatOptions?: DateFormatOptions;
}

export const ArticleList = ({ initialArticles, initialHasMore, total, dateFormatOptions }: Props) => {
  const [articles, setArticles] = useState<ListArticle[]>(initialArticles);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const loadingRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const loadMoreArticles = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    const nextPage = currentPage + 1;

    try {
      const response = await fetch(`/api/articles?page=${nextPage}`);
      const data = (await response.json()) as ArticleResponse;

      if (data.articles.length > 0) {
        setArticles(prev => [
          ...prev,
          ...data.articles.map(article => ({
            id: `article-${currentPage * 10 + prev.length + 1}`,
            title: article.title,
            summary: article.summary || '',
            createdDate: new Date(article.createdAt),
            updatedDate: new Date(article.updatedAt),
            slug: article.slug,
            meta: article.meta,
          }))
        ]);
        setHasMore(data.hasMore);
        setCurrentPage(nextPage);
      }
    } catch (error) {
      console.error('Error loading more articles:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, hasMore, loading]);

  useEffect(() => {
    if (!loadingRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading) {
          loadMoreArticles();
        }
      },
      { threshold: 0.1 }
    );

    observerRef.current.observe(loadingRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loadMoreArticles, loading]);

  return (
    <div class={styles['article-list']} data-total={total}>
      <div class={styles['article-list__container']}>
        {articles.length > 0 ? (
          articles.map((article) => (
            <ArticleBlock
              key={article.id}
              title={article.title}
              summary={article.summary}
              createdAt={article.createdDate}
              updatedAt={article.updatedDate || undefined}
              slug={article.slug}
              meta={article.meta}
              dateFormatOptions={dateFormatOptions}
            />
          ))
        ) : (
          <div class={styles['article-list__empty']}>
            <p>No articles found</p>
            <p>Check back later for new content</p>
          </div>
        )}
      </div>
      {hasMore && (
        <div ref={loadingRef} class={styles['article-list__loading']}>
          Loading more articles...
        </div>
      )}
    </div>
  );
};
