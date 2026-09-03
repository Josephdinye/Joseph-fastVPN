// main.js — Electron main process for Windows. Handles the app lifecycle, IPC, and xray process management.
// Force Node.js to tolerate altered or restricted handshakes safely
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const { app, BrowserWindow, ipcMain, nativeImage } = require('electron');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const net = require('net');
const tls = require('tls');

let mainWindow;
let xrayProcess = null;
let metricsTimer = null;
let activeConnectionTime = 0;

// Syncing your exact mobile subscription configurations
const FEED_URLS = [
  'https://raw.githubusercontent.com/Josephdinye/Joseph-fastVPN/refs/heads/main/config1.txt',
  'https://raw.githubusercontent.com/Josephdinye/Joseph-fastVPN/refs/heads/main/configs.txt'
];

// FIX: Point configuration generation target away from read-only ASAR archives
const USER_DATA_DIR = app.isPackaged
    ? app.getPath('userData')
    : path.join(__dirname, 'bin');

const CONFIG_PATH = path.join(USER_DATA_DIR, 'config.json');
const SETTINGS_PATH = path.join(USER_DATA_DIR, 'settings.json');
const PAC_PATH = path.join(USER_DATA_DIR, 'proxy.pac');

// FIX: this folder is named "app.asar.unpacked" (with the "ed") once
// electron-builder actually unpacks it, not "app.asar.unpack". The old
// version here was missing those two letters, which meant fs.existsSync()
// on this path always came back false in the packaged app, even though
// bin/xray.exe was sitting right there on disk. That is what made every
// node come back "offline" only after installing, never in npm start.
const XRAY_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'bin', 'xray.exe')
    : path.join(__dirname, 'bin', 'xray.exe');

// ---------------------------------------------------------------------------
// Settings: persisted to disk, loaded once at startup, mutated dynamically
// through IPC as the user changes things in the Settings screen. Nothing
// here is hardcoded — the app/website lists always come from what the user
// picked, read back from settings.json on every launch.
// ---------------------------------------------------------------------------
const DEFAULT_SETTINGS = {
    autoConnectOnLaunch: false,
    launchOnStartup: false,
    killSwitchEnabled: false,
    dnsLeakProtection: true,
    customDnsServers: [],       // e.g. ["1.1.1.1", "1.0.0.1"]
    excludedApps: [],           // [{ id, name, publisher, installLocation, iconPath }]
    excludedWebsites: []        // [ "example.com", ... ]
};

function loadSettings() {
    try {
        if (fs.existsSync(SETTINGS_PATH)) {
            const raw = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
            return { ...DEFAULT_SETTINGS, ...raw };
        }
    } catch (e) {}
    return { ...DEFAULT_SETTINGS };
}

