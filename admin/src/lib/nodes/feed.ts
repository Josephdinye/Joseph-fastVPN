// admin/src/lib/nodes/feed.ts
function getFeedUrls(): string[] {
  const raw = process.env.DEFAULT_FEED_URLS?.trim();
  if (!raw) return [];

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

  return raw
    .split(',')
    .map((u) => u.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);
}

export async function downloadNodeFeed(): Promise<string> {
  const feedUrls = getFeedUrls();
  if (!feedUrls.length) {
    throw new Error('DEFAULT_FEED_URLS is not configured');
  }

  const parts: string[] = [];

  for (const url of feedUrls) {
    try {
      console.log(`[Nodes] Downloading ${url}`);
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Joseph-FastVPN-Backend' },
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      if (text.trim()) parts.push(text);
    } catch (error) {
      console.error(`[Nodes] Feed failed: ${url}`, error);
    }
  }

  if (!parts.length) throw new Error('All node feeds failed');
  return parts.join('\n');
}