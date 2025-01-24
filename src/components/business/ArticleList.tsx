import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type { Article } from '../../types/article';

import { ArticleBlock } from './ArticleBlock';
import styles from './ArticleList.module.scss';

interface ArticleResponse {
  articles: Array<{
    title: string;
    summary: string;
    createdAt: string;
    updatedAt: string;
    slug: string;
  }>;
  hasMore: boolean;
  total: number;
}

interface Props {
  initialArticles: Article[];
  initialHasMore: boolean;
  total: number;
}

interface ArticleBlockProps {
  title: string;
  summary: string | null;
  createdAt: Date;
  updatedAt?: Date;
  slug: string;
}

export const ArticleList = ({ initialArticles, initialHasMore, total }: Props) => {
  const [articles, setArticles] = useState<Article[]>(initialArticles);
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
            content: '', // API doesn't return content for list view
            createdDate: new Date(article.createdAt),
            updatedDate: new Date(article.updatedAt),
            slug: article.slug,
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
    <div class={styles.articleList} data-total={total}>
      <div class={styles.articleContainer}>
        {articles.length > 0 ? (
          articles.map((article) => (
            <ArticleBlock
              key={article.id}
              title={article.title}
              summary={article.summary}
              createdAt={article.createdDate}
              updatedAt={article.updatedDate || undefined}
              slug={article.slug}
            />
          ))
        ) : (
          <div class={styles.emptyState}>
            <p>No articles found</p>
            <p>Check back later for new content</p>
          </div>
        )}
      </div>
      {hasMore && (
        <div ref={loadingRef} class={styles.loadingIndicator}>
          Loading more articles...
        </div>
      )}
    </div>
  );
};
