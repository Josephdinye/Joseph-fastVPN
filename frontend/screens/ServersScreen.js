const { ipcRenderer } = require('electron');
const path = require('path');

// Wrap screens in absolute __dirname resolvers with explicit extensions for ASAR file compliance
const HomeScreen = require(path.join(__dirname, 'screens', 'HomeScreen.js'));
const SettingsScreen = require(path.join(__dirname, 'screens', 'SettingsScreen.js'));
const AboutScreen = require(path.join(__dirname, 'screens', 'AboutScreen.js'));

// Central Application Context State Machine
const appState = {
    vpnState: "DISCONNECTED",
    activeNode: { 
        id: 'auto-fastest', 
        name: 'Auto · Fastest', 
        flag: '⚡', 
        iso: null, 
        subtitle: 'Picks the lowest-latency working server', 
        protocol: 'AUTO', 
        isAuto: true, 
        rawConfig: null 
    },
    rawNodesPool: [],
    excludeRF: true,
    searchQuery: ""
};

const viewport = document.getElementById('viewport');
const navButtons = document.querySelectorAll('.nav-btn');

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
            <h2 style="font-weight: 600; margin-bottom: 15px;">Available Nodes</h2>
            
            <div style="display:flex; flex-direction:column; gap:12px; margin-bottom:15px;">
                <input type="text" id="nodeSearchInput" class="native-input" placeholder="🔍 Search country or location keys..." value="${appState.searchQuery}" />
                <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-card); padding:10px 15px; border-radius:8px; border:1px solid var(--border-color);">
                    <span style="font-size:13px; color:var(--text-secondary);">Exclude Russian Nodes (RF)</span>
                    <input type="checkbox" id="excludeRfToggle" style="width:18px; height:18px; cursor:pointer;" ${appState.excludeRF ? 'checked' : ''} />
                </div>
            </div>

            <div id="serverList" class="list-container">
                <p style="padding:20px; color: var(--text-muted);">Parsing and testing subscription networks...</p>
            </div>
        </div>`;

    const searchInput = document.getElementById('nodeSearchInput');
    const rfToggle = document.getElementById('excludeRfToggle');

    searchInput.oninput = (e) => {
        appState.searchQuery = e.target.value.toLowerCase().trim();
        filterAndPopulateList();
    };

    rfToggle.onchange = (e) => {
        appState.excludeRF = e.target.checked;
        filterAndPopulateList();
    };

    if (appState.rawNodesPool.length === 0) {
        ipcRenderer.invoke('fetch-remote-nodes').then(res => {
            if (res.success) {
                appState.rawNodesPool = res.nodes;
                filterAndPopulateList();
            } else {
                document.getElementById('serverList').innerHTML = `<p style="padding:20px; color:var(--accent-red);">${res.error}</p>`;
            }
        });
    } else {
        filterAndPopulateList();
    }
}

function filterAndPopulateList() {
    const container = document.getElementById('serverList');
    if (!container) return;
    container.innerHTML = "";

    const autoNodeData = { id: 'auto-fastest', name: 'Auto · Fastest', flag: '⚡', iso: null, subtitle: 'Picks the lowest-latency working server', protocol: 'AUTO', isAuto: true, rawConfig: null };
    
    if (autoNodeData.name.toLowerCase().includes(appState.searchQuery) || appState.searchQuery === "") {
        appendServerRow(container, autoNodeData, -1); // Auto node index passes -1 to bypass fire badge assignments
    }

    // Index tracking used to append specific decoration elements onto the speediest servers
    let nonAutoDisplayIndex = 0;

    appState.rawNodesPool.forEach(node => {
        if (appState.excludeRF && node.isRussia) return; 
        
        if (appState.searchQuery) {
            const matchesName = node.name.toLowerCase().includes(appState.searchQuery);
            const matchesSubtitle = node.subtitle.toLowerCase().includes(appState.searchQuery);
            if (!matchesName && !matchesSubtitle) return;
        }

        appendServerRow(container, node, nonAutoDisplayIndex);
        nonAutoDisplayIndex++;
    });
}

function appendServerRow(container, node, index) {
    const div = document.createElement('div');
    const isSelected = appState.activeNode.id === node.id;
    div.className = `server-item ${isSelected ? 'selected' : ''}`;

    let flagRenderElement = `<span style="font-size:20px; width:30px; text-align:center; display:inline-block;">🌐</span>`;
    if (node.isAuto) {
        flagRenderElement = `<span style="font-size:20px; width:30px; text-align:center; display:inline-block;">⚡</span>`;
    } else if (node.iso && typeof node.iso === 'string') {
        const cleanIso = node.iso.trim().toLowerCase();
        if (cleanIso.length === 2) {
            // Pointing to FlagCDN 16x12 pixel dimension structure
            flagRenderElement = `<img src="https://flagcdn.com{cleanIso}.png" style="width:24px; height:auto; border-radius:3px; display:inline-block; vertical-align:middle; box-shadow: 0 1px 3px rgba(0,0,0,0.3);" onerror="this.outerHTML='🌐'"/>`;
        }
    }

    // Fire symbol logic assigned explicitly to the top 3 fastest discovered tunnels
    const isTopFastest = !node.isAuto && index >= 0 && index < 3;
    const fireBadge = isTopFastest ? `<span style="margin-left: 6px; font-size:13px;" title="Top Speed Connection">🔥</span>` : '';

    div.innerHTML = `
        <div style="display:flex; align-items:center; gap:12px;">
            <div style="width:30px; display:flex; justify-content:center; align-items:center;">
                ${flagRenderElement}
            </div>
            <div>
                <strong style="color: var(--text-main); display:block; font-size:14px; align-items:center; display:inline-flex;">
                    ${node.name} ${node.isAuto ? '' : '#' + node.countIndex} ${fireBadge}
                </strong>
                <span style="color: var(--text-muted); font-size:11px; display:block;">${node.subtitle || 'VLESS Location Profile'}</span>
            </div>
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
            <span class="protocol-badge">${node.protocol}</span>
            ${node.ping ? `<span class="latency-badge" style="font-weight:600; color:${node.ping < 200 ? '#4caf50' : '#ff9800'};">${Math.round(node.ping)} ms</span>` : ''}
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

// Boot app view context onto default frame location pointer
switchScreen('home');
