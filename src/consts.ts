// Place any global data in this file.
// You can import this data from anywhere in your site by using the `import` keyword.

export const SITE_TITLE = 'BackRunner\'s Plot';
export const SITE_DESCRIPTION = 'Turn ideas into codes and bring them to reality';
export const SITE_KEYWORDS = 'BackRunner, Tech Blogs, Frontend Development';
export const SITE_URL = 'https://backrunner.blog';
export const ENABLE_COPYRIGHT = true;
export const ENABLE_POWERED_BY = true;
export const FRIEND_LINKS_TITLE = '友情链接';
export const FRIEND_LINKS_DESCRIPTION = '感谢这些朋友们，让我们在网络中相遇';
export const AVATAR_URL = 'https://images.backrunner.blog/avatar.png';

/**
 * Get constant value with potential runtime override
 * @param key The constant key
 * @param defaultValue The default value
 * @param env The environment variables object
 * @returns The value from environment variables or default value
 */
function getConstValue<T>(key: keyof Omit<Env, 'DB'>, defaultValue: T, env?: Env): T {
  if (!env) {
    return defaultValue;
  }

  const envValue = env[key];

  if (envValue === undefined) {
    return defaultValue;
  }

  // Type conversion based on default value type
  if (typeof defaultValue === 'string' && typeof envValue === 'string') {
    return (envValue.toLowerCase() === 'true') as unknown as T;
  } else if (typeof defaultValue === 'number' && typeof envValue === 'string') {
    return Number(envValue) as unknown as T;
  }

  return envValue as unknown as T;
}

/**
 * Interface for constants with runtime overrides
 */
export interface RuntimeConsts {
  SITE_TITLE: string;
  SITE_DESCRIPTION: string;
  SITE_KEYWORDS: string;
  SITE_URL: string;
  ENABLE_COPYRIGHT: boolean;
  ENABLE_POWERED_BY: boolean;
  FRIEND_LINKS_TITLE: string;
  FRIEND_LINKS_DESCRIPTION: string;
  AVATAR_URL: string;
}

/**
 * Get constants with potential runtime overrides from environment variables
 * Works with both Astro.locals.runtime and context.locals.runtime
 *
 * @param runtime The runtime object from either Astro.locals.runtime or context.locals.runtime
 * @returns Constants with potential runtime overrides
 */
export function useConstsWithRuntime(
  runtime: { env: Env } | undefined
): RuntimeConsts {
  const env = runtime?.env;

  return {
    SITE_TITLE: getConstValue('SITE_TITLE', SITE_TITLE, env),
    SITE_DESCRIPTION: getConstValue('SITE_DESCRIPTION', SITE_DESCRIPTION, env),
    SITE_KEYWORDS: getConstValue('SITE_KEYWORDS', SITE_KEYWORDS, env),
    SITE_URL: getConstValue('SITE_URL', SITE_URL, env),
    ENABLE_COPYRIGHT: getConstValue('ENABLE_COPYRIGHT', ENABLE_COPYRIGHT, env),
    ENABLE_POWERED_BY: getConstValue('ENABLE_POWERED_BY', ENABLE_POWERED_BY, env),
    FRIEND_LINKS_TITLE: getConstValue('FRIEND_LINKS_TITLE', FRIEND_LINKS_TITLE, env),
    FRIEND_LINKS_DESCRIPTION: getConstValue('FRIEND_LINKS_DESCRIPTION', FRIEND_LINKS_DESCRIPTION, env),
    AVATAR_URL: getConstValue('AVATAR_URL', AVATAR_URL, env),
  };
}
