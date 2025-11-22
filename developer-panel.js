// ============================================================================
// DEVELOPER PANEL
// ============================================================================

class DeveloperPanel {
    constructor(popupId, ipcType) {
        this.popupId = popupId;
        this.ipcType = ipcType;
        this.container = null;
        this.logs = [];
        this.maxLogs = 100;
    }

    create(parentContainer) {
        this.container = document.createElement('div');
        this.container.className = 'developer-panel';
        this.container.innerHTML = `
            <div class="dev-panel-header">
                <div class="dev-title">🛠️ Developer Console</div>
                <div class="dev-tabs">
                    <button class="dev-tab-btn active" data-tab="console">Console</button>
                    <button class="dev-tab-btn" data-tab="process">Process</button>
                    <button class="dev-tab-btn" data-tab="status">Status</button>
                </div>
            </div>
            
            <div class="dev-panel-content">
                <div id="console-tab" class="dev-tab active">
                    <div class="dev-console" id="dev-console-${this.popupId}"></div>
                </div>
                
                <div id="process-tab" class="dev-tab">
                    <div class="dev-process-info">
                        <div class="info-row">
                            <span class="label">Process ID:</span>
                            <span class="value" id="pid-${this.popupId}">--</span>
                        </div>
                        <div class="info-row">
                            <span class="label">IPC Type:</span>
                            <span class="value">${this.ipcType}</span>
                        </div>
                        <div class="info-row">
                            <span class="label">Status:</span>
                            <span class="value" id="status-${this.popupId}">Running</span>
                        </div>
                        <div class="info-row">
                            <span class="label">Memory:</span>
                            <span class="value" id="memory-${this.popupId}">0 MB</span>
                        </div>
                        <div class="info-row">
                            <span class="label">Start Time:</span>
                            <span class="value" id="start-time-${this.popupId}">-</span>
                        </div>
                    </div>
                </div>
                
                <div id="status-tab" class="dev-tab">
                    <div class="dev-status">
                        <div class="status-item">
                            <span class="label">WSL Status:</span>
                            <span class="status-badge" id="wsl-status">Checking...</span>
                        </div>
                        <div class="status-item">
                            <span class="label">Backend:</span>
                            <span class="status-badge status-connected" id="backend-status">Connected</span>
                        </div>
                        <div class="status-item">
                            <span class="label">WebSocket:</span>
                            <span class="status-badge status-connected" id="ws-status">Connected</span>
                        </div>
                        <div class="status-item">
                            <span class="label">Binary Location:</span>
                            <span class="status-value" id="binary-loc">../ipc_core/bin/${this.ipcType}_visual</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        parentContainer.appendChild(this.container);
        this.attachTabListeners();
        this.fetchStatus();
        this.setStartTime();
    }

    attachTabListeners() {
        const tabs = this.container.querySelectorAll('.dev-tab-btn');
        const contents = this.container.querySelectorAll('.dev-tab');
        
        tabs.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                
                tabs.forEach(t => t.classList.remove('active'));
                contents.forEach(c => c.classList.remove('active'));
                
                e.target.classList.add('active');
                document.getElementById(`${tabName}-tab`).classList.add('active');
            });
        });
    }

    log(message, level = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = { timestamp, message, level };
        this.logs.push(logEntry);
        
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
        
        const console = document.getElementById(`dev-console-${this.popupId}`);
        if (console) {
            const line = document.createElement('div');
            line.className = `console-line level-${level}`;
            line.innerHTML = `<span class="timestamp">${timestamp}</span> <span class="message">${this.escapeHtml(message)}</span>`;
            console.appendChild(line);
            console.scrollTop = console.scrollHeight;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    setStartTime() {
        const timeEl = document.getElementById(`start-time-${this.popupId}`);
        if (timeEl) {
            timeEl.textContent = new Date().toLocaleTimeString();
        }
    }

    fetchStatus() {
        fetch('/api/status')
            .then(r => r.json())
            .then(data => {
                const wslEl = document.getElementById('wsl-status');
                if (wslEl) {
                    if (data.wslAvailable) {
                        wslEl.className = 'status-badge status-connected';
                        wslEl.textContent = 'Available';
                    } else {
                        wslEl.className = 'status-badge status-disconnected';
                        wslEl.textContent = 'Not Detected';
                    }
                }
                
                this.log(`System Status: WSL=${data.wslAvailable ? 'Yes' : 'No'}, Connections=${data.activeConnections}`, 'info');
            })
            .catch(err => {
                this.log(`Failed to fetch status: ${err.message}`, 'error');
            });
    }

    updateStatus(status) {
        const el = document.getElementById(`status-${this.popupId}`);
        if (el) el.textContent = status;
    }

    updateMemory(bytes) {
        const el = document.getElementById(`memory-${this.popupId}`);
        if (el) el.textContent = (bytes / 1024 / 1024).toFixed(2) + ' MB';
    }
}

// Export for use in popup.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DeveloperPanel;
}
