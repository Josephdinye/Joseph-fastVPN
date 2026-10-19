function ensureNotifyStyles() {
  if (document.getElementById('jf-notify-styles')) return;
  const style = document.createElement('style');
  style.id = 'jf-notify-styles';
  style.textContent = `
    #jf-toast-host {
      position: fixed; right: 16px; bottom: 16px; z-index: 100000;
      display: flex; flex-direction: column; gap: 8px; max-width: min(360px, 92vw);
      pointer-events: none;
    }
    .jf-toast {
      pointer-events: auto;
      background: #0f172a; border: 1px solid rgba(255,255,255,0.12);
      color: #e5e7eb; border-radius: 12px; padding: 12px 14px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.45);
      font-size: 13px; line-height: 1.45;
      animation: jfToastIn 0.2s ease;
    }
    .jf-toast.success { border-color: rgba(34,197,94,0.35); }
    .jf-toast.error { border-color: rgba(239,68,68,0.45); }
    .jf-toast.info { border-color: rgba(59,130,246,0.4); }
    .jf-toast-title { font-weight: 650; margin: 0 0 4px; font-size: 13px; }
    .jf-toast-msg { margin: 0; color: #cbd5e1; }
    @keyframes jfToastIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    #jf-modal-root {
      position: fixed; inset: 0; z-index: 100001;
      display: flex; align-items: center; justify-content: center;
    }
    #jf-modal-root .jf-modal-backdrop {
      position: absolute; inset: 0; background: rgba(0,0,0,0.62); backdrop-filter: blur(4px);
    }
    #jf-modal-root .jf-modal-card {
      position: relative; width: min(400px, 92vw); background: #0b1220;
      border: 1px solid rgba(255,255,255,0.12); border-radius: 16px;
      padding: 20px; color: #e5e7eb; box-shadow: 0 24px 60px rgba(0,0,0,0.5);
    }
    #jf-modal-root .jf-modal-title { margin: 0 0 8px; font-size: 17px; font-weight: 700; }
    #jf-modal-root .jf-modal-body { margin: 0 0 16px; font-size: 13px; line-height: 1.5; color: #cbd5e1; }
    #jf-modal-root .jf-modal-actions { display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap; }
    #jf-modal-root .jf-btn {
      border-radius: 10px; padding: 9px 14px; font-size: 13px; font-weight: 600; cursor: pointer; border: none;
    }
    #jf-modal-root .jf-btn-primary { background: #2563eb; color: #fff; }
    #jf-modal-root .jf-btn-ghost {
      background: transparent; color: #d1d5db; border: 1px solid rgba(255,255,255,0.14);
    }
  `;
  document.head.appendChild(style);
}

function toast(message, type = 'info', title = null, ms = 4200) {
  ensureNotifyStyles();
  let host = document.getElementById('jf-toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'jf-toast-host';
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  el.className = `jf-toast ${type}`;
  el.innerHTML = `
    ${title ? `<p class="jf-toast-title">${escapeHtml(title)}</p>` : ''}
    <p class="jf-toast-msg">${escapeHtml(message)}</p>
  `;
  host.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.25s';
    setTimeout(() => el.remove(), 280);
  }, ms);
}

function modal({ title, message, confirmText = 'OK', cancelText = null, force = false }) {
  ensureNotifyStyles();
  return new Promise((resolve) => {
    const existing = document.getElementById('jf-modal-root');
    if (existing) existing.remove();

    const root = document.createElement('div');
    root.id = 'jf-modal-root';
    root.innerHTML = `
      <div class="jf-modal-backdrop"></div>
      <div class="jf-modal-card" role="dialog" aria-modal="true">
        <h3 class="jf-modal-title">${escapeHtml(title || 'Notice')}</h3>
        <p class="jf-modal-body">${escapeHtml(message || '')}</p>
        <div class="jf-modal-actions">
          ${cancelText && !force ? `<button type="button" class="jf-btn jf-btn-ghost" data-act="cancel">${escapeHtml(cancelText)}</button>` : ''}
          <button type="button" class="jf-btn jf-btn-primary" data-act="ok">${escapeHtml(confirmText)}</button>
        </div>
      </div>
    `;
    document.body.appendChild(root);

    const close = (val) => {
      root.remove();
      resolve(val);
    };
    root.querySelector('[data-act="ok"]').onclick = () => close(true);
    const cancelBtn = root.querySelector('[data-act="cancel"]');
    if (cancelBtn) cancelBtn.onclick = () => close(false);
    if (!force) {
      root.querySelector('.jf-modal-backdrop').onclick = () => close(false);
    }
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function runUpdateCheck(ipcRenderer) {
  try {
    const info = await ipcRenderer.invoke('check-app-update');
    if (!info || !info.success || !info.updateAvailable) return;
    const ok = await modal({
      title: info.title || 'Update available',
      message: `${info.message || ''}\n\nYou: v${info.currentVersion} · Latest: v${info.latestVersion}`,
      confirmText: 'Download update',
      cancelText: info.force ? null : 'Later',
      force: !!info.force,
    });
    if (ok && info.downloadUrl) {
      await ipcRenderer.invoke('open-external-url', info.downloadUrl);
    }
  } catch (_) {}
}

module.exports = { toast, modal, runUpdateCheck };