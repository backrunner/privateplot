import { load, dump } from 'js-yaml';
import { readFile, writeFile } from 'node:fs/promises';
import type { Settings, FrontMatter, ArticleResponse, PublishStats, FailedArticle, PublishOptions } from '../types';
import { getAuthToken } from '../utils/config';
import { logger } from '../utils/logger';
import { isMarkdownFile, isDirectory, findMarkdownFiles, hasFileChanged } from '../utils/files';
import { apiRequest } from '../utils/api';

const MAX_RETRIES = 2;
const RETRY_DELAY = 1000; // 1 second
const DEFAULT_CONCURRENCY = 10;

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function askForRetry(): Promise<boolean> {
  const { default: inquirer } = await import('inquirer');
  const { retry } = await inquirer.prompt([{
    type: 'confirm',
    name: 'retry',
    message: 'Would you like to retry publishing the failed articles? (y/N)',
    default: false
  }]);

  return retry;
}

/**
 * Controls concurrent execution of async tasks with a maximum limit
 * @class ConcurrencyController
 */
export class ConcurrencyController {
  private running: number = 0;
  private readonly queue: (() => Promise<void>)[] = [];

  public constructor(private readonly maxConcurrency: number) {}

  /**
   * Adds a task to be executed, respecting the concurrency limit
   * @param task - The async task to be executed
   * @returns Promise that resolves when the task completes
   */
  public async add(task: () => Promise<void>): Promise<void> {
    if (this.running >= this.maxConcurrency) {
      await new Promise<void>(resolve => {
        this.queue.push(async () => {
          await task();
          resolve();
        });
      });
    } else {
      this.running++;
      try {
        await task();
      } finally {
        this.running--;
        if (this.queue.length > 0) {
          const nextTask = this.queue.shift()!;
          void this.add(nextTask);
        }
      }
    }
  }
}

