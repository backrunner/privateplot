import { load, dump } from 'js-yaml';
import { readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import type { Settings, FrontMatter, ArticleResponse, PublishStats, FailedArticle, PublishOptions } from '../types';
import { getAuthToken } from '../utils/config';
import { logger } from '../utils/logger';
import { isMarkdownFile, isDirectory, findMarkdownFiles, hasFileChanged } from '../utils/files';

const MAX_RETRIES = 2;
const RETRY_DELAY = 1000; // 1 second
const DEFAULT_CONCURRENCY = 10;

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function askForRetry(): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question('', answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
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

async function publishSingleArticle(filePath: string, settings: Settings, retryCount = 0): Promise<{ success: boolean; error?: string }> {
  const content = await readFile(filePath, 'utf-8');
  const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

  let frontMatter: FrontMatter = {};
  let markdownContent = content;
  let frontMatterIndent = '';

  if (frontMatterMatch) {
    try {
      frontMatter = load(frontMatterMatch[1]) as FrontMatter;
      markdownContent = content.slice(frontMatterMatch[0].length).trim();

      // Skip draft articles
      if (frontMatter.draft === true) {
        logger.skipped(frontMatter.title || 'Untitled', 'draft article');
        return { success: true };
      }

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
      logger.skipped(frontMatter.title || 'Untitled', 'no changes since last publish');
      return { success: true };
    }
  }

  const authToken = await getAuthToken(settings);
  if (!authToken) {
    return { success: false, error: 'No auth token found. Please set it using `privateplot settings --token <token>` or INTERNAL_AUTH_TOKEN environment variable' };
  }

  if (!settings.instanceHost) {
    return { success: false, error: 'No instance host configured. Please set it using `privateplot settings --host <host>` or PRIVATEPLOT_HOST environment variable' };
  }

  const headers = {
    'Content-Type': 'application/json',
    'X-Internal-Auth-Token': authToken,
  };

  const protocol = settings.instanceHost === 'localhost' || settings.instanceHost.startsWith('localhost:') ? 'http' : 'https';
  const baseUrl = `${protocol}://${settings.instanceHost}/api/internal/article`;

  try {
    if (frontMatter['privateplot-id'] && frontMatter['privateplot-host'] === settings.instanceHost) {
      logger.articleAction('Updating', frontMatter.title || 'Untitled');
      const response = await fetch(`${baseUrl}?id=${frontMatter['privateplot-id']}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          content: markdownContent,
          title: frontMatter.title || 'Untitled',
          summary: frontMatter.summary,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        if (retryCount < MAX_RETRIES) {
          logger.retry(frontMatter.title || 'Untitled', retryCount + 2);
          await sleep(RETRY_DELAY);
          return publishSingleArticle(filePath, settings, retryCount + 1);
        }
        return { success: false, error };
      }
    } else {
      logger.articleAction('Publishing', frontMatter.title || 'Untitled');
      const response = await fetch(baseUrl, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          content: markdownContent,
          title: frontMatter.title || 'Untitled',
          summary: frontMatter.summary,
          slug: frontMatter.slug,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        if (retryCount < MAX_RETRIES) {
          logger.retry(frontMatter.title || 'Untitled', retryCount + 2);
          await sleep(RETRY_DELAY);
          return publishSingleArticle(filePath, settings, retryCount + 1);
        }
        return { success: false, error };
      }

      const article = (await response.json()) as ArticleResponse;

      frontMatter = {
        ...frontMatter,
        'privateplot-id': article.id,
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
      logger.retry(frontMatter.title || 'Untitled', retryCount + 2);
      await sleep(RETRY_DELAY);
      return publishSingleArticle(filePath, settings, retryCount + 1);
    }
    return { success: false, error: String(error) };
  }
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
  const files = isDir ? await findMarkdownFiles(path) : [path];

  if (files.length === 0) {
    logger.warning('No markdown files found');
    return;
  }

  // Initialize statistics
  const stats: PublishStats = {
    total: files.length,
    published: 0,
    skipped: 0,
    failed: 0,
  };

  // Track failed articles
  const failedArticles: FailedArticle[] = [];

  logger.publishStart(files.length);
  let completed = 0;

  // Create all publish tasks
  const tasks = files.map(file => async () => {
    const result = await publishSingleArticle(file, settings);

    if (result.success) {
      stats.published++;
    } else {
      stats.failed++;
      const content = await readFile(file, 'utf-8');
      const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      let title = 'Untitled';

      if (frontMatterMatch) {
        try {
          const frontMatter = load(frontMatterMatch[1]) as FrontMatter;
          title = frontMatter.title || 'Untitled';
        } catch { } // Ignore parsing errors
      }

      failedArticles.push({
        path: file,
        title,
        error: result.error || 'Unknown error',
        retries: MAX_RETRIES + 1,
      });
    }

    completed++;
    logger.progress(completed, files.length);
  });

  // Execute all tasks concurrently
  await Promise.all(tasks.map(task => controller.add(task)));

  logger.publishEnd(stats);

  // If there are failed articles, show the list and ask for retry
  if (failedArticles.length > 0) {
    logger.failedArticles(failedArticles);
    logger.retryPrompt(failedArticles.length);

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
