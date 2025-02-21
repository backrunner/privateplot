import type { APIRoute } from 'astro';
import { RSSService } from '../services/RSSService';

export const GET: APIRoute = async ({ site, locals }) => {
	const rssService = RSSService.getInstance(locals.runtime.env.DB);
	return await rssService.generateFeed(site!);
}
