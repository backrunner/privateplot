// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import cloudflare from '@astrojs/cloudflare';
import preact from '@astrojs/preact';

import { SITE_URL } from './src/consts';

import db from '@astrojs/db';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  site: SITE_URL,
  integrations: [sitemap(), preact(), db()],
  adapter: cloudflare(),
});