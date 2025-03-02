/**
 * Normalizes a host string by removing protocol and trailing slashes
 * @param host - The host string to normalize
 * @returns The normalized host string
 */
export function normalizeHost(host: string | undefined): string {
  if (!host) return '';
  return host.replace(/^(https?:\/\/)/, '').replace(/\/+$/, '');
}
