/**
 * Maps country codes to locale codes for date formatting
 */
const countryToLocale: Record<string, string> = {
  'US': 'en-US',
  'GB': 'en-GB',
  'CA': 'en-CA',
  'AU': 'en-AU',
  'FR': 'fr-FR',
  'DE': 'de-DE',
  'JP': 'ja-JP',
  'CN': 'zh-CN',
  'TW': 'zh-TW',
  'HK': 'zh-HK',
  'KR': 'ko-KR',
  'ES': 'es-ES',
  'IT': 'it-IT',
  'BR': 'pt-BR',
  'PT': 'pt-PT',
  'RU': 'ru-RU',
  'NL': 'nl-NL',
  'SE': 'sv-SE',
  'NO': 'nb-NO',
  'DK': 'da-DK',
  'FI': 'fi-FI',
  'PL': 'pl-PL',
};

/**
 * Gets the locale string based on country code
 * Falls back to en-US if country is not supported
 */
export const getLocaleFromCountry = (country?: string): string => {
  if (!country) return 'en-US';

  const countryCode = country.toUpperCase();
  return countryToLocale[countryCode] || 'en-US';
};

/**
 * Cloudflare request.cf object type definition
 * Contains information about the request's geography and network
 */
export interface CloudflareCfObject {
  // Geography
  country?: string;
  region?: string;
  city?: string;
  postalCode?: string;
  timezone?: string;
  continent?: string;
  latitude?: string;
  longitude?: string;
  // Network
  asn?: number;
  asOrganization?: string;
  // Other properties
  [key: string]: any;
}

/**
 * Date formatting options type
 */
export interface DateFormatOptions {
  timezone?: string;
  country?: string;
}

/**
 * Extracts date formatting options from Cloudflare's CF object
 * @param cf The Cloudflare CF object from the request
 * @returns Date formatting options for use with formatDate
 */
export const getDateOptionsFromCf = (cf?: CloudflareCfObject): DateFormatOptions => {
  if (!cf) {
    return {};
  }

  return {
    timezone: cf.timezone,
    country: cf.country,
  };
};

/**
 * Formats a date based on timezone and country
 * @param date The date to format
 * @param options Optional formatting options
 * @param options.timezone The timezone string (e.g. 'America/New_York')
 * @param options.country The country code (e.g. 'US')
 * @returns Formatted date string
 */
export const formatDate = (
  date: Date,
  options?: DateFormatOptions
): string => {
  if (!date) {
    return '';
  }

  const locale = getLocaleFromCountry(options?.country);

  try {
    return date.toLocaleString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: options?.timezone || 'UTC',
    });
  } catch (error) {
    // Fallback in case of invalid timezone
    console.error('Date formatting error:', error);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
};

// Helper function to check if date is valid (not 1970-01-01)
export const isValidDate = (date: Date | undefined): boolean => {
  if (!date) return false;
  return date.getTime() > 86400000; // More than 1 day after 1970-01-01
};

// Helper function to check if dates are different
export const areDifferentDates = (date1: Date, date2?: Date): boolean => {
  if (!date1 || !date2) return false;
  return date1.getTime() !== date2.getTime();
};
