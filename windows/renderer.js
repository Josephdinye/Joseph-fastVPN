// renderer.js
const { ipcRenderer } = require('electron');
const path = require('path');

const HomeScreen = require(path.join(__dirname, 'screens', 'HomeScreen.js'));
const SettingsScreen = require(path.join(__dirname, 'screens', 'SettingsScreen.js'));
const AboutScreen = require(path.join(__dirname, 'screens', 'AboutScreen.js'));

const appState = {
    vpnState: "DISCONNECTED",
    activeNode: {
        id: 'auto-fastest',
        name: 'Auto · Fastest',
        flag: '⚡',
        iso: null,
        subtitle: 'Picks one of the 2 fastest working servers',
        protocol: 'AUTO',
        isAuto: true,
        rawConfig: null
    },
    rawNodesPool: [],
    excludeRF: true,
    searchQuery: ""
};

const AUTO_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

const viewport = document.getElementById('viewport');
const navButtons = document.querySelectorAll('.nav-btn');

ipcRenderer.on('node-latency-result', (event, result) => {
    applyLatencyResult(result);
});

function applyLatencyResult(result) {
    const node = appState.rawNodesPool.find(n => n.id === result.id);
    if (node) {
        node.status = result.ok ? 'online' : 'offline';
        node.ping = result.ok ? result.latencyMs : null;
        node.failReason = result.ok ? null : result.reason;
    }
    if (document.getElementById('serverList')) {
        filterAndPopulateList();
    }
}

async function switchScreen(screenKey) {
    if (window.currentScreenCleanup && typeof window.currentScreenCleanup === 'function') {
        window.currentScreenCleanup();
        window.currentScreenCleanup = null;
    }

    navButtons.forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-screen') === screenKey);
    });

    if (screenKey === 'servers') {
        renderServersView();
    } else {
        const screens = { home: HomeScreen, settings: SettingsScreen, about: AboutScreen };
        viewport.innerHTML = screens[screenKey].render();
        screens[screenKey].init(ipcRenderer, appState);
    }
}

function renderServersView() {
    viewport.innerHTML = `
        <div class="screen active fade-in">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <h2 style="font-weight: 600; margin: 0;">Available Servers</h2>
                <button id="retestAllBtn" class="native-btn-secondary" style="font-size:12px; padding:6px 12px;">Refresh</button>
            </div>

            <div style="display:flex; flex-direction:column; gap:12px; margin-bottom:15px;">
                <input type="text" id="nodeSearchInput" class="native-input" placeholder="Search country or location..." value="${appState.searchQuery}" />
                <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-card); padding:10px 15px; border-radius:8px; border:1px solid var(--border-color);">
                    <span style="font-size:13px; color:var(--text-secondary);">Exclude Russian Servers (RF)</span>
                    <input type="checkbox" id="excludeRfToggle" style="width:18px; height:18px; cursor:pointer;" ${appState.excludeRF ? 'checked' : ''} />
                </div>
            </div>

            <div id="serverList" class="list-container">
                <p style="padding:20px; color: var(--text-muted);">Fetching Servers. Please wait....</p>
            </div>
        </div>`;

    const searchInput = document.getElementById('nodeSearchInput');
    const rfToggle = document.getElementById('excludeRfToggle');
    const retestAllBtn = document.getElementById('retestAllBtn');

    searchInput.oninput = (e) => {
        appState.searchQuery = e.target.value.toLowerCase().trim();
        filterAndPopulateList();
    };

    rfToggle.onchange = (e) => {
        appState.excludeRF = e.target.checked;
        filterAndPopulateList();
    };

    retestAllBtn.onclick = () => {
        runFullLatencySweep();
    };

    if (appState.rawNodesPool.length === 0) {
        ipcRenderer.invoke('fetch-remote-nodes').then(res => {
            if (res.success) {
                appState.rawNodesPool = res.nodes;
                filterAndPopulateList();
                runFullLatencySweep();
            } else {
                document.getElementById('serverList').innerHTML =
                    `<p style="padding:20px; color:var(--accent-red);">${res.error}</p>`;
            }
        });
    } else {
        filterAndPopulateList();
    }
}

async function runFullLatencySweep() {
    if (appState.rawNodesPool.length === 0) return;
    document.querySelectorAll('.latency-badge[data-node-id]').forEach(b => {
        b.textContent = 'Testing…';
        b.classList.remove('offline-badge', 'online-badge');
    });
    await ipcRenderer.invoke('test-all-node-latency', appState.rawNodesPool);
}

async function backgroundRefreshCycle() {
    try {
        const res = await ipcRenderer.invoke('fetch-remote-nodes');
        if (!res.success) return;

        const previousById = new Map(
            appState.rawNodesPool.map(n => [n.id, { status: n.status, ping: n.ping, failReason: n.failReason }])
        );

        appState.rawNodesPool = res.nodes.map(n => {
            const prev = previousById.get(n.id);
            return prev ? { ...n, status: prev.status, ping: prev.ping, failReason: prev.failReason } : n;
        });

        if (document.getElementById('serverList')) {
            filterAndPopulateList();
        }

        await ipcRenderer.invoke('test-all-node-latency', appState.rawNodesPool);
    } catch (e) {}
}

