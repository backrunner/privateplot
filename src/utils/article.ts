import { nanoid } from 'nanoid';

/**
 * Remove HTML tags from a string
 */
const stripHtml = (html: string): string => {
  return html.replace(/<[^>]*>/g, '');
};

/**
 * Remove frontmatter from markdown content
 * Frontmatter is the YAML metadata at the start of a markdown file
 * between --- delimiters
 */
const stripFrontmatter = (content: string): string => {
  return content.replace(/^---[\s\S]*?---/, '').trim();
};

/**
 * Remove markdown elements from text
 */
const stripMarkdown = (text: string): string => {
  return text
    // Remove headers
    .replace(/^#{1,6}\s+.+$/gm, '')
    // Remove links
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove inline code
    .replace(/`[^`]+`/g, '')
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, '')
    // Remove tables
    .replace(/^\|.+\|$/gm, '')
    .replace(/^[-|].+$/gm, '')
    // Remove bold and italic
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
    // Remove images
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
    // Remove blockquotes
    .replace(/^>\s+.+$/gm, '')
    // Remove horizontal rules
    .replace(/^[-*_]{3,}$/gm, '')
    // Remove list markers
    .replace(/^[\s-]*[-+*]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    // Clean up extra whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

/**
 * Extract summary from article content
 * @param content The article content
 * @param maxLength Maximum length of the summary (default: 300)
 * @returns The extracted summary
 */
export const extractSummary = (content: string, maxLength = 300): string => {
  // Remove frontmatter, markdown elements, and HTML tags
  const cleanContent = stripHtml(stripMarkdown(stripFrontmatter(content)));

  // Split into paragraphs and get the first non-empty one
  const paragraphs = cleanContent.split('\n\n');
  const firstParagraph = paragraphs.find(p => {
    const trimmed = p.trim();
    // For Chinese content, check character length instead of word count
    // Consider a paragraph meaningful if it has at least 10 characters
    return trimmed.length >= 10;
  }) || '';

  // Clean up the paragraph and limit length
  const summary = firstParagraph
    .replace(/\s+/g, ' ')
    .trim();

  if (summary.length <= maxLength) {
    return summary;
  }

  // Cut at the last complete word or character before maxLength
  const truncated = summary.slice(0, maxLength);
  // For Chinese text, we can often just cut directly, but we'll try to find a punctuation mark
  const lastPunctuation = Math.max(
    truncated.lastIndexOf('。'),
    truncated.lastIndexOf('！'),
    truncated.lastIndexOf('？'),
    truncated.lastIndexOf('，'),
    truncated.lastIndexOf('；'),
    truncated.lastIndexOf(' ')
  );

  // If we found a suitable punctuation, cut there, otherwise use the full truncated text
  return lastPunctuation > 0 ?
    truncated.slice(0, lastPunctuation + 1) + '...' :
    truncated + '...';
};

/**
 * Generate a URL-friendly slug from a title
 * Supports English, Chinese, Japanese, and other Unicode characters
 * If the title generates an empty slug, falls back to a random nanoid
 * @param title The title to convert to a slug
 * @returns The generated slug
 */
export const generateSlug = (title: string): string => {
  const slug = title
    // Convert to lowercase
    .toLowerCase()
    // Remove emojis and other special characters
    .replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '')
    // Replace spaces and other non-URL-friendly characters with hyphens
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '');

  // Generate a random ID if the slug is empty
  return slug || nanoid(10);
};
