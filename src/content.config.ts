import { glob } from 'astro/loaders';
import { defineCollection, z } from 'astro:content';

const article = defineCollection({
	// Load Markdown and MDX files in the `src/content/blog/` directory.
	loader: glob({ base: './src/content/articles', pattern: '**/*.{md,mdx}' }),
	// Type-check frontmatter using a schema
	schema: z.object({
		title: z.string(),
		description: z.string(),
		createdDate: z.coerce.date(),
		updatedDate: z.coerce.date().optional(),
		slug: z.string().optional(),
	}),
});

export const collections = { article };