setInterval(backgroundRefreshCycle, AUTO_REFRESH_INTERVAL_MS);

// Top 1–2 fastest online nodes
function getTopFastestNodes(limit = 2) {
    return appState.rawNodesPool
        .filter(n => {
            if (appState.excludeRF && n.isRussia) return false;
            return n.status === 'online' && n.ping != null && n.rawConfig;
        })
        .sort((a, b) => a.ping - b.ping)
        .slice(0, limit);
}

// Returns the full chosen node (not just rawConfig)
function resolveAutoFastestNode() {
    const top = getTopFastestNodes(2);
    if (top.length === 0) return null;
    return top[Math.floor(Math.random() * top.length)];
}

window.resolveAutoFastestNode = resolveAutoFastestNode;

function filterAndPopulateList() {
    const container = document.getElementById('serverList');
    if (!container) return;
    container.innerHTML = "";

    const autoNodeData = {
        id: 'auto-fastest',
        name: 'Auto · Fastest',
        flag: '⚡',
        iso: null,
        subtitle: 'Picks one of the 2 fastest working servers',
        protocol: 'AUTO',
        isAuto: true,
        rawConfig: null
    };

    if (autoNodeData.name.toLowerCase().includes(appState.searchQuery) || appState.searchQuery === "") {
        appendServerRow(container, autoNodeData, false);
    }

    const candidates = appState.rawNodesPool.filter(node => {
        if (appState.excludeRF && node.isRussia) return false;
        if (node.status === 'offline') return false;
        if (appState.searchQuery) {
            const matchesName = node.name.toLowerCase().includes(appState.searchQuery);
            const matchesSubtitle = node.subtitle.toLowerCase().includes(appState.searchQuery);
            if (!matchesName && !matchesSubtitle) return false;
        }
        return true;
    });

    const online = candidates
        .filter(n => n.status === 'online' && n.ping != null)
        .sort((a, b) => a.ping - b.ping);
    const pending = candidates.filter(n => !(n.status === 'online' && n.ping != null));
    const orderedNodes = [...online, ...pending];

    // Top TWO get BEST badge
    const bestIds = new Set(online.slice(0, 2).map(n => n.id));

    orderedNodes.forEach(node => {
        appendServerRow(container, node, bestIds.has(node.id));
    });
}

function appendServerRow(container, node, isBest) {
    const div = document.createElement('div');
    const isSelected = appState.activeNode.id === node.id ||
        (appState.activeNode.chosenFromAuto && appState.activeNode.id === node.id);
    div.className = `server-item ${isSelected ? 'selected' : ''}`;

    let flagRenderElement = `<span style="font-size:20px; width:30px; text-align:center; display:inline-block;">🌐</span>`;
    if (node.isAuto) {
        flagRenderElement = `<span style="font-size:20px; width:30px; text-align:center; display:inline-block;">⚡</span>`;
    } else if (node.iso && typeof node.iso === 'string') {
        const cleanIso = node.iso.trim().toLowerCase();
        if (cleanIso.length === 2) {
            flagRenderElement = `<img src="https://flagcdn.com/w40/${cleanIso}.png" style="width:24px; height:auto; border-radius:3px; display:inline-block; vertical-align:middle; box-shadow: 0 1px 3px rgba(0,0,0,0.3);" onerror="this.outerHTML='🌐'"/>`;
        }
    }

    let latencyBadgeHtml = '';
    if (!node.isAuto) {
        if (node.status === 'online' && node.ping != null) {
            latencyBadgeHtml = `<span class="latency-badge online-badge" data-node-id="${node.id}">${Math.round(node.ping)} ms</span>`;
        } else if (node.status === 'offline') {
            latencyBadgeHtml = `<span class="latency-badge offline-badge" data-node-id="${node.id}" title="${node.failReason || 'Handshake failed'}">Offline</span>`;
        } else {
            latencyBadgeHtml = `<span class="latency-badge" data-node-id="${node.id}">Testing…</span>`;
        }
    }

    const bestBadgeHtml = (isBest && !node.isAuto)
        ? `<span class="best-badge" style="background:#1fbf75; color:#04140c; font-size:10px; font-weight:700; letter-spacing:0.4px; padding:2px 7px; border-radius:20px; margin-right:6px;">BEST</span>`
        : '';

    div.innerHTML = `
        <div style="display:flex; align-items:center; gap:12px;">
            <div style="width:30px; display:flex; justify-content:center; align-items:center;">
                ${flagRenderElement}
            </div>
            <div>
                <strong style="color: var(--text-main); display:block; font-size:14px;">${bestBadgeHtml}${node.name} ${node.isAuto ? '' : '#' + node.countIndex}</strong>
                <span style="color: var(--text-muted); font-size:11px;">${node.subtitle || ''}</span>
            </div>
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
            ${latencyBadgeHtml}
        </div>
    `;

    div.onclick = () => {
        document.querySelectorAll('.server-item').forEach(el => el.classList.remove('selected'));
        div.classList.add('selected');
        appState.activeNode = node;
        setTimeout(() => switchScreen('home'), 150);
    };
    container.appendChild(div);
}

navButtons.forEach(button => {
    button.addEventListener('click', () => switchScreen(button.getAttribute('data-screen')));
});

switchScreen('home');