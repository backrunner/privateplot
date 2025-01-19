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
    <article class={styles.articleBlock}>
      <div class={styles.titleContainer}>
        <div class={styles.titleBorder} />
        <h2 class={styles.title}>{title}</h2>
      </div>
      <div class={styles.timeInfo}>
        <span class={styles.timeTag}>Updated: {formatDate(updatedAt)}</span>
        <span class={styles.timeTag}>Created: {formatDate(createdAt)}</span>
      </div>
      <div class={styles.content}>
        <p class={styles.summary}>{summary}</p>
        <a href={`/article/${slug}`} class={styles.readFull}>Read Full</a>
      </div>
    </article>
  );
}; 