// admin/src/lib/nodes/parser.ts
import type { VPNNode } from './cache';
import { fingerprintVless } from './fingerprint';

const FLAG_TO_COUNTRY: Record<string, string> = {
  '🇩🇪': 'Germany', '🇺🇸': 'United States', '🇸🇬': 'Singapore', '🇧🇬': 'Bulgaria',
  '🇯🇵': 'Japan', '🇳🇱': 'Netherlands', '🇬🇧': 'United Kingdom', '🇫🇷': 'France',
  '🇨🇦': 'Canada', '🇫🇮': 'Finland', '🇵🇱': 'Poland', '🇹🇷': 'Turkey',
  '🇷🇺': 'Russia', '🇭🇰': 'Hong Kong', '🇸🇪': 'Sweden', '🇮🇹': 'Italy',
  '🇪🇸': 'Spain', '🇨🇭': 'Switzerland', '🇦🇺': 'Australia', '🇮🇳': 'India',
  '🇧🇷': 'Brazil', '🇰🇷': 'South Korea', '🇦🇪': 'UAE', '🇮🇩': 'Indonesia',
  '🇻🇳': 'Vietnam', '🇺🇦': 'Ukraine', '🇮🇪': 'Ireland', '🇦🇹': 'Austria',
  '🇧🇪': 'Belgium', '🇳🇴': 'Norway', '🇩🇰': 'Denmark', '🇵🇹': 'Portugal',
  '🇨🇿': 'Czechia', '🇷🇴': 'Romania', '🇬🇷': 'Greece', '🇮🇱': 'Israel',
  '🇲🇾': 'Malaysia', '🇹🇭': 'Thailand', '🇵🇭': 'Philippines', '🇲🇽': 'Mexico',
  '🇹🇼': 'Taiwan', '🇨🇳': 'China',
};

const COUNTRY_KEYWORDS = [
  { keys: ['germany', 'frankfurt', 'berlin', 'munich'], iso: 'de' },
  { keys: ['usa', 'united states', 'america', 'new york', 'los angeles', 'miami'], iso: 'us' },
  { keys: ['singapore'], iso: 'sg' },
  { keys: ['bulgaria', 'sofia'], iso: 'bg' },
  { keys: ['japan', 'tokyo', 'osaka'], iso: 'jp' },
  { keys: ['netherlands', 'amsterdam'], iso: 'nl' },
  { keys: ['united kingdom', 'london', 'uk', 'britain'], iso: 'gb' },
  { keys: ['france', 'paris'], iso: 'fr' },
  { keys: ['canada', 'toronto', 'montreal'], iso: 'ca' },
  { keys: ['finland', 'helsinki'], iso: 'fi' },
  { keys: ['poland', 'warsaw'], iso: 'pl' },
  { keys: ['turkey', 'istanbul', 'turkiye'], iso: 'tr' },
  { keys: ['russia', 'moscow'], iso: 'ru' },
  { keys: ['hong kong'], iso: 'hk' },
  { keys: ['sweden', 'stockholm'], iso: 'se' },
  { keys: ['italy', 'milan', 'rome'], iso: 'it' },
  { keys: ['spain', 'madrid'], iso: 'es' },
  { keys: ['switzerland', 'zurich'], iso: 'ch' },
  { keys: ['australia', 'sydney'], iso: 'au' },
  { keys: ['india', 'mumbai', 'delhi'], iso: 'in' },
  { keys: ['brazil', 'sao paulo'], iso: 'br' },
  { keys: ['korea', 'seoul', 'south korea'], iso: 'kr' },
  { keys: ['uae', 'dubai'], iso: 'ae' },
  { keys: ['indonesia', 'jakarta'], iso: 'id' },
  { keys: ['vietnam', 'hanoi'], iso: 'vn' },
  { keys: ['ukraine', 'kyiv', 'kiev'], iso: 'ua' },
  { keys: ['ireland', 'dublin'], iso: 'ie' },
  { keys: ['austria', 'vienna'], iso: 'at' },
  { keys: ['belgium', 'brussels'], iso: 'be' },
  { keys: ['norway', 'oslo'], iso: 'no' },
  { keys: ['denmark', 'copenhagen'], iso: 'dk' },
  { keys: ['portugal', 'lisbon'], iso: 'pt' },
  { keys: ['czech', 'prague'], iso: 'cz' },
  { keys: ['romania', 'bucharest'], iso: 'ro' },
  { keys: ['greece', 'athens'], iso: 'gr' },
  { keys: ['israel', 'tel aviv'], iso: 'il' },
  { keys: ['malaysia', 'kuala lumpur'], iso: 'my' },
  { keys: ['thailand', 'bangkok'], iso: 'th' },
  { keys: ['philippines', 'manila'], iso: 'ph' },
  { keys: ['mexico'], iso: 'mx' },
  { keys: ['taiwan', 'taipei'], iso: 'tw' },
  { keys: ['china', 'beijing', 'shanghai'], iso: 'cn' },
];

