#!/usr/bin/env node

import { program } from 'commander';
import { load, dump } from 'js-yaml';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

interface Settings {
  instanceHost?: string;
  internalAuthToken?: string;
}

interface FrontMatter {
  'privateplot-id'?: string;
  'privateplot-host'?: string;
  title?: string;
  summary?: string;
  slug?: string;
  [key: string]: any;
}

interface ArticleResponse {
  id: string;
  title: string;
  content: string;
  summary?: string;
  slug?: string;
}

const CONFIG_FILE = join(homedir(), '.privateplot.yaml');

async function loadSettings(): Promise<Settings> {
  try {
    const content = await readFile(CONFIG_FILE, 'utf-8');
    const fileSettings = load(content) as Settings;
    return {
      ...fileSettings,
      instanceHost: process.env.PRIVATEPLOT_HOST || fileSettings.instanceHost,
    };
  } catch {
    return {
      instanceHost: process.env.PRIVATEPLOT_HOST,
    };
  }
}

async function getAuthToken(settings: Settings): Promise<string> {
  return process.env.INTERNAL_AUTH_TOKEN || settings.internalAuthToken || '';
}

async function publishArticle(filePath: string, settings: Settings) {
  const content = await readFile(filePath, 'utf-8');
  const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  
  let frontMatter: FrontMatter = {};
  let markdownContent = content;
  let frontMatterIndent = '';
  
  if (frontMatterMatch) {
    try {
      frontMatter = load(frontMatterMatch[1]) as FrontMatter;
      markdownContent = content.slice(frontMatterMatch[0].length).trim();
      
      // Detect indentation in the original frontmatter
      const indentMatch = frontMatterMatch[1].match(/^( +)/m);
      if (indentMatch) {
        frontMatterIndent = indentMatch[1];
      }
    } catch (e) {
      console.error('Error parsing frontmatter:', e);
      process.exit(1);
    }
  }

  const authToken = await getAuthToken(settings);
  if (!authToken) {
    console.error('No auth token found. Please set it using `privateplot settings --token <token>` or INTERNAL_AUTH_TOKEN environment variable');
    process.exit(1);
  }

  if (!settings.instanceHost) {
    console.error('No instance host configured. Please set it using `privateplot settings --host <host>` or PRIVATEPLOT_HOST environment variable');
    process.exit(1);
  }

  const headers = {
    'Content-Type': 'application/json',
    'X-Internal-Auth-Token': authToken,
  };

  const protocol = settings.instanceHost === 'localhost' || settings.instanceHost.startsWith('localhost:') ? 'http' : 'https';
  const baseUrl = `${protocol}://${settings.instanceHost}/api/internal/article`;

  // Check if we need to update an existing article
  if (frontMatter['privateplot-id'] && frontMatter['privateplot-host'] === settings.instanceHost) {
    // Update existing article
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
      console.error('Failed to update article:', await response.text());
      process.exit(1);
    }

    console.log('Article updated successfully');
  } else {
    // Create new article
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
      console.error('Failed to publish article:', await response.text());
      process.exit(1);
    }

    const article = (await response.json()) as ArticleResponse;
    
    // Update only privateplot-related fields in frontmatter
    const updatedFrontMatter = {
      ...frontMatter,
      'privateplot-id': article.id,
      'privateplot-host': settings.instanceHost,
    };

    // Generate new content with updated frontmatter, preserving original formatting
    let yamlContent = dump(updatedFrontMatter);
    
    // Restore original indentation if it existed
    if (frontMatterIndent) {
      yamlContent = yamlContent.split('\n').map((line, index) => {
        // Don't indent the first line (which is empty) and the last line
        if (line && index < yamlContent.split('\n').length - 1) {
          return frontMatterIndent + line;
        }
        return line;
      }).join('\n');
    }

    // If there was no original frontmatter, add one
    if (!frontMatterMatch) {
      const updatedContent = `---\n${yamlContent}---\n\n${markdownContent}`;
      await writeFile(filePath, updatedContent);
    } else {
      // Replace only the frontmatter part
      const updatedContent = content.replace(/^---\n[\s\S]*?\n---/, `---\n${yamlContent}---`);
      await writeFile(filePath, updatedContent);
    }

    console.log('Article published successfully and local file updated with article ID');
  }
}

program
  .name('privateplot')
  .description('CLI tool for PrivatePlot')
  .version('0.1.0');

program
  .command('publish')
  .description('Publish an article to PrivatePlot instance')
  .argument('<file>', 'markdown file to publish')
  .action(async (file: string) => {
    try {
      const settings = await loadSettings();
      await publishArticle(file, settings);
    } catch (error) {
      console.error('Error publishing article:', error);
      process.exit(1);
    }
  });

program
  .command('settings')
  .description('Configure PrivatePlot settings')
  .option('--host <host>', 'Set instance hostname')
  .option('--token <token>', 'Set internal auth token')
  .action(async (options) => {
    try {
      const settings = await loadSettings();
      let updated = false;

      if (options.host) {
        settings.instanceHost = options.host;
        updated = true;
      }

      if (options.token) {
        settings.internalAuthToken = options.token;
        updated = true;
      }

      if (updated) {
        await writeFile(CONFIG_FILE, dump(settings));
        console.log('Settings updated successfully');
      } else {
        console.log('Current settings:');
        console.log(`Instance Host: ${settings.instanceHost || 'Not set'}`);
        console.log(`Auth Token: ${settings.internalAuthToken ? '********' : 'Not set'}`);
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      process.exit(1);
    }
  });

program.parse();
