import { api, getToken } from '@/lib/php/client';
import { formatApiError, parseApiErrorBody } from '@/lib/php/api-errors';

const BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export interface GiphyGif {
  id: string;
  preview: string;
  url: string;
}

export const giphyApi = {
  search(q: string, offset = 0, lang = 'it'): Promise<{ gifs: GiphyGif[] }> {
    return api<{ gifs: GiphyGif[] }>(
      `/api/giphy.php?action=search&q=${encodeURIComponent(q)}&offset=${offset}&lang=${lang}`,
    );
  },
  trending(offset = 0): Promise<{ gifs: GiphyGif[] }> {
    return api<{ gifs: GiphyGif[] }>(`/api/giphy.php?action=trending&offset=${offset}`);
  },
};

export async function uploadCommentImage(file: File): Promise<{ url: string }> {
  const fd = new FormData();
  fd.append('file', file);
  const token = getToken();
  const res = await fetch(`${BASE}/api/upload.php`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const { code, vars } = parseApiErrorBody(await res.json());
      msg = formatApiError(code, vars);
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<{ url: string }>;
}
