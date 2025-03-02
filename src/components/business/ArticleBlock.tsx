import { formatDate, isValidDate, areDifferentDates } from '../../utils/date';
import type { DateFormatOptions, CloudflareCfObject } from '../../utils/date';
import styles from './ArticleBlock.module.scss';

interface Props {
  title: string;
  summary: string;
  createdAt: Date;
  updatedAt: Date | undefined;
  slug: string;
  meta: Record<string, any> | null;
  dateFormatOptions?: DateFormatOptions;
}

export const ArticleBlock = ({
  title,
  summary,
  createdAt,
  updatedAt,
  slug,
  dateFormatOptions,
}: Props) => {
  const showCreatedDate = isValidDate(createdAt);
  const showUpdatedDate = isValidDate(updatedAt) && areDifferentDates(createdAt, updatedAt);
  const onlyCreatedDate = showCreatedDate && !showUpdatedDate;

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
          <span class={styles['article-block__time-tag']}>Updated: {formatDate(updatedAt!, dateFormatOptions)}</span>
        )}
        {showCreatedDate && !onlyCreatedDate && (
          <span class={`${styles['article-block__time-tag']} ${styles['article-block__time-tag--desktop-only']}`}>Created: {formatDate(createdAt, dateFormatOptions)}</span>
        )}
        {onlyCreatedDate && (
          <span class={styles['article-block__time-tag']}>{formatDate(createdAt, dateFormatOptions)}</span>
        )}
      </div>
      <div class={styles['article-block__content']}>
        <p class={styles['article-block__summary']}>{summary}</p>
        <a href={`/article/${slug}`} class={styles['article-block__read-more']}>Read Full</a>
      </div>
    </article>
  );
};
