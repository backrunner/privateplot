import { defineMiddleware, sequence } from 'astro:middleware';
import { internalAuth } from './middleware/internalAuth';
import { cors } from './middleware/cors';

// Create a middleware sequence that runs cors first, then internalAuth
export const onRequest = defineMiddleware(sequence(cors, internalAuth));