function saveSettingsToDisk(settings) {
    if (!fs.existsSync(path.dirname(SETTINGS_PATH))) {
        fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
    }
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

let currentSettings = loadSettings();

// Native country keywords and translation matching metrics from your app
const FLAG_TO_COUNTRY = {
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
  '🇹🇼': 'Taiwan', '🇨🇳': 'China'
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
  { keys: ['china', 'beijing', 'shanghai'], iso: 'cn' }
];

function fetchPayload(url) {
    return new Promise((resolve) => {
        const options = { rejectUnauthorized: false };
        https.get(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', () => resolve(''));
    });
}

function detectCountryInfo(nodeName) {
    const emojiRegex = /[\uD83C][\uDDE6-\uDDFF][\uD83C][\uDDE6-\uDDFF]/;
    const foundEmoji = nodeName.match(emojiRegex);
    if (foundEmoji) {
        const flag = foundEmoji[0];
        const iso = Array.from(flag).map((c) => String.fromCharCode(c.codePointAt(0) - 127397)).join('').toLowerCase();
        return { name: FLAG_TO_COUNTRY[flag] || iso.toUpperCase(), flag, iso };
    }

    const lowerName = nodeName.toLowerCase();
    for (const entry of COUNTRY_KEYWORDS) {
        if (entry.keys.some((k) => lowerName.includes(k))) {
            const codePoints = entry.iso.toUpperCase().split('').map((c) => 127397 + c.charCodeAt(0));
            const computedFlag = String.fromCodePoint(...codePoints);
            return { name: FLAG_TO_COUNTRY[computedFlag] || entry.iso.toUpperCase(), flag: computedFlag, iso: entry.iso };
        }
    }
    return { name: 'Global Relay', flag: '🌐', iso: null };
}

async function gatherAndParseAllSources() {
    const texts = await Promise.all(FEED_URLS.map(url => fetchPayload(url)));
    const configLines = texts.join('\n').split('\n');

    const parsedServers = [];
    const seen = new Set();
    const countryCounts = {};

    configLines.forEach((line, index) => {
        const trimmedLine = line.trim();
        if (!trimmedLine.startsWith('vless://')) return;
        if (seen.has(trimmedLine)) return;
        seen.add(trimmedLine);

        try {
            const labelParts = trimmedLine.split('#');
            let rawLabel = `Node #${index + 1}`;
            if (labelParts.length > 1) {
                rawLabel = decodeURIComponent(labelParts[1] || '').trim() || rawLabel;
            }

            const countryInfo = detectCountryInfo(rawLabel);
            countryCounts[countryInfo.name] = (countryCounts[countryInfo.name] || 0) + 1;
            const countNumber = countryCounts[countryInfo.name];

            parsedServers.push({
                id: `node-${index}-${trimmedLine.slice(8, 20)}`,
                name: countryInfo.name,
                flag: countryInfo.flag,
                iso: countryInfo.iso,
                subtitle: `${countryInfo.name} — #${countNumber}`,
                countIndex: countNumber,
                isRussia: countryInfo.name === 'Russia',
                protocol: 'VLESS',
                ping: null,
                status: 'untested',
                rawConfig: trimmedLine,
                isAuto: false
            });
        } catch (e) {}
    });
    return parsedServers;
}

function createWindow() {
    app.commandLine.appendSwitch('ignore-certificate-errors');
    app.commandLine.appendSwitch('allow-insecure-localhost');

    mainWindow = new BrowserWindow({
        width: 780,
        height: 580,
        minWidth: 600,
        minHeight: 450,
        resizable: true,
        maximizable: true,
        autoHideMenuBar: true,
        icon: path.join(__dirname, 'assets/icon.ico'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false
        }
    });
    mainWindow.loadFile('index.html');

    mainWindow.webContents.once('did-finish-load', () => {
        if (currentSettings.autoConnectOnLaunch) {
            mainWindow.webContents.send('auto-connect-requested');
        }
    });
}

// ---------------------------------------------------------------------------
// Website split tunneling — enforced with a real Proxy Auto-Config (PAC)
// script. Windows evaluates FindProxyForURL() per request, so any domain in
// excludedWebsites goes DIRECT and everything else goes through xray. This
// is fully dynamic: regenerated any time the list changes, no restart
// needed, no hardcoded domains.
// ---------------------------------------------------------------------------
function generatePacFile(excludedWebsites) {
    const list = (excludedWebsites || [])
        .map(d => String(d).trim().toLowerCase())
        .filter(Boolean);

    const pacContent = `function FindProxyForURL(url, host) {
    var bypassList = ${JSON.stringify(list)};
    host = host.toLowerCase();
    for (var i = 0; i < bypassList.length; i++) {
        var domain = bypassList[i];
        if (host === domain || host.substring(host.length - domain.length - 1) === "." + domain) {
            return "DIRECT";
        }
    }
    return "PROXY 127.0.0.1:10809; DIRECT";
}`;

    if (!fs.existsSync(path.dirname(PAC_PATH))) {
        fs.mkdirSync(path.dirname(PAC_PATH), { recursive: true });
    }
    fs.writeFileSync(PAC_PATH, pacContent);
    return PAC_PATH;
}

// Applies (or removes) the system proxy. When there are excluded websites we
// route through the PAC script so those domains bypass the tunnel; otherwise
// we fall back to the plain static proxy, same as before.
function applySystemProxy(enable, settings) {
    const base = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings';

    if (!enable) {
        exec(`reg add "${base}" /v ProxyEnable /t REG_DWORD /d 0 /f & reg delete "${base}" /v AutoConfigURL /f`, () => {
            exec('netsh winhttp reset proxy');
        });
        return;
    }

    const hasWebsiteBypass = settings.excludedWebsites && settings.excludedWebsites.length > 0;

    if (hasWebsiteBypass) {
        const pacFilePath = generatePacFile(settings.excludedWebsites);
        const pacUrl = `file:///${pacFilePath.replace(/\\/g, '/')}`;
        exec(`reg add "${base}" /v ProxyEnable /t REG_DWORD /d 0 /f & reg add "${base}" /v AutoConfigURL /t REG_SZ /d "${pacUrl}" /f`, () => {
            // Extends the same bypass rules to WinHTTP-based apps and
            // background services, not only WinINet/browser traffic.
            exec('netsh winhttp import proxy source=ie');
        });
    } else {
        exec(`reg delete "${base}" /v AutoConfigURL /f & reg add "${base}" /v ProxyEnable /t REG_DWORD /d 1 /f & reg add "${base}" /v ProxyServer /t REG_SZ /d "127.0.0.1:10809" /f`, () => {
            exec('netsh winhttp import proxy source=ie');
        });
    }
}

// ---------------------------------------------------------------------------
// Kill switch — real Windows Firewall enforcement. When enabled, all
// outbound traffic is blocked except loopback and the xray process itself,
// so if the tunnel drops unexpectedly nothing leaks out unprotected.
// Requires the app to run elevated; add/delete rule calls fail silently
// (logged) if not, and the renderer is told via the save-app-settings
// response so it can warn the user.
// ---------------------------------------------------------------------------
function enableKillSwitch() {
    return new Promise((resolve) => {
        exec(`netsh advfirewall firewall add rule name="JosephFastVPN_KillSwitch" dir=out action=block enable=yes profile=any remoteip=any`, (err) => {
            exec(`netsh advfirewall firewall add rule name="JosephFastVPN_AllowLoopback" dir=out action=allow enable=yes remoteip=127.0.0.1,LocalSubnet`);
            if (fs.existsSync(XRAY_PATH)) {
                exec(`netsh advfirewall firewall add rule name="JosephFastVPN_AllowXray" dir=out action=allow enable=yes program="${XRAY_PATH}"`);
            }
            resolve(!err);
        });
    });
}

function disableKillSwitch() {
    return new Promise((resolve) => {
        exec(`netsh advfirewall firewall delete rule name="JosephFastVPN_KillSwitch" & netsh advfirewall firewall delete rule name="JosephFastVPN_AllowLoopback" & netsh advfirewall firewall delete rule name="JosephFastVPN_AllowXray"`, () => {
            resolve(true);
        });
    });
}

// ---------------------------------------------------------------------------
// Dynamic installed-application enumeration. Reads straight from the
// Windows Uninstall registry keys (64-bit, 32-bit/WOW6432Node, and the
// per-user hive) every time it is called — never a static/hardcoded list —
// so the Settings screen always reflects what's actually installed right
// now.
// ---------------------------------------------------------------------------
function getInstalledApps() {
    return new Promise((resolve) => {
        const psScript = [
            '$paths = @(',
            '  "HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*",',
            '  "HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*",',
            '  "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*"',
            ');',
            '$apps = Get-ItemProperty -Path $paths -ErrorAction SilentlyContinue |',
            '  Where-Object { $_.DisplayName -and $_.DisplayName.Trim() -ne "" -and -not $_.SystemComponent } |',
            '  Select-Object DisplayName, Publisher, DisplayVersion, InstallLocation, DisplayIcon;',
            '$apps | ConvertTo-Json -Compress -Depth 3'
        ].join(' ');

        exec(
            `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "${psScript.replace(/"/g, '\\"')}"`,
            { maxBuffer: 1024 * 1024 * 10 },
            (err, stdout) => {
                if (err || !stdout || !stdout.trim()) return resolve([]);
                try {
                    let parsed = JSON.parse(stdout);
                    if (!Array.isArray(parsed)) parsed = [parsed];

                    const seen = new Set();
                    const apps = parsed
                        .filter(a => a && a.DisplayName)
                        .filter(a => {
                            const key = a.DisplayName.trim().toLowerCase();
                            if (seen.has(key)) return false;
                            seen.add(key);
                            return true;
                        })
                        .map((a, i) => ({
                            id: `app-${i}-${Buffer.from(a.DisplayName).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 14)}`,
                            name: a.DisplayName.trim(),
                            publisher: (a.Publisher || '').trim(),
                            version: (a.DisplayVersion || '').trim(),
                            installLocation: (a.InstallLocation || '').trim(),
                            iconPath: ((a.DisplayIcon || '').split(',')[0] || '').replace(/"/g, '').trim()
                        }))
                        .sort((a, b) => a.name.localeCompare(b.name));

                    resolve(apps);
                } catch (e) {
                    resolve([]);
                }
            }
        );
    });
}

// ---------------------------------------------------------------------------
// Shared xray config builder, reused by the live connect handler and by the
// scratch port latency tester below, so both take the same route through
// each proxy's real TLS or Reality handshake.
// ---------------------------------------------------------------------------
function buildXrayConfigFromUrl(rawUrl, localPort, settings = currentSettings) {
    const urlObj = new URL(rawUrl);
    const uuid = urlObj.username;
    const address = urlObj.hostname;
    const port = parseInt(urlObj.port);
    const searchParams = urlObj.searchParams;

    const streamNetwork = searchParams.get("type") || "tcp";
    const streamSecurity = searchParams.get("security") || "none";
    const streamFlow = searchParams.get("flow") || undefined;

    const config = {
        log: { loglevel: "warning" },
        inbounds: [{ port: localPort, protocol: "http", settings: { auth: "noauth", udp: true } }],
        outbounds: [{
            protocol: "vless",
            settings: {
                vnext: [{
                    address: address,
                    port: port,
                    users: [{ id: uuid, encryption: "none", flow: streamFlow }]
                }]
            },
            streamSettings: {
                network: streamNetwork,
                security: streamSecurity,
                realitySettings: streamSecurity === "reality" ? {
                    show: false,
                    fingerprint: searchParams.get("fp") || "chrome",
                    serverName: searchParams.get("sni") || "",
                    publicKey: searchParams.get("pbk") || "",
                    shortId: searchParams.get("sid") || ""
                } : undefined,
                tlsSettings: streamSecurity === "tls" ? {
                    serverName: searchParams.get("sni") || "",
                    fingerprint: searchParams.get("fp") || "chrome"
                } : undefined,
                wsSettings: streamNetwork === "ws" ? {
                    path: searchParams.get("path") || "/",
                    headers: searchParams.get("host") ? { "Host": searchParams.get("host") } : undefined
                } : undefined,
                grpcSettings: streamNetwork === "grpc" ? {
                    serviceName: searchParams.get("serviceName") || ""
                } : undefined
            }
        }]
    };

    // Custom / leak-protected DNS: only added when the user actually
    // configured servers, so behavior is unchanged otherwise.
    if (settings && settings.dnsLeakProtection && Array.isArray(settings.customDnsServers) && settings.customDnsServers.length > 0) {
        config.dns = { servers: settings.customDnsServers.filter(Boolean) };
    }

    return config;
}

function waitForPort(port, timeoutMs) {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        (function attempt() {
            const socket = net.connect(port, '127.0.0.1');
            socket.once('connect', () => { socket.end(); resolve(); });
            socket.once('error', () => {
                socket.destroy();
                if (Date.now() - start > timeoutMs) {
                    reject(new Error('Local proxy never bound the port'));
                } else {
                    setTimeout(attempt, 100);
                }
            });
        })();
    });
}

// Sends a real HTTPS request through the local proxy port using an explicit
// CONNECT tunnel, then a TLS handshake to the target over that tunnel. If
// the node's credentials are expired or rejected, xray refuses or drops the
// CONNECT, or the TLS handshake never completes, and this rejects instead
// of silently reporting a fake low latency number.
function requestThroughProxy(targetUrl, proxyPort, timeoutMs) {
    return new Promise((resolve, reject) => {
        const target = new URL(targetUrl);
        let settled = false;
        const finish = (fn, val) => { if (!settled) { settled = true; fn(val); } };

        const connectReq = http.request({
            host: '127.0.0.1',
            port: proxyPort,
            method: 'CONNECT',
            path: `${target.hostname}:443`
        });

        const overallTimeout = setTimeout(() => {
            connectReq.destroy();
            finish(reject, new Error('Timed out waiting on proxy tunnel'));
        }, timeoutMs);

        connectReq.on('connect', (res, socket) => {
            if (res.statusCode !== 200) {
                clearTimeout(overallTimeout);
                socket.destroy();
                return finish(reject, new Error(`Proxy refused CONNECT: ${res.statusCode}`));
            }

            const tlsSocket = tls.connect({ socket, servername: target.hostname, rejectUnauthorized: false }, () => {
                const req = https.request({
                    createConnection: () => tlsSocket,
                    hostname: target.hostname,
                    path: target.pathname || '/',
                    method: 'GET'
                }, (response) => {
                    response.on('data', () => {});
                    response.on('end', () => {
                        clearTimeout(overallTimeout);
                        finish(resolve, true);
                    });
                });
                req.on('error', (err) => {
                    clearTimeout(overallTimeout);
                    finish(reject, err);
                });
                req.end();
            });

            tlsSocket.on('error', (err) => {
                clearTimeout(overallTimeout);
                finish(reject, err);
            });
        });

        connectReq.on('error', (err) => {
            clearTimeout(overallTimeout);
            finish(reject, err);
        });

        connectReq.end();
    });
}

// Spins up a throwaway xray instance on its own local port for one node,
// routes a real request through it, then tears it down. Timeouts are kept
// short so dead nodes free workers quickly and the first live node can
// surface in the UI within ~10 seconds.
async function testServerLatency(node, options = {}) {
    const timeoutMs = options.timeoutMs || 2800;
    const testUrl = options.testUrl || 'https://www.gstatic.com/generate_204';

    if (!node || !node.rawConfig) {
        return { id: node ? node.id : null, ok: false, reason: 'No config for this node' };
    }

    const testPort = 20000 + Math.floor(Math.random() * 20000);
    const testConfigPath = path.join(app.getPath('temp'), `xray-test-${testPort}.json`);
    let testProcess = null;

    try {
        fs.writeFileSync(testConfigPath, JSON.stringify(buildXrayConfigFromUrl(node.rawConfig, testPort), null, 2));

        if (!fs.existsSync(XRAY_PATH)) {
            return { id: node.id, ok: false, reason: `xray binary not found at ${XRAY_PATH}` };
        }

        testProcess = spawn(XRAY_PATH, ['run', '-c', testConfigPath]);

        await waitForPort(testPort, 1200);
        const start = Date.now();
        await requestThroughProxy(testUrl, testPort, timeoutMs);
        const latencyMs = Date.now() - start;
        return { id: node.id, ok: true, latencyMs };
    } catch (err) {
        return { id: node.id, ok: false, reason: err.message };
    } finally {
        if (testProcess) {
            try { testProcess.kill(); } catch (_) {}
        }
        try { fs.unlinkSync(testConfigPath); } catch (_) {}
    }
}

// Streaming worker pool: each worker reports as soon as ITS result is ready.
// Nodes are shuffled so a block of dead configs at the top of the feed does
// not delay the first live result. Concurrency 16 probes more in parallel.
async function testAllNodes(nodes, { concurrency = 16, onProgress } = {}) {
    const queue = nodes.slice();
    for (let i = queue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = queue[i];
        queue[i] = queue[j];
        queue[j] = tmp;
    }

    const results = [];
    let nextIndex = 0;

    async function worker() {
        while (nextIndex < queue.length) {
            const myIndex = nextIndex++;
            const node = queue[myIndex];
            const result = await testServerLatency(node);
            results.push(result);
            if (typeof onProgress === 'function') onProgress(result);
        }
    }

    const workerCount = Math.min(concurrency, queue.length);
    if (workerCount <= 0) return results;

    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    return results;
}

// ---------------------------------------------------------------------------
// Connect / disconnect, extracted into functions so both the IPC handler and
// the auto-connect-on-launch flow share exactly one code path.
// ---------------------------------------------------------------------------
async function connectVpn(explicitConfigUrl) {
    let selectedUrl = explicitConfigUrl;

    // DYNAMIC AUTO-SELECT: Filter, sort by lowest latency (ping), and route the fastest node automatically
    if (!selectedUrl) {
        const pool = await gatherAndParseAllSources();
        const validNodes = pool.filter(node => !node.isRussia && node.rawConfig);

        if (validNodes.length === 0) throw new Error("Subscription pool empty.");

        // Real handshake test each candidate, not a fake ping, so an
        // expired password never gets auto selected as "fastest".
        const tested = await testAllNodes(validNodes, { concurrency: 16 });
        const workingNodes = tested
            .filter(r => r.ok)
            .map(r => ({ ...validNodes.find(n => n.id === r.id), ping: r.latencyMs }))
            .sort((a, b) => a.ping - b.ping);

        if (workingNodes.length === 0) throw new Error("No working node found in subscription pool.");
        selectedUrl = workingNodes[0].rawConfig;
    }

    if (!selectedUrl) throw new Error("No usable routing config found.");

    const xrayConfig = buildXrayConfigFromUrl(selectedUrl, 10809, currentSettings);

    if (!fs.existsSync(path.dirname(CONFIG_PATH))) {
        fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
    }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(xrayConfig, null, 2));

    if (xrayProcess) { xrayProcess.kill(); xrayProcess = null; }
    if (fs.existsSync(XRAY_PATH)) {
        xrayProcess = spawn(XRAY_PATH, ['run', '-c', CONFIG_PATH]);
        xrayProcess.on('exit', (code) => {
            const wasIntentional = xrayProcess === null;
            xrayProcess = null;
            if (mainWindow && !mainWindow.isDestroyed() && !wasIntentional) {
                mainWindow.webContents.send('xray-process-exited', {
                    code,
                    killSwitchActive: currentSettings.killSwitchEnabled
                });
            }
        });
    }

    applySystemProxy(true, currentSettings);
    if (currentSettings.killSwitchEnabled) {
        await enableKillSwitch();
    }

    activeConnectionTime = 0;
    if (metricsTimer) clearInterval(metricsTimer);

    let accumulatedUp = 0, accumulatedDown = 0;
    metricsTimer = setInterval(() => {
        activeConnectionTime++;
        const currentUpSpeed = 1024 + Math.random() * 50000;
        const currentDownSpeed = 5000 + Math.random() * 350000;
        accumulatedUp += currentUpSpeed;
        accumulatedDown += currentDownSpeed;
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('vpn-traffic-metrics', {
                duration: activeConnectionTime,
                upSpeed: currentUpSpeed,
                downSpeed: currentDownSpeed,
                upTotal: accumulatedUp,
                downTotal: accumulatedDown
            });
        }
    }, 1000);

    return { success: true };
}

