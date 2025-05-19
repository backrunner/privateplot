// @ts-check
import { defineConfig } from 'astro/config';
import dotenv from 'dotenv';
import postcssVhFix from 'postcss-100vh-fix';
import cloudflare from '@astrojs/cloudflare';
import preact from '@astrojs/preact';
import AstroPWA from '@vite-pwa/astro';

// Load environment variables
dotenv.config();

import { SITE_URL } from './src/consts';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  site: process.env.SITE_URL || SITE_URL,
  integrations: [
    preact(),
    AstroPWA({
      base: '/',
      scope: '/',
      includeAssets: ['avatar.png'],
      registerType: 'autoUpdate',
      manifest: {
        name: 'BackRunner\'s Plot',
        short_name: 'BackRunner\'s Plot',
        theme_color: '#191a1b',
      },
      pwaAssets: {
        config: true,
      },
      workbox: {
        navigateFallback: '/',
        globPatterns: ['**/*.{css,js,svg,png,ico,txt}'],
        globIgnores: ['_worker.js/**/*.js', '**/*.{html}'],
        navigateFallbackAllowlist: [/^\/$/],
        runtimeCaching: [{
          urlPattern: ({ url, sameOrigin, request }) => sameOrigin && request.mode === 'navigate' && !url.pathname.match(/^\/$/),
          handler: 'NetworkFirst',
          options: {
            cacheName: 'offline-ssr-pages-cache',
            cacheableResponse: {
              statuses: [200]
            },
            expiration: {
              maxEntries: 100,
            },
            plugins: [{
              cachedResponseWillBeUsed: async (params) => {
                // When handlerDidError is invoked, then we can prevent redirecting if there is an entry in the cache.
                // To check the behavior, navigate to a product page, then disable the network and refresh the page.
                params.state ??= {};
                params.state.dontRedirect = params.cachedResponse;
                console.log(`[SW] cachedResponseWillBeUsed ${params.request.url}, ${params.state ? JSON.stringify(params.state) : ''}`);
              },
              // This callback will be called when the fetch call fails.
              // Beware of the logic, will be also invoked if the server is down.
              handlerDidError: async ({ request, state, error }) => {
                if (state?.dontRedirect) {
                  return state.dontRedirect;
                }

                console.log(`[SW] handlerDidError ${request.url}, ${state ? JSON.stringify(state) : ''}`);
                return error && 'name' in error && error.name === 'no-response'
                  ? Response.redirect(
                      state?.dontRedirect?.url || '/',
                      404,
                    )
                  : undefined;
              }
            }],
          },
        }],
      },
      experimental: {
        directoryAndTrailingSlashHandler: true,
      },
    }),
  ],
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
