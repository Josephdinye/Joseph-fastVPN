// admin/src/lib/nodes/feed.ts

function getFeedUrls(): string[] {
  const raw = process.env.DEFAULT_FEED_URLS?.trim();
  if (!raw) return [];

  // Support JSON array: ["url1", "url2"]
  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((u) => String(u).trim()).filter(Boolean);
      }
    } catch {
      // fall through
    }
  }

  // Support comma and newline separated
  return raw
    .split(/[\n,]+/)
    .map((u) => u.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);
}

export async function downloadNodeFeed(): Promise<string> {
  const feedUrls = getFeedUrls();
  
  if (!feedUrls.length) {
    throw new Error('DEFAULT_FEED_URLS is not configured in .env');
  }

  const parts: string[] = [];

  for (const url of feedUrls) {
    try {
      console.log(`[Nodes] Downloading ${url}`);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url, {
        headers: { 'User-Agent': 'Joseph-FastVPN-Backend' },
        cache: 'no-store',
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const text = await response.text();
      if (text.trim()) parts.push(text.trim());
    } catch (error) {
      console.error(`[Nodes] Feed failed: ${url}`, error);
    }
  }

  if (!parts.length) throw new Error('All node feeds failed');

  // Keep raw format, just de-duplicate
  const unique = [...new Set(parts.join('\n').split('\n').map(l => l.trim()).filter(Boolean))];

  return unique.join('\n');
}

export const fetchRawNodes = downloadNodeFeed;
export { getFeedUrls };