import { load, dump } from 'js-yaml';
import { readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import type { Settings, FrontMatter, ArticleResponse, PublishStats, FailedArticle, PublishOptions } from '../types';
import { getAuthToken } from '../utils/config';
import { logger } from '../utils/logger';
import { isMarkdownFile, isDirectory, findMarkdownFiles, hasFileChanged } from '../utils/files';

const MAX_RETRIES = 2;
const RETRY_DELAY = 1000; // 1秒
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

// 并发控制器
class ConcurrencyController {
  private running = 0;
  private queue: (() => Promise<void>)[] = [];

  constructor(private maxConcurrency: number) {}

  async add(task: () => Promise<void>): Promise<void> {
    if (this.running >= this.maxConcurrency) {
      // 如果达到最大并发数，加入队列等待
      await new Promise<void>(resolve => {
        this.queue.push(async () => {
          await task();
          resolve();
        });
      });
    } else {
      // 否则直接执行
      this.running++;
      try {
        await task();
      } finally {
        this.running--;
        // 执行队列中的下一个任务
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
      
      const indentMatch = frontMatterMatch[1].match(/^( +)/m);
      if (indentMatch) {
        frontMatterIndent = indentMatch[1];
      }
    } catch (e) {
      return { success: false, error: `Error parsing frontmatter: ${e}` };
    }
  }

  // 检查文件是否有修改
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

    // 更新发布时间
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

  // 检查路径是否存在
  const isDir = await isDirectory(path);
  const isMd = await isMarkdownFile(path);

  if (!isDir && !isMd) {
    logger.error(`Invalid path: ${path} - must be a markdown file or directory`);
    process.exit(1);
  }

  // 获取所有需要处理的文件
  const files = isDir ? await findMarkdownFiles(path) : [path];
  
  if (files.length === 0) {
    logger.warning('No markdown files found');
    return;
  }

  // 初始化统计信息
  const stats: PublishStats = {
    total: files.length,
    published: 0,
    skipped: 0,
    failed: 0,
  };

  // 记录失败的文章
  const failedArticles: FailedArticle[] = [];

  logger.publishStart(files.length);
  let completed = 0;

  // 创建所有发布任务
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
        } catch {} // 忽略解析错误
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

  // 并发执行所有任务
  await Promise.all(tasks.map(task => controller.add(task)));

  logger.publishEnd(stats);

  // 如果有失败的文章，显示失败列表并询问是否重试
  if (failedArticles.length > 0) {
    logger.failedArticles(failedArticles);
    logger.retryPrompt(failedArticles.length);
    
    const shouldRetry = await askForRetry();
    if (shouldRetry) {
      // 重置统计信息
      stats.total = failedArticles.length;
      stats.published = 0;
      stats.skipped = 0;
      stats.failed = 0;

      logger.publishStart(failedArticles.length);
      completed = 0;

      // 重试失败的文章
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

      // 并发执行重试任务
      await Promise.all(retryTasks.map(task => controller.add(task)));

      logger.publishEnd(stats);
    }
  }
} 