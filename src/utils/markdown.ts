import MarkdownIt from 'markdown-it';
import shikiPlugin from '@shikijs/markdown-it';
import { full as emoji } from 'markdown-it-emoji';
import katex from 'markdown-it-katex';
import githubAlerts from 'markdown-it-github-alerts';
import taskLists from 'markdown-it-task-lists';
import slugify from 'slugify';

// Regular expressions for detecting KaTeX syntax
const KATEX_INLINE_REGEX = /\$[^\s$].*?[^\s$]\$/;
const KATEX_BLOCK_REGEX = /\$\$[\s\S]*?\$\$/;

// Regular expression for finding the first image
const FIRST_IMAGE_REGEX = /!\[.*?\]\((.*?)\)/;
const HTML_IMAGE_REGEX = /<img.*?src=["'](.*?)["']/;

export class MarkdownRenderer {
  private static instance: MarkdownRenderer;
  private md: MarkdownIt;
  private initialized = false;

  private constructor() {
    this.md = MarkdownIt({
      html: true,
      linkify: true,
      typographer: true,
      breaks: true
    })
      .use(emoji)
      .use(katex)
      .use(githubAlerts)
      .use(taskLists, { enabled: true, label: true });

    // Custom heading rendering
    const originalHeadingOpen = this.md.renderer.rules.heading_open || ((tokens, idx, options, env, self) => {
      return self.renderToken(tokens, idx, options);
    });

    this.md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
      const token = tokens[idx];
      const nextToken = tokens[idx + 1];
      const headingContent = nextToken.content;
      const headingId = slugify(headingContent, { lower: true, strict: true });

      token.attrSet('id', headingId);
      token.attrSet('class', 'heading-with-anchor');

      return originalHeadingOpen(tokens, idx, options, env, self);
    };

    const originalHeadingClose = this.md.renderer.rules.heading_close || ((tokens, idx, options, env, self) => {
      return self.renderToken(tokens, idx, options);
    });

    this.md.renderer.rules.heading_close = (tokens, idx, options, env, self) => {
      const headingContent = tokens[idx - 1].content;
      const headingId = slugify(headingContent, { lower: true, strict: true });

      const anchorLink = `<a href="#${headingId}" class="heading-anchor" aria-label="Link to this section">
        <i class="icon-[solar--link-minimalistic-2-linear]"></i>
      </a>`;

      return anchorLink + originalHeadingClose(tokens, idx, options, env, self);
    };
  }

  public static getInstance(): MarkdownRenderer {
    if (!MarkdownRenderer.instance) {
      MarkdownRenderer.instance = new MarkdownRenderer();
    }
    return MarkdownRenderer.instance;
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return;

    this.md.use(await shikiPlugin({
      themes: {
        light: 'github-light',
        dark: 'github-dark'
      }
    }));

    this.initialized = true;
  }

  public hasKaTeX(content: string): boolean {
    return KATEX_INLINE_REGEX.test(content) || KATEX_BLOCK_REGEX.test(content);
  }

  public getFirstImage(content: string): string | null {
    // Try to find markdown image syntax first
    const markdownMatch = FIRST_IMAGE_REGEX.exec(content);
    if (markdownMatch && markdownMatch[1]) {
      return markdownMatch[1];
    }

    // If no markdown image found, try HTML image syntax
    const htmlMatch = HTML_IMAGE_REGEX.exec(content);
    if (htmlMatch && htmlMatch[1]) {
      return htmlMatch[1];
    }

    return null;
  }

  public render(content: string): string {
    if (!this.initialized) {
      throw new Error('MarkdownRenderer must be initialized before use');
    }
    return this.md.render(content);
  }
}
