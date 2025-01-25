import { defineMiddleware } from 'astro:middleware';
import { internalAuth } from './middleware/internalAuth';

export const onRequest = defineMiddleware(internalAuth);
