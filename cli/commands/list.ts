import chalk from 'chalk';
import Table from 'cli-table3';

import { Settings } from '../types';
import { getAuthToken } from '../utils/config';
import { logger } from '../utils/logger';

export async function listArticles(settings: Settings) {
  const authToken = await getAuthToken(settings);
  if (!authToken) {
    logger.error('No auth token found. Please set it using `privateplot settings --token <token>` or INTERNAL_AUTH_TOKEN environment variable');
    process.exit(1);
  }

  if (!settings.instanceHost) {
    logger.error('No instance host configured. Please set it using `privateplot settings --host <host>` or PRIVATEPLOT_HOST environment variable');
    process.exit(1);
  }

  const protocol = settings.instanceHost === 'localhost' || settings.instanceHost.startsWith('localhost:') ? 'http' : 'https';
  const baseUrl = `${protocol}://${settings.instanceHost}/api/internal/articles`;

  try {
    logger.info('Fetching articles...');

    const response = await fetch(baseUrl, {
      headers: {
        'X-Internal-Auth-Token': authToken,
      }
    });

    if (!response.ok) {
      const error = await response.text();
      let errorMessage = `HTTP ${response.status}`;

      if (response.statusText) {
        errorMessage += ` (${response.statusText})`;
      }

      try {
        // Try to parse error as JSON for structured error messages
        const errorJson = JSON.parse(error);
        errorMessage += `: ${errorJson.message || errorJson.error || error}`;
      } catch {
        // If not JSON, use raw error text
        errorMessage += `: ${error}`;
      }

      logger.error(`Failed to fetch articles - ${errorMessage}`);
      process.exit(1);
    }

    const data = await response.json();
    const articles = data.articles;

    if (articles.length === 0) {
      logger.info('No articles found');
      return;
    }

    const table = new Table({
      head: [
        chalk.cyan('ID'),
        chalk.cyan('Title'),
        chalk.cyan('Created At'),
        chalk.cyan('Updated At'),
      ],
      colWidths: [36, 40, 25, 25],
      wordWrap: true,
    });

    articles.forEach((article: any) => {
      table.push([
        article.id || 'N/A',
        article.title,
        article.createdAt,
        article.updatedAt || 'N/A',
      ]);
    });

    console.log(table.toString());
    logger.info(`Total articles: ${data.total}`);
  } catch (error) {
    logger.error(`Error fetching articles: ${error}`);
    process.exit(1);
  }
}
