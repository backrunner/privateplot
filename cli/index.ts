#!/usr/bin/env node

import { program } from 'commander';
import { publishArticle } from './commands/publish';
import { handleSettings } from './commands/settings';
import { loadSettings } from './utils/config';
import { logger } from './utils/logger';

program
  .name('privateplot')
  .description('CLI tool for PrivatePlot')
  .version('0.1.0');

program
  .command('publish')
  .description('Publish an article to PrivatePlot instance')
  .argument('[path]', 'markdown file or directory to publish', '.')
  .option('-c, --concurrency <number>', 'number of concurrent publish operations', '10')
  .action(async (path: string, options: { concurrency: string }) => {
    try {
      const settings = await loadSettings();
      const concurrency = parseInt(options.concurrency, 10);
      
      if (isNaN(concurrency) || concurrency < 1) {
        logger.error('Concurrency must be a positive number');
        process.exit(1);
      }

      await publishArticle(path, settings, { concurrency });
    } catch (error) {
      logger.error(`Error publishing article: ${error}`);
      process.exit(1);
    }
  });

program
  .command('settings')
  .description('Configure PrivatePlot settings')
  .option('--host <host>', 'Set instance hostname')
  .option('--token <token>', 'Set internal auth token')
  .action(handleSettings);

program.parse();
