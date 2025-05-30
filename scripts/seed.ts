import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import matter from 'gray-matter';
import { generateSlug, extractSummary } from '../src/utils/article.ts';

// Load environment variables
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARTICLES_DIR = path.join(__dirname, '../src/content/articles');
const API_URL = 'http://localhost:4321/api/internal/article';

if (!process.env.INTERNAL_AUTH_TOKEN) {
  console.error('INTERNAL_AUTH_TOKEN is not set in environment variables');
  process.exit(1);
}

async function getAllArticles() {
  const files = await fs.readdir(ARTICLES_DIR);
  const articles = await Promise.all(
    files
      .filter(file => file.endsWith('.md'))
      .map(async (file) => {
        const content = await fs.readFile(path.join(ARTICLES_DIR, file), 'utf-8');
        const { data: frontmatter, content: articleContent } = matter(content);
        const title = frontmatter.title;

        return {
          title,
          content: articleContent,
          slug: generateSlug(title),
          summary: frontmatter.summary || extractSummary(articleContent)
        };
      })
  );
  return articles;
}

async function seedDatabase() {
  try {
    const articles = await getAllArticles();

    for (const article of articles) {
      const response = await fetch(API_URL, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Auth-Token': process.env.INTERNAL_AUTH_TOKEN!
        } as HeadersInit,
        body: JSON.stringify(article),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error(`Failed to seed article ${article.title}:`, error);
        continue;
      }

      console.log(`Successfully seeded article: ${article.title}`);
    }

    console.log('Database seeding completed!');
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

// Run the seeding
seedDatabase();