async function publishSingleArticle(filePath: string, settings: Settings, retryCount = 0): Promise<{ success: boolean; error?: string; auth_error?: boolean }> {
  const content = await readFile(filePath, 'utf-8');
  const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

  // Get filename without extension as default title
  const fileName = filePath.split(/[/\\]/).pop() || '';
  const fileNameWithoutExt = fileName.replace(/\.[^.]+$/, '');
  // Convert kebab-case or snake_case to Title Case
  const defaultTitle = fileNameWithoutExt
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char: string) => char.toUpperCase());

  let frontMatter: FrontMatter = {};
  let markdownContent = content;
  let frontMatterIndent = '';

  if (frontMatterMatch) {
    try {
      frontMatter = load(frontMatterMatch[1]) as FrontMatter;
      markdownContent = content.slice(frontMatterMatch[0].length).trim();

      const indentMatch = frontMatterMatch[1].match(/^( +)/m);
      if (indentMatch) {
        frontMatterIndent = indentMatch[1];
      }
    } catch (e) {
      return { success: false, error: `Error parsing frontmatter: ${e}` };
    }
  }

  // Check if file has changed
  if (frontMatter['privateplot-last-published']) {
    const hasChanged = await hasFileChanged(filePath, frontMatter['privateplot-last-published']);
    if (!hasChanged) {
      logger.skipped(frontMatter.title || defaultTitle, 'no changes since last publish');
      return { success: true };
    }
  }

  try {
    if (frontMatter['privateplot-id'] && frontMatter['privateplot-host'] === settings.instanceHost) {
      logger.articleAction('Updating', frontMatter.title || defaultTitle);

      const result = await apiRequest<ArticleResponse>(settings, {
        method: 'PATCH',
        path: '/api/internal/article',
        queryParams: { id: frontMatter['privateplot-id'] },
        body: {
          content: markdownContent,
          title: frontMatter.title || defaultTitle,
          summary: frontMatter.summary,
        }
      });

      if (!result.success) {
        if (retryCount < MAX_RETRIES) {
          logger.retry(frontMatter.title || defaultTitle, retryCount + 2);
          await sleep(RETRY_DELAY);
          return publishSingleArticle(filePath, settings, retryCount + 1);
        }

        // Check if error is auth related
        const isAuthError = result.status === 401 || result.status === 403;
        return { success: false, error: result.error, auth_error: isAuthError };
      }
    } else {
      logger.articleAction('Publishing', frontMatter.title || defaultTitle);

      const result = await apiRequest<ArticleResponse>(settings, {
        method: 'PUT',
        path: '/api/internal/article',
        body: {
          content: markdownContent,
          title: frontMatter.title || defaultTitle,
          summary: frontMatter.summary,
          slug: frontMatter.slug,
        }
      });

      if (!result.success) {
        if (retryCount < MAX_RETRIES) {
          logger.retry(frontMatter.title || defaultTitle, retryCount + 2);
          await sleep(RETRY_DELAY);
          return publishSingleArticle(filePath, settings, retryCount + 1);
        }

        // Check if error is auth related
        const isAuthError = result.status === 401 || result.status === 403;
        return { success: false, error: result.error, auth_error: isAuthError };
      }

      frontMatter = {
        ...frontMatter,
        'privateplot-id': result.data?.id,
        'privateplot-host': settings.instanceHost,
      };
    }

    // Update publish time
    frontMatter['privateplot-last-published'] = new Date().toISOString();

    let yamlContent = dump(frontMatter);

    if (frontMatterIndent) {
      yamlContent = yamlContent.split('\n').map((line, index) => {
        if (line && index < yamlContent.split('\n').length - 1) {
          return frontMatterIndent + line;
        }
        return line;
      }).join('\n');
    }

    if (!frontMatterMatch) {
      const updatedContent = `---\n${yamlContent}---\n\n${markdownContent}`;
      await writeFile(filePath, updatedContent);
    } else {
      const updatedContent = content.replace(/^---\n[\s\S]*?\n---/, `---\n${yamlContent}---`);
      await writeFile(filePath, updatedContent);
    }

    return { success: true };
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      logger.retry(frontMatter.title || defaultTitle, retryCount + 2);
      await sleep(RETRY_DELAY);
      return publishSingleArticle(filePath, settings, retryCount + 1);
    }
    return { success: false, error: String(error) };
  }
}

async function askForConfirmation(files: string[], basePath: string): Promise<boolean> {
  if (files.length === 0) {
    return false;
  }

  const previewLimit = 5;
  const preview = files.slice(0, previewLimit);
  const normalizedBasePath = basePath.replace(/\\/g, '/');

  logger.info('Found publishable markdown files:');
  preview.forEach(file => {
    const normalizedFile = file.replace(/\\/g, '/');
    const relativePath = normalizedFile.startsWith(normalizedBasePath)
      ? normalizedFile.slice(normalizedBasePath.length).replace(/^\/+/, '')
      : normalizedFile;
    logger.info(`- ${relativePath}`);
  });

  if (files.length > previewLimit) {
    logger.info(`... and ${files.length - previewLimit} more files`);
  }
  logger.info(`Total: ${files.length} files`);

  const { default: inquirer } = await import('inquirer');
  const { confirm } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirm',
    message: `Do you want to publish these ${files.length} files?`,
    default: false
  }]);

  return confirm ? true : false;
}

