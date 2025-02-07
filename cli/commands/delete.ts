import { load } from 'js-yaml';
import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import type { Settings, FrontMatter } from '../types';
import { getAuthToken } from '../utils/config';
import { logger } from '../utils/logger';
import { isMarkdownFile } from '../utils/files';

async function askForConfirmation(title: string, path: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  logger.deleteConfirm();
  logger.articleInfo('Title', title);
  logger.articleInfo('Path', path);
  logger.articleInfo('ID', 'will be permanently deleted');
  logger.deletePrompt();

  return new Promise(resolve => {
    rl.question('', answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}

export async function deleteArticle(filePath: string, settings: Settings) {
  // 验证文件是否存在且是 Markdown 文件
  const isMd = await isMarkdownFile(filePath);
  if (!isMd) {
    logger.error(`Invalid file: ${filePath} - must be a markdown file`);
    process.exit(1);
  }

  // 读取文件内容
  const content = await readFile(filePath, 'utf-8');
  const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  
  if (!frontMatterMatch) {
    logger.error('No frontmatter found in the file');
    process.exit(1);
  }

  let frontMatter: FrontMatter;
  try {
    frontMatter = load(frontMatterMatch[1]) as FrontMatter;
  } catch (e) {
    logger.error(`Error parsing frontmatter: ${e}`);
    process.exit(1);
  }

  // 检查必要的字段
  if (!frontMatter['privateplot-id']) {
    logger.error('No article ID found in frontmatter. The file might not have been published yet');
    process.exit(1);
  }

  if (frontMatter['privateplot-host'] !== settings.instanceHost) {
    logger.error('Article was published to a different host. Please use the correct host to delete it');
    process.exit(1);
  }

  // 获取认证信息
  const authToken = await getAuthToken(settings);
  if (!authToken) {
    logger.error('No auth token found. Please set it using `privateplot settings --token <token>` or INTERNAL_AUTH_TOKEN environment variable');
    process.exit(1);
  }

  if (!settings.instanceHost) {
    logger.error('No instance host configured. Please set it using `privateplot settings --host <host>` or PRIVATEPLOT_HOST environment variable');
    process.exit(1);
  }

  // 请求用户确认
  const confirmed = await askForConfirmation(
    frontMatter.title || 'Untitled',
    filePath
  );

  if (!confirmed) {
    logger.info('Delete operation cancelled');
    return;
  }

  // 执行删除操作
  const protocol = settings.instanceHost === 'localhost' || settings.instanceHost.startsWith('localhost:') ? 'http' : 'https';
  const baseUrl = `${protocol}://${settings.instanceHost}/api/internal/article`;

  try {
    logger.articleAction('Deleting', frontMatter.title || 'Untitled');

    const response = await fetch(`${baseUrl}?id=${frontMatter['privateplot-id']}`, {
      method: 'DELETE',
      headers: {
        'X-Internal-Auth-Token': authToken,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        logger.warning('Article not found on server. It might have been deleted already');
      } else {
        const error = await response.text();
        logger.error(`Failed to delete article: ${error}`);
        process.exit(1);
      }
    }

    logger.success('Article deleted successfully');
  } catch (error) {
    logger.error(`Error deleting article: ${error}`);
    process.exit(1);
  }
} 