import { useCallback } from 'preact/hooks';
import styles from './ArticleBlock.module.scss';

interface Props {
  title: string;
  summary: string;
  createdAt: Date;
  updatedAt: Date;
  slug: string;
}

export const ArticleBlock = ({ title, summary, createdAt, updatedAt, slug }: Props) => {
  const formatDate = useCallback((date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }, []);

  return (
    <article class={styles['article-block']}>
      <div class={styles['article-block__title-wrapper']}>
        <div class={styles['article-block__title-border']} />
        <a href={`/article/${slug}`} class={styles['article-block__title-link']}>
          <h2 class={styles['article-block__title']}>{title}</h2>
        </a>
      </div>
      <div class={styles['article-block__time-info']}>
        <span class={styles['article-block__time-tag']}>Updated: {formatDate(updatedAt)}</span>
        <span class={styles['article-block__time-tag']}>Created: {formatDate(createdAt)}</span>
      </div>
      <div class={styles['article-block__content']}>
        <p class={styles['article-block__summary']}>{summary}</p>
        <a href={`/article/${slug}`} class={styles['article-block__read-more']}>Read Full</a>
      </div>
    </article>
  );
};