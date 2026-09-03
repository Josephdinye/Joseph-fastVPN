const HomeScreen = {
    render: () => `
        <div class="screen active fade-in">
            <!-- Summary Core Track Banner -->
            <div class="header-banner">
                <div class="pulse-container">
                    <div id="statusPulse" class="pulse-dot idle"></div>
                    <span id="statusLabel" class="status-text">DISCONNECTED</span>
                </div>
                <div id="durationDisplay" class="timer-badge">00:00:00</div>
            </div>

            <!-- Centralized Vector Connection Ring Gauge -->
            <div class="gauge-viewport">
                <div class="outer-ring">
                    <div class="inner-ring">
                        <button id="powerBtn" class="power-button disconnected">
                            <svg viewBox="0 0 24 24" width="40" height="40" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
                                <line x1="12" y1="2" x2="12" y2="12"></line>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Real-time Active Node Info Card (no protocol badge) -->
            <div class="node-panel" id="openServersTrigger">
                <div class="node-meta">
                    <img id="nodeFlag" class="flag-icon hidden" src="" />
                    <div class="icon-placeholder" id="nodeIconFallback">🌐</div>
                    <div class="node-details">
                        <div id="nodeTitle" class="node-name">Auto · Fastest</div>
                        <div id="nodeSubtitle" class="node-location">Optimal Routing Server</div>
                    </div>
                </div>
                <div class="node-action">
                    <span id="nodeLatency" class="latency-badge hidden">-- ms</span>
                    <span class="chevron">➔</span>
                </div>
            </div>

            <!-- Live Bandwidth & Speed Network Grid -->
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-header"><span class="metric-icon up">▲</span> UPLOAD SPEED</div>
                    <div class="metric-value" id="valUpSpeed">0.0 KB/s</div>
                    <div class="metric-footer">Total: <span id="valUpTotal">0.00 MB</span></div>
                </div>
                <div class="metric-card">
                    <div class="metric-header"><span class="metric-icon down">▼</span> DOWNLOAD SPEED</div>
                    <div class="metric-value" id="valDownSpeed">0.0 KB/s</div>
                    <div class="metric-footer">Total: <span id="valDownTotal">0.00 MB</span></div>
                </div>
            </div>
        </div>
    `,
    init: (ipcRenderer, appState) => {
        const powerBtn = document.getElementById('powerBtn');
        const statusLabel = document.getElementById('statusLabel');
        const statusPulse = document.getElementById('statusPulse');
        const durationDisplay = document.getElementById('durationDisplay');

        const nodeTitle = document.getElementById('nodeTitle');
        const nodeSubtitle = document.getElementById('nodeSubtitle');
        const nodeLatency = document.getElementById('nodeLatency');
        const nodeFlag = document.getElementById('nodeFlag');
        const nodeIconFallback = document.getElementById('nodeIconFallback');

        const valUpSpeed = document.getElementById('valUpSpeed');
        const valDownSpeed = document.getElementById('valDownSpeed');
        const valUpTotal = document.getElementById('valUpTotal');
        const valDownTotal = document.getElementById('valDownTotal');

        const formatDuration = (seconds) => {
            const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
            const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
            const s = Math.floor(seconds % 60).toString().padStart(2, '0');
            return `${h}:${m}:${s}`;
        };

        const formatSpeed = (bytesPerSec) => {
            if (!bytesPerSec) return "0.0 KB/s";
            if (bytesPerSec < 1024) return `${Number(bytesPerSec).toFixed(0)} B/s`;
            if (bytesPerSec < 1048576) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
            return `${(bytesPerSec / 1048576).toFixed(1)} MB/s`;
        };

        const formatBytes = (bytes) => {
            if (!bytes) return "0.00 MB";
            if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
            if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(2)} MB`;
            return `${(bytes / 1073741824).toFixed(2)} GB`;
        };

        const pureAutoNode = () => ({
            id: 'auto-fastest',
            name: 'Auto · Fastest',
            flag: '⚡',
            iso: null,
            subtitle: 'Picks one of the 2 fastest working servers',
            isAuto: true,
            rawConfig: null,
            chosenFromAuto: false
        });

        // No protocol / VLESS / AUTO badge — only name, flag, subtitle, latency
        const renderNodeDisplay = (node) => {
            if (!node) return;

            // Pure Auto (not yet connected to a real server)
            if (node.isAuto && !node.chosenFromAuto) {
                nodeTitle.innerText = 'Auto · Fastest';
                nodeSubtitle.innerText = node.subtitle || 'Picks one of the 2 fastest working servers';
                nodeFlag.classList.add('hidden');
                nodeIconFallback.innerText = '⚡';
                nodeIconFallback.classList.remove('hidden');
                nodeLatency.classList.add('hidden');
                return;
            }

            // Real server (manual pick or auto-chosen)
            const displayName = node.countIndex != null
                ? `${node.name} #${node.countIndex}`
                : (node.name || 'Server');
            nodeTitle.innerText = displayName;

            if (node.chosenFromAuto) {
                nodeSubtitle.innerText = `Auto-selected · ${node.subtitle || node.name || ''}`;
            } else {
                nodeSubtitle.innerText = node.subtitle || 'Selected Server Location';
            }

            if (node.iso && typeof node.iso === 'string' && node.iso.trim().length === 2) {
                nodeFlag.src = `https://flagcdn.com/w40/${node.iso.trim().toLowerCase()}.png`;
                nodeFlag.classList.remove('hidden');
                nodeIconFallback.classList.add('hidden');
            } else {
                nodeFlag.classList.add('hidden');
                nodeIconFallback.innerText = node.flag || '🌐';
                nodeIconFallback.classList.remove('hidden');
            }

            if (node.ping != null || node.latency != null) {
                nodeLatency.innerText = `${Math.round(node.ping ?? node.latency)} ms`;
                nodeLatency.classList.remove('hidden');
            } else {
                nodeLatency.classList.add('hidden');
            }
        };

        const activeNode = appState.activeNode || pureAutoNode();
        renderNodeDisplay(activeNode);

        const syncUIState = () => {
            if (appState.vpnState === "CONNECTED") {
                statusLabel.innerText = "CONNECTED";
                statusPulse.className = "pulse-dot active";
                powerBtn.className = "power-button connected";
            } else if (appState.vpnState === "ROUTING") {
                statusLabel.innerText = "CONNECTING...";
                statusPulse.className = "pulse-dot routing";
                powerBtn.className = "power-button routing";
            } else {
                statusLabel.innerText = "DISCONNECTED";
                statusPulse.className = "pulse-dot idle";
                powerBtn.className = "power-button disconnected";
                durationDisplay.innerText = "00:00:00";
                valUpSpeed.innerText = "0.0 KB/s";
                valDownSpeed.innerText = "0.0 KB/s";
            }
        };

        syncUIState();

        const removeTrafficListener = ipcRenderer.on('vpn-traffic-metrics', (event, metrics) => {
            if (appState.vpnState !== "CONNECTED") return;
            durationDisplay.innerText = formatDuration(metrics.duration);
            valUpSpeed.innerText = formatSpeed(metrics.upSpeed);
            valDownSpeed.innerText = formatSpeed(metrics.downSpeed);
            valUpTotal.innerText = formatBytes(metrics.upTotal);
            valDownTotal.innerText = formatBytes(metrics.downTotal);
        });

        powerBtn.onclick = async () => {
            if (appState.vpnState === "DISCONNECTED" || appState.vpnState === "ERROR") {
                appState.vpnState = "ROUTING";
                syncUIState();

                const currentNode = appState.activeNode || pureAutoNode();
                let configToUse = null;
                let chosenNode = null;
                let didAutoChoose = false;

                const wantsAuto = !!(currentNode.isAuto && !currentNode.rawConfig);

                if (wantsAuto) {
                    // Ensure node list exists
                    if (!appState.rawNodesPool || appState.rawNodesPool.length === 0) {
                        try {
                            const res = await ipcRenderer.invoke('fetch-remote-nodes');
                            if (res && res.success && Array.isArray(res.nodes)) {
                                appState.rawNodesPool = res.nodes;
                            }
                        } catch (e) {}
                    }

                    chosenNode = typeof window.resolveAutoFastestNode === 'function'
                        ? window.resolveAutoFastestNode()
                        : null;

                    // If nothing online yet, run tests then try again
                    if (!chosenNode && appState.rawNodesPool && appState.rawNodesPool.length > 0) {
                        try {
                            await ipcRenderer.invoke('test-all-node-latency', appState.rawNodesPool);
                        } catch (e) {}
                        chosenNode = typeof window.resolveAutoFastestNode === 'function'
                            ? window.resolveAutoFastestNode()
                            : null;
                    }

                    if (!chosenNode || !chosenNode.rawConfig) {
                        appState.vpnState = "ERROR";
                        syncUIState();
                        alert("No fast servers available yet. Open the Servers tab and wait for latency testing to finish, then try again.");
                        return;
                    }

                    configToUse = chosenNode.rawConfig;
                    didAutoChoose = true;

                    // Show real server on Home (flag, name, latency) — no protocol badge
                    appState.activeNode = {
                        ...chosenNode,
                        isAuto: true,
                        chosenFromAuto: true,
                        subtitle: chosenNode.subtitle || chosenNode.name
                    };
                    renderNodeDisplay(appState.activeNode);
                } else {
                    configToUse = currentNode.rawConfig;
                    if (!configToUse) {
                        appState.vpnState = "ERROR";
                        syncUIState();
                        alert("No server config selected.");
                        return;
                    }
                }

                const result = await ipcRenderer.invoke('vpn-connect', configToUse);
                if (result && result.success) {
                    appState.vpnState = "CONNECTED";
                } else {
                    appState.vpnState = "ERROR";
                    if (didAutoChoose) {
                        appState.activeNode = pureAutoNode();
                        renderNodeDisplay(appState.activeNode);
                    }
                    alert(`Connection Failed: ${(result && result.error) || 'Unknown error'}`);
                }
                syncUIState();
            } else {
                appState.vpnState = "DISCONNECTED";
                await ipcRenderer.invoke('vpn-disconnect');

                if (appState.activeNode && appState.activeNode.chosenFromAuto) {
                    appState.activeNode = pureAutoNode();
                    renderNodeDisplay(appState.activeNode);
                }
                syncUIState();
            }
        };

        document.getElementById('openServersTrigger').onclick = () => {
            const btn = document.querySelector('[data-screen="servers"]');
            if (btn) btn.click();
        };

        window.currentScreenCleanup = () => {
            if (removeTrafficListener && typeof removeTrafficListener === 'function') {
                removeTrafficListener();
            }
        };
    }
};

module.exports = HomeScreen;