import MarkdownIt from 'markdown-it';
import shikiPlugin from '@shikijs/markdown-it';

export class MarkdownRenderer {
  private static instance: MarkdownRenderer;
  private md: MarkdownIt;
  private initialized = false;

  private constructor() {
    this.md = MarkdownIt({
      html: true,
      linkify: true,
      typographer: true
    });
  }

  public static getInstance(): MarkdownRenderer {
    if (!MarkdownRenderer.instance) {
      MarkdownRenderer.instance = new MarkdownRenderer();
    }
    return MarkdownRenderer.instance;
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.md.use(await shikiPlugin({
      themes: {
        light: 'github-light',
        dark: 'github-dark'
      }
    }));

    this.initialized = true;
  }

  public render(content: string): string {
    if (!this.initialized) {
      throw new Error('MarkdownRenderer must be initialized before use');
    }
    return this.md.render(content);
  }
} 