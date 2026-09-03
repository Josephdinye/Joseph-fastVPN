const SettingsScreen = {
    render: () => `
        <div class="screen active fade-in" id="settingsRoot">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:18px;">
                <div>
                    <h2 style="font-weight: 700; margin: 0; font-size: 20px; letter-spacing: -0.02em;">Settings</h2>
                    <p style="margin: 4px 0 0 0; font-size: 12px; color: var(--text-muted);">Connection, security, and split tunneling</p>
                </div>
            </div>

            <!-- General -->
            <section class="card settings-section">
                <div class="settings-section-head">
                    <div class="settings-section-icon">⚙️</div>
                    <div>
                        <h3 class="settings-section-title">General</h3>
                        <p class="settings-section-desc">Startup and launch behavior</p>
                    </div>
                </div>

                <div class="settings-row">
                    <div class="settings-row-text">
                        <div class="settings-row-title">Auto-connect on launch</div>
                        <div class="settings-row-sub">Connect as soon as the app opens</div>
                    </div>
                    <label class="switch">
                        <input type="checkbox" id="toggleAutoConnect" />
                        <span class="slider"></span>
                    </label>
                </div>

                <div class="settings-row settings-row-last">
                    <div class="settings-row-text">
                        <div class="settings-row-title">Launch on Windows startup</div>
                        <div class="settings-row-sub">Open with Windows when you sign in</div>
                    </div>
                    <label class="switch">
                        <input type="checkbox" id="toggleLaunchOnStartup" />
                        <span class="slider"></span>
                    </label>
                </div>
            </section>

            <!-- Security -->
            <section class="card settings-section">
                <div class="settings-section-head">
                    <div class="settings-section-icon">🛡️</div>
                    <div>
                        <h3 class="settings-section-title">Security</h3>
                        <p class="settings-section-desc">Protect traffic if the tunnel drops</p>
                    </div>
                </div>

                <div class="settings-row">
                    <div class="settings-row-text">
                        <div class="settings-row-title">Kill switch</div>
                        <div class="settings-row-sub">Block outbound traffic if the VPN disconnects. Needs administrator rights.</div>
                    </div>
                    <label class="switch">
                        <input type="checkbox" id="toggleKillSwitch" />
                        <span class="slider"></span>
                    </label>
                </div>

                <div class="settings-row">
                    <div class="settings-row-text">
                        <div class="settings-row-title">DNS leak protection</div>
                        <div class="settings-row-sub">Send DNS through your chosen servers when connected</div>
                    </div>
                    <label class="switch">
                        <input type="checkbox" id="toggleDnsProtection" />
                        <span class="slider"></span>
                    </label>
                </div>

                <div id="customDnsWrap" class="settings-dns-box">
                    <div class="settings-dns-label">Custom DNS servers</div>
                    <div style="display:flex; gap:10px; flex-wrap:wrap;">
                        <input type="text" id="dnsPrimaryInput" class="native-input settings-dns-input" placeholder="Primary — e.g. 1.1.1.1" />
                        <input type="text" id="dnsSecondaryInput" class="native-input settings-dns-input" placeholder="Secondary — optional" />
                    </div>
                    <button id="saveDnsBtn" class="native-btn-secondary settings-btn-sm">Save DNS</button>
                </div>
            </section>

            <!-- Websites -->
            <section class="card settings-section">
                <div class="settings-section-head">
                    <div class="settings-section-icon">🌐</div>
                    <div>
                        <h3 class="settings-section-title">Bypass websites</h3>
                        <p class="settings-section-desc">These domains use your normal connection (no VPN)</p>
                    </div>
                </div>

                <div class="settings-add-row">
                    <input type="text" id="websiteInput" class="native-input" placeholder="Domain — e.g. netflix.com" style="flex:1;" />
                    <button id="addWebsiteBtn" class="native-btn-secondary settings-btn-sm">Add</button>
                </div>

                <div id="websiteChipList" class="settings-chip-list"></div>
                <div id="websiteEmptyState" class="settings-empty">No websites added yet</div>
            </section>

            <!-- Apps -->
            <section class="card settings-section settings-section-last">
                <div class="settings-section-head">
                    <div class="settings-section-icon">📦</div>
                    <div>
                        <h3 class="settings-section-title">Bypass apps</h3>
                        <p class="settings-section-desc">Apps that should stay off the VPN (system-proxy aware apps)</p>
                    </div>
                </div>

                <input type="text" id="appSearchInput" class="native-input" placeholder="Search installed apps…" style="width:100%; box-sizing:border-box; margin-bottom:12px;" />

                <div id="appListContainer" class="settings-app-list">
                    <p class="settings-empty" style="padding:24px;">Loading installed apps…</p>
                </div>
            </section>

            <style>
                #settingsRoot .settings-section {
                    padding: 16px 18px;
                    margin-bottom: 14px;
                    border-radius: 14px;
                }
                #settingsRoot .settings-section-last { margin-bottom: 8px; }
                #settingsRoot .settings-section-head {
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                    margin-bottom: 14px;
                    padding-bottom: 12px;
                    border-bottom: 1px solid var(--border-color);
                }
                #settingsRoot .settings-section-icon {
                    width: 36px; height: 36px;
                    border-radius: 10px;
                    background: rgba(59, 130, 246, 0.12);
                    display: flex; align-items: center; justify-content: center;
                    font-size: 16px; flex-shrink: 0;
                }
                #settingsRoot .settings-section-title {
                    margin: 0; font-size: 14px; font-weight: 650; color: var(--text-main);
                }
                #settingsRoot .settings-section-desc {
                    margin: 3px 0 0 0; font-size: 12px; color: var(--text-muted); line-height: 1.35;
                }
                #settingsRoot .settings-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 16px;
                    padding: 12px 0;
                    border-bottom: 1px solid rgba(255,255,255,0.04);
                }
                #settingsRoot .settings-row-last { border-bottom: none; padding-bottom: 0; }
                #settingsRoot .settings-row-text { min-width: 0; flex: 1; }
                #settingsRoot .settings-row-title {
                    font-size: 13px; font-weight: 600; color: var(--text-main);
                }
                #settingsRoot .settings-row-sub {
                    font-size: 11.5px; color: var(--text-muted); margin-top: 3px; line-height: 1.4;
                }
                #settingsRoot .settings-dns-box {
                    margin-top: 12px;
                    padding: 12px;
                    border-radius: 10px;
                    background: rgba(0,0,0,0.18);
                    border: 1px solid var(--border-color);
                }
                #settingsRoot .settings-dns-label {
                    font-size: 11px; font-weight: 600; color: var(--text-muted);
                    text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 8px;
                }
                #settingsRoot .settings-dns-input { flex: 1; min-width: 140px; }
                #settingsRoot .settings-btn-sm {
                    font-size: 12px; padding: 7px 14px; margin-top: 10px; border-radius: 8px;
                }
                #settingsRoot .settings-add-row {
                    display: flex; gap: 10px; margin-bottom: 12px; align-items: center;
                }
                #settingsRoot .settings-chip-list {
                    display: flex; flex-wrap: wrap; gap: 8px;
                }
                #settingsRoot .settings-chip {
                    display: inline-flex; align-items: center; gap: 6px;
                    background: rgba(59, 130, 246, 0.1);
                    border: 1px solid rgba(59, 130, 246, 0.25);
                    color: var(--text-main);
                    border-radius: 999px;
                    padding: 5px 6px 5px 12px;
                    font-size: 12px;
                }
                #settingsRoot .settings-chip button {
                    border: none; background: transparent; color: var(--text-muted);
                    cursor: pointer; width: 22px; height: 22px; border-radius: 50%;
                    display: flex; align-items: center; justify-content: center; font-size: 12px;
                }
                #settingsRoot .settings-chip button:hover { background: rgba(255,255,255,0.08); color: #fff; }
                #settingsRoot .settings-empty {
                    font-size: 12px; color: var(--text-muted); padding: 4px 0;
                }
                #settingsRoot .settings-app-list {
                    max-height: 280px;
                    overflow-y: auto;
                    border-radius: 10px;
                    border: 1px solid var(--border-color);
                    background: rgba(0,0,0,0.12);
                }
                #settingsRoot .settings-app-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                    padding: 10px 12px;
                    border-bottom: 1px solid rgba(255,255,255,0.04);
                }
                #settingsRoot .settings-app-row:last-child { border-bottom: none; }
                #settingsRoot .settings-app-row:hover { background: rgba(255,255,255,0.03); }
                #settingsRoot .settings-app-left {
                    display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1;
                }
                #settingsRoot .settings-app-icon {
                    width: 32px; height: 32px; border-radius: 8px;
                    object-fit: contain;
                    background: rgba(255,255,255,0.06);
                    flex-shrink: 0;
                }
                #settingsRoot .settings-app-icon-fallback {
                    width: 32px; height: 32px; border-radius: 8px;
                    background: rgba(59, 130, 246, 0.15);
                    display: flex; align-items: center; justify-content: center;
                    font-size: 14px; flex-shrink: 0;
                }
                #settingsRoot .settings-app-name {
                    font-size: 13px; font-weight: 600; color: var(--text-main);
                    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                }
                #settingsRoot .settings-app-pub {
                    font-size: 11px; color: var(--text-muted);
                    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                }
                /* Toggle switch */
                #settingsRoot .switch {
                    position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0;
                }
                #settingsRoot .switch input { opacity: 0; width: 0; height: 0; }
                #settingsRoot .slider {
                    position: absolute; cursor: pointer; inset: 0;
                    background: rgba(255,255,255,0.12);
                    border-radius: 999px; transition: 0.2s;
                }
                #settingsRoot .slider:before {
                    position: absolute; content: "";
                    height: 18px; width: 18px; left: 3px; bottom: 3px;
                    background: #fff; border-radius: 50%; transition: 0.2s;
                }
                #settingsRoot .switch input:checked + .slider {
                    background: #3b82f6;
                }
                #settingsRoot .switch input:checked + .slider:before {
                    transform: translateX(20px);
                }
            </style>
        </div>
    `,

    init: (ipcRenderer, appState) => {
        const toggleAutoConnect = document.getElementById('toggleAutoConnect');
        const toggleLaunchOnStartup = document.getElementById('toggleLaunchOnStartup');
        const toggleKillSwitch = document.getElementById('toggleKillSwitch');
        const toggleDnsProtection = document.getElementById('toggleDnsProtection');
        const dnsPrimaryInput = document.getElementById('dnsPrimaryInput');
        const dnsSecondaryInput = document.getElementById('dnsSecondaryInput');
        const saveDnsBtn = document.getElementById('saveDnsBtn');

        const websiteInput = document.getElementById('websiteInput');
        const addWebsiteBtn = document.getElementById('addWebsiteBtn');
        const websiteChipList = document.getElementById('websiteChipList');
        const websiteEmptyState = document.getElementById('websiteEmptyState');

        const appSearchInput = document.getElementById('appSearchInput');
        const appListContainer = document.getElementById('appListContainer');

        let settings = null;
        let installedApps = [];
        const iconCache = {}; // path -> dataURL | null

        const DOMAIN_REGEX = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

        async function persist(partial) {
            const result = await ipcRenderer.invoke('save-app-settings', partial);
            if (result && result.success) {
                settings = result.settings;
                if (partial.killSwitchEnabled && result.killSwitchApplied === false) {
                    alert('Kill switch could not be enabled. Try running the app as administrator.');
                }
            }
            return result;
        }

        function renderWebsiteChips() {
            websiteChipList.innerHTML = '';
            const sites = (settings && settings.excludedWebsites) || [];
            websiteEmptyState.style.display = sites.length === 0 ? 'block' : 'none';

            sites.forEach((site) => {
                const chip = document.createElement('div');
                chip.className = 'settings-chip';
                chip.innerHTML = `<span>${site}</span>`;

                const removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.innerText = '✕';
                removeBtn.onclick = async () => {
                    const updated = sites.filter(s => s !== site);
                    await persist({ excludedWebsites: updated });
                    renderWebsiteChips();
                };
                chip.appendChild(removeBtn);
                websiteChipList.appendChild(chip);
            });
        }

        async function addWebsite() {
            const raw = websiteInput.value.trim().toLowerCase()
                .replace(/^https?:\/\//, '')
                .replace(/^www\./, '')
                .replace(/\/.*$/, '');

            if (!raw) return;
            if (!DOMAIN_REGEX.test(raw)) {
                alert('Enter a valid domain, e.g. netflix.com');
                return;
            }

            const current = (settings && settings.excludedWebsites) || [];
            if (current.includes(raw)) {
                websiteInput.value = '';
                return;
            }

            await persist({ excludedWebsites: [...current, raw] });
            websiteInput.value = '';
            renderWebsiteChips();
        }

        addWebsiteBtn.onclick = addWebsite;
        websiteInput.onkeydown = (e) => {
            if (e.key === 'Enter') addWebsite();
        };

        function isAppExcluded(appId) {
            return ((settings && settings.excludedApps) || []).some(a => a.id === appId);
        }

        async function toggleApp(app, checked) {
            const current = (settings && settings.excludedApps) || [];
            const updated = checked
                ? [...current, {
                    id: app.id,
                    name: app.name,
                    publisher: app.publisher,
                    installLocation: app.installLocation,
                    iconPath: app.iconPath
                }]
                : current.filter(a => a.id !== app.id);
            await persist({ excludedApps: updated });
        }

        function cleanIconPath(raw) {
            if (!raw || typeof raw !== 'string') return null;
            // Registry often stores "C:\\Path\\app.exe,0"
            return raw.replace(/^"|"$/g, '').split(',')[0].trim() || null;
        }

        async function resolveAppIcon(app) {
            const path = cleanIconPath(app.iconPath);
            if (!path) return null;
            if (Object.prototype.hasOwnProperty.call(iconCache, path)) {
                return iconCache[path];
            }
            try {
                const res = await ipcRenderer.invoke('get-app-icon', path);
                const dataUrl = (res && res.success && res.dataUrl) ? res.dataUrl : null;
                iconCache[path] = dataUrl;
                return dataUrl;
            } catch (e) {
                iconCache[path] = null;
                return null;
            }
        }

        function renderAppList() {
            const query = appSearchInput.value.trim().toLowerCase();
            const filtered = query
                ? installedApps.filter(a =>
                    a.name.toLowerCase().includes(query) ||
                    (a.publisher || '').toLowerCase().includes(query)
                )
                : installedApps;

            appListContainer.innerHTML = '';

            if (filtered.length === 0) {
                appListContainer.innerHTML = `<p class="settings-empty" style="padding:20px;">No apps match “${query || ''}”.</p>`;
                return;
            }

            filtered.forEach((app) => {
                const row = document.createElement('div');
                row.className = 'settings-app-row';

                const checked = isAppExcluded(app.id);
                const iconId = `app-icon-${app.id.replace(/[^a-zA-Z0-9_-]/g, '')}`;

                row.innerHTML = `
                    <div class="settings-app-left">
                        <div id="${iconId}" class="settings-app-icon-fallback">📦</div>
                        <div style="min-width:0;">
                            <div class="settings-app-name" title="${app.name}">${app.name}</div>
                            <div class="settings-app-pub">${app.publisher || 'Unknown publisher'}</div>
                        </div>
                    </div>
                    <label class="switch">
                        <input type="checkbox" class="app-exclude-checkbox" ${checked ? 'checked' : ''} />
                        <span class="slider"></span>
                    </label>
                `;

                const checkbox = row.querySelector('.app-exclude-checkbox');
                checkbox.onchange = (e) => toggleApp(app, e.target.checked);

                appListContainer.appendChild(row);

                // Load real icon async
                resolveAppIcon(app).then((dataUrl) => {
                    if (!dataUrl) return;
                    const holder = document.getElementById(iconId);
                    if (!holder) return;
                    const img = document.createElement('img');
                    img.className = 'settings-app-icon';
                    img.src = dataUrl;
                    img.alt = '';
                    img.onerror = () => {};
                    holder.replaceWith(img);
                });
            });
        }

        appSearchInput.oninput = renderAppList;

        async function loadInstalledApps() {
            appListContainer.innerHTML = `<p class="settings-empty" style="padding:24px;">Loading installed apps…</p>`;
            const result = await ipcRenderer.invoke('get-installed-apps');
            installedApps = (result && result.success) ? result.apps : [];
            if (installedApps.length === 0) {
                appListContainer.innerHTML = `<p class="settings-empty" style="padding:20px; color: var(--accent-red);">Could not read installed apps.</p>`;
                return;
            }
            renderAppList();
        }

        function applySettingsToUI() {
            toggleAutoConnect.checked = !!settings.autoConnectOnLaunch;
            toggleLaunchOnStartup.checked = !!settings.launchOnStartup;
            toggleKillSwitch.checked = !!settings.killSwitchEnabled;
            toggleDnsProtection.checked = !!settings.dnsLeakProtection;

            const dns = settings.customDnsServers || [];
            dnsPrimaryInput.value = dns[0] || '';
            dnsSecondaryInput.value = dns[1] || '';

            renderWebsiteChips();
        }

        toggleAutoConnect.onchange = (e) => persist({ autoConnectOnLaunch: e.target.checked });
        toggleLaunchOnStartup.onchange = (e) => persist({ launchOnStartup: e.target.checked });
        toggleKillSwitch.onchange = (e) => persist({ killSwitchEnabled: e.target.checked });
        toggleDnsProtection.onchange = (e) => persist({ dnsLeakProtection: e.target.checked });

        saveDnsBtn.onclick = () => {
            const servers = [dnsPrimaryInput.value.trim(), dnsSecondaryInput.value.trim()].filter(Boolean);
            persist({ customDnsServers: servers });
        };

        (async () => {
            const result = await ipcRenderer.invoke('get-app-settings');
            settings = (result && result.success) ? result.settings : {
                autoConnectOnLaunch: false,
                launchOnStartup: false,
                killSwitchEnabled: false,
                dnsLeakProtection: true,
                customDnsServers: [],
                excludedApps: [],
                excludedWebsites: []
            };
            applySettingsToUI();
            loadInstalledApps();
        })();

        window.currentScreenCleanup = null;
    }
};

module.exports = SettingsScreen;