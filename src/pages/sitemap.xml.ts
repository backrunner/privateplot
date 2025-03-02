import type { APIRoute } from 'astro';
import { SitemapService } from '../services/SitemapService';

/**
 * Generates the sitemap.xml file for the site
 * This endpoint uses the SitemapService to generate a sitemap with both static pages and articles
 */
export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const siteUrl = new URL(request.url);
    const sitemapService = SitemapService.getInstance(locals.runtime.env);

    // Generate the sitemap using the SitemapService
    return await sitemapService.generateSitemap(siteUrl);
  } catch (error) {
    console.error('Error generating sitemap:', error);

    // Return a basic error response if something goes wrong
    return new Response('Error generating sitemap', {
      status: 500,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  }
};
