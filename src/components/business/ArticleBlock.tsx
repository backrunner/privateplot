import { formatDate, isValidDate, areDifferentDates } from '../../utils/date';
import styles from './ArticleBlock.module.scss';

interface Props {
  title: string;
  summary: string;
  createdAt: Date;
  updatedAt: Date | undefined;
  slug: string;
}

export const ArticleBlock = ({ title, summary, createdAt, updatedAt, slug }: Props) => {
  const showCreatedDate = isValidDate(createdAt);
  const showUpdatedDate = isValidDate(updatedAt) && areDifferentDates(createdAt, updatedAt);

  return (
    <article class={styles['article-block']}>
      <div class={styles['article-block__title-wrapper']}>
        <div class={styles['article-block__title-border']} />
        <a href={`/article/${slug}`} class={styles['article-block__title-link']}>
          <h2 class={styles['article-block__title']}>{title}</h2>
        </a>
      </div>
      <div class={styles['article-block__time-info']}>
        {showUpdatedDate && (
          <span class={styles['article-block__time-tag']}>
            Updated: {formatDate(updatedAt!)}
          </span>
        )}
        {showCreatedDate && (
          <span class={styles['article-block__time-tag']}>
            Created: {formatDate(createdAt)}
          </span>
        )}
      </div>
      <div class={styles['article-block__content']}>
        <p class={styles['article-block__summary']}>{summary}</p>
        <a href={`/article/${slug}`} class={styles['article-block__read-more']}>Read Full</a>
      </div>
    </article>
  );
};