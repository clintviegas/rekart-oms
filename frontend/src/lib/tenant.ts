export function parseTenantSlug(host?: string): string | null {
  if (!host) return null;
  const hostname = host.split(':')[0].toLowerCase();
  if (hostname === 'localhost') return null;
  if (hostname.endsWith('.localhost')) {
    const parts = hostname.split('.');
    return parts.length >= 2 ? parts[0] : null;
  }
  const parts = hostname.split('.');
  if (parts.length >= 3) return parts[0];
  return null;
}

export function tenantApiHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const slug = parseTenantSlug(window.location.host);
  return slug ? { 'X-Tenant-Slug': slug } : {};
}