function detectCountryInfo(nodeName: string) {
  const emojiRegex = /[\uD83C][\uDDE6-\uDDFF][\uD83C][\uDDE6-\uDDFF]/;
  const foundEmoji = nodeName.match(emojiRegex);
  if (foundEmoji) {
    const flag = foundEmoji[0];
    const iso = Array.from(flag)
      .map((c) => String.fromCharCode(c.codePointAt(0)! - 127397))
      .join('')
      .toLowerCase();
    return {
      name: FLAG_TO_COUNTRY[flag] || iso.toUpperCase(),
      flag,
      iso: iso.length === 2 ? iso : null,
    };
  }

  const lower = nodeName.toLowerCase();
  for (const entry of COUNTRY_KEYWORDS) {
    if (entry.keys.some((k) => lower.includes(k))) {
      const codePoints = entry.iso
        .toUpperCase()
        .split('')
        .map((c) => 127397 + c.charCodeAt(0));
      const flag = String.fromCodePoint(...codePoints);
      return {
        name: FLAG_TO_COUNTRY[flag] || entry.iso.toUpperCase(),
        flag,
        iso: entry.iso,
      };
    }
  }
  return { name: 'Global Relay', flag: '🌐', iso: null };
}

export function parseVlessNodes(text: string): VPNNode[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const nodes: VPNNode[] = [];
  const seen = new Set<string>();
  const countryCounts: Record<string, number> = {};

  for (const line of lines) {
    if (!line.startsWith('vless://')) continue;
    if (seen.has(line)) continue;
    seen.add(line);

    try {
      const labelParts = line.split('#');
      let rawLabel = 'Node';
      if (labelParts.length > 1) {
        rawLabel = decodeURIComponent(labelParts[1] || '').trim() || rawLabel;
      }

      const country = detectCountryInfo(rawLabel);
      countryCounts[country.name] = (countryCounts[country.name] || 0) + 1;
      const countIndex = countryCounts[country.name];

      const url = new URL(line);
      const host = url.hostname || '';
      const port = parseInt(url.port || '443', 10);
      const security = (url.searchParams.get('security') || 'none').toLowerCase();
      const transportSecurity =
        security === 'reality' || security === 'tls'
          ? security
          : security === 'none'
          ? 'none'
          : 'unknown';
      const pbk = url.searchParams.get('pbk') || '';
      const fp = fingerprintVless(line);

      nodes.push({
        id: fp,
        fingerprint: fp,
        protocol: 'vless',
        address: host,
        port: Number.isFinite(port) ? port : 443,
        name: country.name,
        flag: country.flag,
        iso: country.iso,
        subtitle: `${country.name} — #${countIndex}`,
        countIndex,
        isRussia: country.name === 'Russia',
        raw: line,
        transportSecurity,
        transport: (url.searchParams.get('type') || 'tcp').toLowerCase(),
        flow: url.searchParams.get('flow'),
        sni: url.searchParams.get('sni') || url.searchParams.get('host'),
        hasRealityKey: pbk.length > 10,
        allowInsecure: url.searchParams.get('allowInsecure') === '1',
        status: 'unknown',
        latency: null,
        speedMbps: null,
        score: 0,
        enabled: true,
        failReason: null,
        lastChecked: null,
        securityStatus: 'pending',
        securityScore: 0,
        securityReasons: [],
      });
    } catch {
      // skip
    }
  }

  return nodes;
}