import type { Settings } from '../types';
import { getAuthToken } from './config';
import { logger } from './logger';

/**
 * Ensures a URL has the correct protocol prefix
 * @param host - The host string
 * @returns URL with correct protocol
 */
export function getBaseUrl(host: string): string {
  // Remove any existing protocol
  let cleanHost = host.replace(/^(https?:\/\/)/, '');

  // Add appropriate protocol
  const protocol = cleanHost === 'localhost' || cleanHost.startsWith('localhost:') ? 'http' : 'https';
  return `${protocol}://${cleanHost}`;
}

/**
 * Options for API requests
 */
export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: Record<string, any>;
  path: string;
  queryParams?: Record<string, string>;
  requireAuth?: boolean;
}

/**
 * Makes an API request to the PrivatePlot instance
 * @param settings - Application settings
 * @param options - Request options
 * @returns Promise with the response
 */
export async function apiRequest<T = any>(
  settings: Settings,
  options: ApiRequestOptions
): Promise<{ success: boolean; data?: T; error?: string; status?: number }> {
  if (!settings.instanceHost) {
    return {
      success: false,
      error: 'No instance host configured. Please set it using `privateplot settings --host <host>` or PRIVATEPLOT_HOST environment variable'
    };
  }

  const baseUrl = getBaseUrl(settings.instanceHost);

  // Build URL with query parameters
  let url = `${baseUrl}${options.path}`;
  if (options.queryParams && Object.keys(options.queryParams).length > 0) {
    const params = new URLSearchParams();
    Object.entries(options.queryParams).forEach(([key, value]) => {
      params.append(key, value);
    });
    url += `?${params.toString()}`;
  }

  // Prepare headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add auth token if required
  if (options.requireAuth !== false) {
    const authToken = await getAuthToken(settings);
    if (!authToken) {
      return {
        success: false,
        error: 'No auth token found. Please set it using `privateplot settings --token <token>` or INTERNAL_AUTH_TOKEN environment variable'
      };
    }
    headers['X-Internal-Auth-Token'] = authToken;
  }

  // Prepare request options
  const requestOptions: RequestInit = {
    method: options.method || 'GET',
    headers,
  };

  // Add body if provided
  if (options.body && options.method !== 'GET') {
    requestOptions.body = JSON.stringify(options.body);
  }

  try {
    logger.info(`API Request: ${options.method || 'GET'} ${url}`);

    const response = await fetch(url, requestOptions);
    const status = response.status;

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`API Error (${status}): ${errorText}`);

      return {
        success: false,
        error: errorText,
        status
      };
    }

    // Parse JSON response if content exists
    let data: T | undefined;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const text = await response.text();
      if (text) {
        data = JSON.parse(text) as T;
      }
    }

    return {
      success: true,
      data,
      status
    };
  } catch (error) {
    logger.error(`Network error: ${String(error)}`);
    return {
      success: false,
      error: `Network error: ${String(error)}`
    };
  }
}
