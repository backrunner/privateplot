import { load } from 'js-yaml';
import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import type { Settings, FrontMatter } from '../types';
import { getAuthToken } from '../utils/config';
import { logger } from '../utils/logger';
import { isMarkdownFile } from '../utils/files';
import { apiRequest } from '../utils/api';
import { normalizeHost } from '../utils/host';

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
  const isMd = await isMarkdownFile(filePath);
  if (!isMd) {
    logger.error(`Invalid file: ${filePath} - must be a markdown file`);
    process.exit(1);
  }

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

  if (!frontMatter['privateplot-id']) {
    logger.error('No article ID found in frontmatter. The file might not have been published yet');
    process.exit(1);
  }

  if (normalizeHost(frontMatter['privateplot-host']) !== normalizeHost(settings.instanceHost)) {
    logger.error('Article was published to a different host. Please use the correct host to delete it');
    process.exit(1);
  }

  const authToken = await getAuthToken(settings);
  if (!authToken) {
    logger.error('No auth token found. Please set it using `privateplot settings --token <token>` or INTERNAL_AUTH_TOKEN environment variable');
    process.exit(1);
  }

  if (!settings.instanceHost) {
    logger.error('No instance host configured. Please set it using `privateplot settings --host <host>` or PRIVATEPLOT_HOST environment variable');
    process.exit(1);
  }

  const confirmed = await askForConfirmation(
    frontMatter.title || 'Untitled',
    filePath
  );

  if (!confirmed) {
    logger.info('Delete operation cancelled');
    return;
  }

  try {
    logger.articleAction('Deleting', frontMatter.title || 'Untitled');

    const result = await apiRequest(settings, {
      method: 'DELETE',
      path: '/api/internal/article',
      queryParams: { id: frontMatter['privateplot-id'] }
    });

    if (!result.success) {
      if (result.status === 404) {
        logger.warning('Article not found on server. It might have been deleted already');
      } else {
        logger.error(`Failed to delete article: ${result.error}`);
        process.exit(1);
      }
    } else {
      logger.success('Article deleted successfully');
    }
  } catch (error) {
    logger.error(`Error deleting article: ${error}`);
    process.exit(1);
  }
}
