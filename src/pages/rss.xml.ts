import type { APIRoute } from 'astro';
import { RSSService } from '../services/RSSService';
import { useConstsWithRuntime } from '../consts';

export const GET: APIRoute = async ({ site, locals }) => {
  const env = useConstsWithRuntime(locals.runtime);
	const rssService = RSSService.getInstance({
    ...env,
    DB: locals.runtime.env.DB,
  });
	return await rssService.generateFeed(site!);
}
