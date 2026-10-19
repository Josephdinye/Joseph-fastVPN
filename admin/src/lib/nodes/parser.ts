// admin/src/lib/nodes/parser.ts - FIXED - checks inside node string for country code
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
  { keys: ['germany', 'frankfurt', 'berlin', 'munich', '-de-', '_de', '|de|', '#de'], iso: 'de' },
  { keys: ['usa', 'united states', 'america', 'new york', 'los angeles', 'miami', '-us-', '_us', '|us|', '#us'], iso: 'us' },
  { keys: ['singapore', '-sg-', '_sg'], iso: 'sg' },
  { keys: ['bulgaria', 'sofia', '-bg-'], iso: 'bg' },
  { keys: ['japan', 'tokyo', 'osaka', '-jp-', '_jp'], iso: 'jp' },
  { keys: ['netherlands', 'amsterdam', '-nl-', '_nl'], iso: 'nl' },
  { keys: ['united kingdom', 'london', 'uk', 'britain', '-gb-', '_gb', '-uk-'], iso: 'gb' },
  { keys: ['france', 'paris', '-fr-', '_fr'], iso: 'fr' },
  { keys: ['canada', 'toronto', '-ca-', '_ca'], iso: 'ca' },
  { keys: ['finland', 'helsinki', '-fi-'], iso: 'fi' },
  { keys: ['poland', 'warsaw', '-pl-', '_pl'], iso: 'pl' },
  { keys: ['turkey', 'istanbul', 'turkiye', '-tr-'], iso: 'tr' },
  { keys: ['russia', 'moscow', '-ru-', '_ru'], iso: 'ru' },
  { keys: ['hong kong', '-hk-'], iso: 'hk' },
  { keys: ['sweden', 'stockholm', '-se-'], iso: 'se' },
  { keys: ['italy', 'milan', 'rome', '-it-'], iso: 'it' },
  { keys: ['spain', 'madrid', '-es-'], iso: 'es' },
  { keys: ['switzerland', 'zurich', '-ch-'], iso: 'ch' },
  { keys: ['australia', 'sydney', '-au-', '_au'], iso: 'au' },
  { keys: ['india', 'mumbai', 'delhi', '-in-'], iso: 'in' },
  { keys: ['brazil', 'sao paulo', '-br-'], iso: 'br' },
  { keys: ['korea', 'seoul', 'south korea', '-kr-'], iso: 'kr' },
  { keys: ['uae', 'dubai', '-ae-'], iso: 'ae' },
  { keys: ['indonesia', 'jakarta', '-id-'], iso: 'id' },
  { keys: ['vietnam', 'hanoi', '-vn-'], iso: 'vn' },
  { keys: ['ukraine', 'kyiv', 'kiev', '-ua-'], iso: 'ua' },
  { keys: ['ireland', 'dublin', '-ie-'], iso: 'ie' },
  { keys: ['austria', 'vienna', '-at-'], iso: 'at' },
  { keys: ['belgium', 'brussels', '-be-'], iso: 'be' },
  { keys: ['norway', 'oslo', '-no-'], iso: 'no' },
  { keys: ['denmark', 'copenhagen', '-dk-'], iso: 'dk' },
  { keys: ['portugal', 'lisbon', '-pt-'], iso: 'pt' },
  { keys: ['czech', 'prague', '-cz-'], iso: 'cz' },
  { keys: ['romania', 'bucharest', '-ro-'], iso: 'ro' },
  { keys: ['greece', 'athens', '-gr-'], iso: 'gr' },
  { keys: ['israel', 'tel aviv', '-il-'], iso: 'il' },
  { keys: ['malaysia', 'kuala lumpur', '-my-'], iso: 'my' },
  { keys: ['thailand', 'bangkok', '-th-'], iso: 'th' },
  { keys: ['philippines', 'manila', '-ph-'], iso: 'ph' },
  { keys: ['mexico', '-mx-'], iso: 'mx' },
  { keys: ['taiwan', 'taipei', '-tw-'], iso: 'tw' },
  { keys: ['china', 'beijing', 'shanghai', '-cn-'], iso: 'cn' },
];

function detectCountryInfo(nodeName: string, fullRawLine: string) {
  // Check emoji first
  const emojiRegex = /[\uD83C][\uDDE6-\uDDFF][\uD83C][\uDDE6-\uDDFF]/;
  const foundEmoji = nodeName.match(emojiRegex) || fullRawLine.match(emojiRegex);
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

  // FIX: check BOTH label AND full vless:// line for country shortcuts
  const combined = `${nodeName} ${fullRawLine}`.toLowerCase();
  for (const entry of COUNTRY_KEYWORDS) {
    if (entry.keys.some((k) => combined.includes(k))) {
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
  
  // Last chance: look for standalone 2-letter codes like US, DE, JP inside the line
  const isoMatch = fullRawLine.match(/[^a-z](US|DE|SG|JP|NL|GB|FR|CA|FI|PL|TR|RU|HK|SE|IT|ES|CH|AU|IN|BR|KR|AE|ID|VN|UA|IE|AT|BE|NO|DK|PT|CZ|RO|GR|IL|MY|TH|PH|MX|TW|CN)[^a-z]/i);
  if (isoMatch) {
    const iso = isoMatch[1].toLowerCase();
    const flag = String.fromCodePoint(...iso.toUpperCase().split('').map(c => 127397 + c.charCodeAt(0)));
    return {
      name: FLAG_TO_COUNTRY[flag] || iso.toUpperCase(),
      flag,
      iso,
    };
  }

  return { name: 'Global Relay', flag: '🌐', iso: null };
}

export function parseVlessNodes(text: string): VPNNode[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const nodes: VPNNode[] = [];
  const seenFingerprints = new Set<string>();
  const countryCounts: Record<string, number> = {};

  for (const line of lines) {
    if (!line.startsWith('vless://')) continue;
    
    const fp = fingerprintVless(line);
    if (seenFingerprints.has(fp)) continue;
    seenFingerprints.add(fp);

    try {
      const labelParts = line.split('#');
      let rawLabel = 'Node';
      if (labelParts.length > 1) {
        rawLabel = decodeURIComponent(labelParts[1] || '').trim() || rawLabel;
      }

      const country = detectCountryInfo(rawLabel, line);
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
    } catch {}
  }

  return nodes;
}

export const parseNodesFromRaw = parseVlessNodes;
export const parseNodes = parseVlessNodes;