// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import cloudflare from '@astrojs/cloudflare';
import preact from '@astrojs/preact';

import { SITE_URL } from './src/consts';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  site: SITE_URL,
  integrations: [sitemap(), preact()],
  adapter: cloudflare(),
  vite: process.env.ALLOWED_HOSTS ? {
    server: {
      allowedHosts: process.env.ALLOWED_HOSTS.split(','),
    },
  } : undefined,
});