export async function publishArticle(path: string, settings: Settings, options: PublishOptions = {}) {
  const concurrency = options.concurrency || DEFAULT_CONCURRENCY;
  const controller = new ConcurrencyController(concurrency);

  // Check if path exists
  const isDir = await isDirectory(path);
  const isMd = await isMarkdownFile(path);

  if (!isDir && !isMd) {
    logger.error(`Invalid path: ${path} - must be a markdown file or directory`);
    process.exit(1);
  }

  // Get all files to process
  const allFiles = isDir ? await findMarkdownFiles(path) : [path];

  if (allFiles.length === 0) {
    logger.warning('No markdown files found');
    return;
  }

  // Filter out draft files
  const nonDraftFiles: string[] = [];
  const draftFiles: string[] = [];

  for (const file of allFiles) {
    const content = await readFile(file, 'utf-8');
    const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

    if (frontMatterMatch) {
      try {
        const frontMatter = load(frontMatterMatch[1]) as FrontMatter;
        if (frontMatter.draft === true) {
          draftFiles.push(file);
        } else {
          nonDraftFiles.push(file);
        }
      } catch (e) {
        // If we can't parse frontmatter, include the file anyway
        nonDraftFiles.push(file);
      }
    } else {
      // No frontmatter, include the file
      nonDraftFiles.push(file);
    }
  }

  if (draftFiles.length > 0) {
    logger.info(`Skipping ${draftFiles.length} draft files`);
  }

  if (nonDraftFiles.length === 0) {
    logger.warning('No publishable files found (all are drafts)');
    return;
  }

  // Ask for confirmation before publishing
  const confirmed = await askForConfirmation(nonDraftFiles, path);
  if (!confirmed) {
    logger.info('Publishing cancelled');
    return;
  }

  // Initialize statistics
  const stats: PublishStats = {
    total: nonDraftFiles.length,
    published: 0,
    skipped: 0,
    failed: 0,
  };

  // Track failed articles
  const failedArticles: FailedArticle[] = [];
  const authFailedArticles: FailedArticle[] = [];

  logger.publishStart(nonDraftFiles.length);
  let completed = 0;

  // Create all publish tasks
  const tasks = nonDraftFiles.map(file => async () => {
    const result = await publishSingleArticle(file, settings);

    if (result.success) {
      stats.published++;
    } else {
      stats.failed++;
      const content = await readFile(file, 'utf-8');
      const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

      // Get filename without extension as default title
      const fileName = file.split(/[/\\]/).pop() || '';
      const fileNameWithoutExt = fileName.replace(/\.[^.]+$/, '');
      // Convert kebab-case or snake_case to Title Case
      const defaultTitle = fileNameWithoutExt
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (char: string) => char.toUpperCase());

      let title = defaultTitle;

      if (frontMatterMatch) {
        try {
          const frontMatter = load(frontMatterMatch[1]) as FrontMatter;
          title = frontMatter.title || defaultTitle;
        } catch { } // Ignore parsing errors
      }

      const failedArticle = {
        path: file,
        title,
        error: result.error || 'Unknown error',
        retries: MAX_RETRIES + 1,
      };

      if (result.auth_error) {
        authFailedArticles.push(failedArticle);
      } else {
        failedArticles.push(failedArticle);
      }
    }

    completed++;
    logger.progress(completed, nonDraftFiles.length);
  });

  // Execute all tasks concurrently
  await Promise.all(tasks.map(task => controller.add(task)));

  logger.publishEnd(stats);

  // Show auth-related failures first, as they need to be fixed before retrying
  if (authFailedArticles.length > 0) {
    logger.failedArticles(authFailedArticles);
    logger.warning('Please fix authentication issues before retrying these articles');
  }

  // If there are non-auth-related failed articles, show the list and ask for retry
  if (failedArticles.length > 0) {
    logger.failedArticles(failedArticles);

    const shouldRetry = await askForRetry();
    if (shouldRetry) {
      // Reset statistics
      stats.total = failedArticles.length;
      stats.published = 0;
      stats.skipped = 0;
      stats.failed = 0;

      logger.publishStart(failedArticles.length);
      completed = 0;

      // Retry failed articles
      const retryTasks = failedArticles.map(({ path }) => async () => {
        const result = await publishSingleArticle(path, settings);

        if (result.success) {
          stats.published++;
        } else {
          stats.failed++;
        }

        completed++;
        logger.progress(completed, failedArticles.length);
      });

      // Execute retry tasks concurrently
      await Promise.all(retryTasks.map(task => controller.add(task)));

      logger.publishEnd(stats);
    }
  }
}
