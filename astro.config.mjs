// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import cloudflare from '@astrojs/cloudflare';
import preact from '@astrojs/preact';
import postcssVhFix from 'postcss-100vh-fix';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { SITE_URL } from './src/consts';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  site: process.env.SITE_URL || SITE_URL,
  integrations: [sitemap(), preact()],
  adapter: cloudflare(),
  prefetch: true,
  vite: {
    ...(process.env.ALLOWED_HOSTS
      ? {
          server: {
            allowedHosts: process.env.ALLOWED_HOSTS.split(','),
          },
        }
      : undefined),
    css: {
      postcss: {
        plugins: [postcssVhFix()],
      },
    },
  },
});
