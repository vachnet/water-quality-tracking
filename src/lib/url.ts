const base = import.meta.env.BASE_URL.replace(/\/$/, '');
export const url = (path = '/') => `${base}${path.startsWith('/') ? path : `/${path}`}`;
export const abs = (path: string, site: URL | undefined) => new URL(url(path), site ?? 'https://example.github.io').href;
