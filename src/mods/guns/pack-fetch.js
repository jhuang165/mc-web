// Pack metadata and models can arrive in a large burst. Share the atlas queue and retry transient
// network/host failures; optional or genuinely missing files return null without delaying startup.
import { requestAsset, retryAsset, retryUrl } from '../../asset-requests.js';
import { parseLenient } from './json5.js';

export async function fetchPackText(url, { fetch = globalThis.fetch, queue = requestAsset, retry = {} } = {}) {
  try {
    return await retryAsset(attempt => queue(async () => {
      const response = await fetch(retryUrl(url, attempt));
      if (response.status >= 500 || response.status === 429) throw new Error('Temporary pack download failure.');
      return response.ok ? response.text() : null;
    }), retry);
  } catch { return null; }
}
export async function fetchPackJson(url) {
  const text = await fetchPackText(url);
  try { return text == null ? null : parseLenient(text); } catch { return null; }
}