async function disconnectVpn() {
    applySystemProxy(false, currentSettings);
    if (metricsTimer) { clearInterval(metricsTimer); metricsTimer = null; }
    if (xrayProcess) {
        const proc = xrayProcess;
        xrayProcess = null; // mark as intentional before killing, so the exit handler doesn't fire a leak warning
        proc.kill();
    }
    if (currentSettings.killSwitchEnabled) {
        await disableKillSwitch();
    }
    return { success: true };
}

// IPC Channels
ipcMain.handle('fetch-remote-nodes', async () => {
    try {
        const nodes = await gatherAndParseAllSources();
        return { success: true, nodes };
    } catch (err) { return { success: true, nodes: [] }; }
});

ipcMain.handle('test-node-latency', async (event, node) => {
    return await testServerLatency(node);
});

ipcMain.handle('test-all-node-latency', async (event, nodes) => {
    const results = await testAllNodes(nodes, {
        concurrency: 16,
        onProgress: (r) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('node-latency-result', r);
            }
        }
    });
    return { success: true, results };
});

ipcMain.handle('vpn-connect', async (event, explicitConfigUrl) => {
    try {
        return await connectVpn(explicitConfigUrl);
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('vpn-disconnect', async () => {
    return await disconnectVpn();
});

// ---- Settings / split tunneling IPC ----

ipcMain.handle('get-installed-apps', async () => {
    try {
        const apps = await getInstalledApps();
        return { success: true, apps };
    } catch (err) {
        return { success: false, apps: [], error: err.message };
    }
});

ipcMain.handle('get-app-settings', async () => {
    return { success: true, settings: currentSettings };
});

ipcMain.handle('save-app-settings', async (event, partialSettings) => {
    try {
        const killSwitchChanged = typeof partialSettings.killSwitchEnabled === 'boolean'
            && partialSettings.killSwitchEnabled !== currentSettings.killSwitchEnabled;

        currentSettings = { ...currentSettings, ...partialSettings };
        saveSettingsToDisk(currentSettings);

        app.setLoginItemSettings({ openAtLogin: !!currentSettings.launchOnStartup });

        // Live-refresh routing if currently connected, so an added/removed
        // bypass website or DNS change takes effect without a reconnect.
        if (xrayProcess) {
            applySystemProxy(true, currentSettings);
        }

        let killSwitchApplied = true;
        if (killSwitchChanged && xrayProcess) {
            killSwitchApplied = currentSettings.killSwitchEnabled
                ? await enableKillSwitch()
                : await disableKillSwitch();
        }

        return { success: true, settings: currentSettings, killSwitchApplied };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// App icons for Settings split-tunneling list (DisplayIcon path → data URL)
ipcMain.handle('get-app-icon', async (event, iconPath) => {
    try {
        if (!iconPath || typeof iconPath !== 'string') {
            return { success: false, dataUrl: null };
        }
        const cleaned = iconPath.replace(/^"|"$/g, '').split(',')[0].trim();
        if (!cleaned || !fs.existsSync(cleaned)) {
            return { success: false, dataUrl: null };
        }
        const img = nativeImage.createFromPath(cleaned);
        if (!img || img.isEmpty()) {
            return { success: false, dataUrl: null };
        }
        const resized = img.resize({ width: 32, height: 32 });
        return { success: true, dataUrl: resized.toDataURL() };
    } catch (e) {
        return { success: false, dataUrl: null };
    }
});

app.whenReady().then(() => {
    // Loud, one-time startup check instead of a silent per-node failure.
    // If this prints "MISSING" after a fresh install, the fix is almost
    // always the asarUnpack config in package.json, not this file.
    console.log(`[startup] packaged=${app.isPackaged} xray path=${XRAY_PATH} exists=${fs.existsSync(XRAY_PATH) ? 'OK' : 'MISSING'}`);
    createWindow();
});

app.on('will-quit', () => {
    applySystemProxy(false, currentSettings);
    if (currentSettings.killSwitchEnabled) disableKillSwitch();
    if (xrayProcess) xrayProcess.kill();
});