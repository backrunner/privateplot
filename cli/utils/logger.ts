import chalk from 'chalk';
import figures from 'figures';
import type { PublishStats, FailedArticle } from '../types';

const prefix = {
  info: chalk.blue(figures.info),
  success: chalk.green(figures.tick),
  warning: chalk.yellow(figures.warning),
  error: chalk.red(figures.cross),
  skipped: chalk.gray(figures.line),
  retry: chalk.yellow(figures.warning),
};

export const logger = {
  info: (message: string) => {
    console.log(`${prefix.info} ${chalk.blue(message)}`);
  },
  
  success: (message: string) => {
    console.log(`${prefix.success} ${chalk.green(message)}`);
  },
  
  warning: (message: string) => {
    console.log(`${prefix.warning} ${chalk.yellow(message)}`);
  },
  
  error: (message: string) => {
    console.error(`${prefix.error} ${chalk.red(message)}`);
  },
  
  settings: (key: string, value: string) => {
    console.log(`${chalk.dim('│')} ${chalk.cyan(key)}: ${value}`);
  },
  
  settingsHeader: () => {
    console.log(`${chalk.dim('┌')} ${chalk.bold('Current Settings')}`);
  },
  
  settingsFooter: () => {
    console.log(chalk.dim('└'));
  },
  
  articleAction: (action: string, title: string) => {
    console.log(`${prefix.info} ${chalk.blue(action)} ${chalk.dim('→')} ${chalk.bold(title)}`);
  },

  skipped: (title: string, reason: string) => {
    console.log(`${prefix.skipped} ${chalk.gray(title)} ${chalk.dim('(')}${chalk.gray(reason)}${chalk.dim(')')}`);
  },

  retry: (title: string, attempt: number) => {
    console.log(`${prefix.retry} ${chalk.yellow('Retrying')} ${chalk.bold(title)} ${chalk.dim(`(attempt ${attempt}/3)`)}`);
  },

  publishStart: (total: number) => {
    console.log('');
    console.log(`${prefix.info} ${chalk.blue('Starting to publish')} ${chalk.bold(total)} ${chalk.blue('articles')}`);
    console.log(chalk.dim('┌'));
  },

  publishEnd: (stats: PublishStats) => {
    console.log(chalk.dim('└'));
    console.log('');
    console.log(`${prefix.info} ${chalk.blue('Publish completed with:')}`);
    console.log(`${chalk.dim('│')} ${chalk.green(`${stats.published} published`)}`);
    console.log(`${chalk.dim('│')} ${chalk.gray(`${stats.skipped} skipped`)}`);
    console.log(`${chalk.dim('│')} ${chalk.red(`${stats.failed} failed`)}`);
    console.log(chalk.dim('└'));
  },

  progress: (current: number, total: number) => {
    const percentage = Math.round((current / total) * 100);
    const width = 30;
    const completed = Math.round((width * current) / total);
    const remaining = width - completed;
    
    const bar = chalk.blue('█').repeat(completed) + chalk.gray('░').repeat(remaining);
    process.stdout.write(`\r${chalk.dim('│')} ${bar} ${chalk.blue(percentage)}%`);
    
    if (current === total) {
      process.stdout.write('\n');
    }
  },

  failedArticles: (articles: FailedArticle[]) => {
    if (articles.length === 0) return;

    console.log('');
    console.log(`${prefix.error} ${chalk.red('Failed articles:')}`);
    console.log(chalk.dim('┌'));
    
    articles.forEach((article, index) => {
      if (index > 0) console.log(chalk.dim('├'));
      console.log(`${chalk.dim('│')} ${chalk.bold(article.title)}`);
      console.log(`${chalk.dim('│')} ${chalk.dim('Path:')} ${chalk.gray(article.path)}`);
      console.log(`${chalk.dim('│')} ${chalk.dim('Error:')} ${chalk.red(article.error)}`);
      console.log(`${chalk.dim('│')} ${chalk.dim('Retries:')} ${chalk.yellow(article.retries)}`);
    });
    
    console.log(chalk.dim('└'));
  },

  retryPrompt: (count: number) => {
    console.log('');
    console.log(`${prefix.warning} ${chalk.yellow(`Would you like to retry publishing ${count} failed articles? [y/N]`)}`);
  },
}; 