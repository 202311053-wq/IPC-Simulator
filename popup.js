// ============================================================================
// POPUP MANAGER
// ============================================================================

class PopupManager {
    constructor() {
        this.popups = new Map();
        this.container = document.getElementById('popup-container');
        this.nextId = 1;
    }

    createPopup(ipcType) {
        const popupId = `popup-${this.nextId++}`;
        const popup = new Popup(popupId, ipcType, this);
        this.popups.set(popupId, popup);
        return popup;
    }

    closePopup(popupId) {
        const popup = this.popups.get(popupId);
        if (popup) {
            popup.destroy();
            this.popups.delete(popupId);
        }
    }

    closeAll() {
        this.popups.forEach((popup, id) => {
            popup.destroy();
        });
        this.popups.clear();
    }

    getPopupCount() {
        return this.popups.size;
    }
}

// ============================================================================
// POPUP CLASS
// ============================================================================

class Popup {
    constructor(popupId, ipcType, manager) {
        this.popupId = popupId;
        this.ipcType = ipcType;
        this.manager = manager;
        this.wsPopupId = null;
        this.events = [];
        this.isRunning = false;
        this.isPaused = false;
        this.speed = 1;
        this.stepMode = false;
        this.visualization = null;
        this.pendingEvents = [];
        
        // Position
        this.x = Math.random() * (window.innerWidth - 500);
        this.y = Math.random() * (window.innerHeight - 400);
        this.width = 700;
        this.height = 600;
        
        this.create();
        this.attachEventListeners();
    }

    create() {
        const container = document.getElementById('popup-container');
        
        this.element = document.createElement('div');
        this.element.className = 'popup-window';
        this.element.style.left = this.x + 'px';
        this.element.style.top = this.y + 'px';
        this.element.style.width = this.width + 'px';
        this.element.style.height = this.height + 'px';

        const ipcName = this.formatIpcName(this.ipcType);

        this.element.innerHTML = `
            <div class="popup-header">
                <div class="popup-title">🔬 ${ipcName} Visualization</div>
                <div class="popup-controls">
                    <button class="popup-btn" id="step-btn">⏭️ Step</button>
                    <button class="popup-btn" id="pause-btn">⏸️ Pause</button>
                    <button class="popup-btn" id="resume-btn">▶️ Resume</button>
                    <button class="popup-btn" id="restart-btn">🔁 Restart</button>
                    <button class="popup-btn" id="export-btn">📥 Export</button>
                    <button class="popup-close" id="close-btn">✕</button>
                </div>
            </div>
            <div class="popup-content">
                <div class="visualization-area">
                    <div class="visualization-canvas" id="canvas-${this.popupId}"></div>
                    <div class="controls-bar">
                        <div class="control-group">
                            <label class="control-label">Speed:</label>
                            <input type="range" class="control-slider" id="speed-${this.popupId}" min="0.5" max="3" step="0.5" value="1">
                        </div>
                        <div class="popup-status">
                            <span id="event-count-${this.popupId}">0</span> events
                            <span class="status-badge status-running" id="status-${this.popupId}">Running</span>
                        </div>
                    </div>
                </div>
                <div class="sidebar">
                    <div class="sidebar-panel">
                        <div class="panel-header">Info</div>
                        <div class="panel-content">
                            <div class="info-item">
                                <span class="info-label">Popup ID:</span>
                                <span class="info-value">${this.popupId}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">IPC Type:</span>
                                <span class="info-value">${ipcName}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Status:</span>
                                <span class="info-value" id="conn-status-${this.popupId}">Connecting...</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Events:</span>
                                <span class="info-value" id="event-total-${this.popupId}">0</span>
                            </div>
                        </div>
                    </div>
                    <div class="sidebar-panel">
                        <div class="panel-header">Event History</div>
                        <div class="panel-content">
                            <ul class="event-list" id="history-${this.popupId}"></ul>
                        </div>
                    </div>
                </div>
            </div>
            <div class="resize-handle"></div>
        `;

        container.appendChild(this.element);

        // Prepare canvas element and a lightweight visualization proxy to keep popup controls working
        const canvasElement = this.element.querySelector(`#canvas-${this.popupId}`);
        this.canvasElement = canvasElement;

        // Visualization proxy: will forward control methods to the loaded module
        this.visualization = {
            pause: () => { if (this.viz && typeof this.viz.pause === 'function') this.viz.pause(); },
            resume: () => { if (this.viz && typeof this.viz.resume === 'function') this.viz.resume(); },
            enqueueEvent: (evt) => { if (this.viz && typeof this.viz.handleEvent === 'function') return this.viz.handleEvent(evt); },
            step: () => { if (this.viz && typeof this.viz.step === 'function') return this.viz.step(); },
            clear: () => { if (this.viz && typeof this.viz.reset === 'function') return this.viz.reset(); },
            setSpeed: (s) => { if (this.viz && typeof this.viz.setSpeed === 'function') return this.viz.setSpeed(s); }
        };

        // Placeholder for loaded module and event handler
        this.viz = null;
        this.vizEventHandler = null;

        // Ensure visualization CSS is present (inject if absent)
        (function ensureVizCss() {
            const styles = ['/css/viz-common.css','/css/visualization.css'];
            styles.forEach(href => {
                if (![...document.styleSheets].some(s => s.href && s.href.endsWith(href.split('/').pop()))) {
                    const link = document.createElement('link');
                    link.rel = 'stylesheet';
                    link.href = href;
                    document.head.appendChild(link);
                }
            });
        })();

        // Initialize developer panel
        if (typeof DeveloperPanel !== 'undefined') {
            const sidebarContainer = this.element.querySelector('.sidebar');
            this.devPanel = new DeveloperPanel(this.popupId, this.ipcType);
            this.devPanel.create(sidebarContainer);
        }
    }

    attachEventListeners() {
        // Close button
        this.element.querySelector('#close-btn').addEventListener('click', () => {
            // Ask manager to cleanly close and remove this popup
            this.manager.closePopup(this.popupId);
        });

        // Control buttons
        // Pause: pause visualization playback and request backend pause for this popup
        this.element.querySelector('#pause-btn').addEventListener('click', () => {
            this.isPaused = true;
            this.visualization.pause();
            // Send targeted pause to backend for this popupId
            wsManager.send({ type: 'pause', popupId: this.popupId });
            this.updateStatus('Paused');
        });

        // Resume: resume visualization playback and request backend resume for this popup
        this.element.querySelector('#resume-btn').addEventListener('click', () => {
            this.isPaused = false;
            this.visualization.resume();
            wsManager.send({ type: 'resume', popupId: this.popupId });
            this.updateStatus('Running');
            // flush buffered events
            this._flushPendingEvents();
        });

        // Step: consume a single queued event (step-by-step timeline)
        this.element.querySelector('#step-btn').addEventListener('click', () => {
            // Ensure visualization is paused while stepping
            this.isPaused = true;
            this.visualization.pause();
            // If we have pending events buffer, process one; otherwise call module step
            if (this.pendingEvents.length > 0) {
                const ev = this.pendingEvents.shift();
                if (this.vizEventHandler) {
                    try { this.vizEventHandler(ev); } catch (e) { console.warn(e); }
                } else if (this.visualization && typeof this.visualization.handle === 'function') {
                    try { this.visualization.handle(ev); } catch (e) { console.warn(e); }
                }
            } else if (this.visualization && typeof this.visualization.step === 'function') {
                this.visualization.step();
            }
            this.updateStatus('Stepped');
        });

        // Restart: reset visualization, clear events, and re-run start_simulation
        this.element.querySelector('#restart-btn').addEventListener('click', () => {
            // Clear visualization and local event history
            if (this.visualization && typeof this.visualization.clear === 'function') {
                this.visualization.clear();
            }
            this.events = [];
            this.updateEventCount();
            const historyList = this.element.querySelector(`#history-${this.popupId}`);
            if (historyList) historyList.innerHTML = '';

            // Unregister old handlers to avoid duplicates
            try { wsManager.unregisterPopupHandlers(this.popupId); } catch (e) { /* ignore */ }

            // Ask backend to restart simulation for this popup
            this.updateStatus('Restarting');
            wsManager.send({ type: 'restart_simulation', ipcType: this.ipcType, popupId: this.popupId });

            // Re-register handlers and start simulation flow
            // Allow a short delay for backend to reset
            setTimeout(() => {
                this.startSimulation();
            }, 200);
        });

        this.element.querySelector('#export-btn').addEventListener('click', () => {
            this.exportLogs();
        });

        // Speed control
        // Immediate speed control while sliding
        const speedEl = this.element.querySelector(`#speed-${this.popupId}`);
        speedEl.addEventListener('input', (e) => {
            this.speed = parseFloat(e.target.value);
            this.visualization.setSpeed(this.speed);
        });
        // show value on hover/focus via title
        speedEl.title = 'Playback speed';

        // Make draggable
        this.makeDraggable();

        // Make resizable
        this.makeResizable();

        // Start: show configuration modal, then initialize module and start simulation
        this.showConfigAndStart();
    }

    async showConfigAndStart() {
        try {
            const modalData = await this.showConfigModal();
            // Load visualization module and call its init(container, modalData)
            await this.loadVizModule(modalData);
            // Now start simulation (backend spawn) - pass popupId so backend routes events to us
            this.startSimulation();
        } catch (e) {
            console.warn(`[Popup ${this.popupId}] Config canceled or failed:`, e);
            this.updateStatus('Canceled');
        }
    }

    showConfigModal() {
        return new Promise((resolve, reject) => {
            // Build a small modal overlay inside this popup to gather inputs
            const overlay = document.createElement('div');
            overlay.className = 'viz-config-overlay';

            const panel = document.createElement('div');
            panel.className = 'viz-config-panel';

            const title = document.createElement('h3');
            title.textContent = `${this.formatIpcName(this.ipcType)} — Configuration`;
            panel.appendChild(title);

            // Create fields depending on ipcType
            const form = document.createElement('form');
            form.className = 'viz-config-form';

            const makeNumberField = (name, label, min=1, max=64, def=2) => {
                const row = document.createElement('div'); row.className = 'viz-form-row';
                const lab = document.createElement('label'); lab.textContent = label; lab.htmlFor = name;
                const inp = document.createElement('input'); inp.type = 'number'; inp.id = name; inp.name = name; inp.min = min; inp.max = max; inp.value = def;
                row.appendChild(lab); row.appendChild(inp); return row;
            };

            // Default fields map
            switch (this.ipcType) {
                case 'mutex':
                    form.appendChild(makeNumberField('threads', 'Number of threads', 1, 64, 4));
                    break;
                case 'spinlock':
                    form.appendChild(makeNumberField('processes', 'Number of processes', 1, 32, 6));
                    break;
                case 'binary_semaphore':
                    form.appendChild(makeNumberField('processes', 'Processes (2-3 recommended)', 2, 6, 3));
                    break;
                case 'counting_semaphore':
                    form.appendChild(makeNumberField('initial', 'Initial permits', 0, 16, 3));
                    form.appendChild(makeNumberField('processes', 'Number of processes', 1, 32, 6));
                    break;
                case 'message_queue':
                    form.appendChild(makeNumberField('queue_size', 'Queue size', 1, 256, 8));
                    form.appendChild(makeNumberField('messages', 'Message count', 1, 100, 20));
                    break;
                case 'pipe':
                    form.appendChild(makeNumberField('writers', 'Number of writers', 1, 8, 1));
                    form.appendChild(makeNumberField('readers', 'Number of readers', 1, 8, 1));
                    break;
                case 'named_pipe':
                    form.appendChild(makeNumberField('writers', 'Number of writers', 1, 8, 2));
                    form.appendChild(makeNumberField('readers', 'Number of readers', 1, 8, 2));
                    break;
                case 'shared_memory':
                    form.appendChild(makeNumberField('readers', 'Number of readers', 1, 16, 2));
                    form.appendChild(makeNumberField('slots', 'Memory slots', 1, 64, 8));
                    break;
                case 'rw_lock':
                    form.appendChild(makeNumberField('readers', 'Reader threads', 1, 32, 3));
                    form.appendChild(makeNumberField('writers', 'Writer threads', 1, 16, 1));
                    break;
                default:
                    form.appendChild(makeNumberField('count', 'Count', 1, 32, 4));
                    break;
            }

            // Buttons
            const btnRow = document.createElement('div'); btnRow.className = 'viz-config-actions';
            const startBtn = document.createElement('button'); startBtn.type = 'submit'; startBtn.className='btn btn-primary'; startBtn.textContent = 'Start Visualization';
            const cancelBtn = document.createElement('button'); cancelBtn.type='button'; cancelBtn.className='btn btn-secondary'; cancelBtn.textContent='Cancel';
            btnRow.appendChild(startBtn); btnRow.appendChild(cancelBtn);
            form.appendChild(btnRow);

            panel.appendChild(form);
            overlay.appendChild(panel);
            this.element.appendChild(overlay);

            // Handlers
            cancelBtn.addEventListener('click', () => {
                overlay.remove(); reject(new Error('canceled'));
            });

            form.addEventListener('submit', (ev) => {
                ev.preventDefault();
                const data = {};
                new FormData(form).forEach((v,k) => { data[k] = Number(v); });
                overlay.remove(); resolve(data);
            });
        });
    }

    async loadVizModule(modalData) {
        try {
            const modulePath = `/js/visualizations/${this.ipcType}_viz.js`;
            const mod = await import(modulePath);
            const exported = (mod && mod.default) ? mod.default : mod;
            this.viz = exported;

            // dynamic import of the shared visual engine and attach to viz
            try {
                const engineMod = await import('/js/visualization_engine.js');
                this.visualizationEngine = engineMod && engineMod.default ? engineMod.default : engineMod;
                // attach engine helpers to viz if supported
                if (this.viz) {
                    this.viz.engine = this.visualizationEngine;
                }
            } catch (e) {
                console.warn('Failed to load visualization engine', e);
            }

            // Prepare the simulation DOM inside our canvas element so module find expected selectors
            this.canvasElement.innerHTML = `
                <div class="visualization-modal-body">
                    <div class="visualization-canvas-container">
                        <svg class="visualization-svg-canvas" id="viz-svg-${this.popupId}"></svg>
                    </div>
                    <div class="visualization-panel-container">
                        <div class="visualization-stats-panel" id="viz-stats-${this.popupId}"><h3>Stats</h3></div>
                        <div class="visualization-log-panel" id="viz-log-${this.popupId}"><h3>Event Log</h3></div>
                    </div>
                </div>
            `;

            // call init(container, modalData) and capture returned engine (if any)
            if (this.viz && typeof this.viz.init === 'function') {
                try {
                    const result = await this.viz.init(this.canvasElement, modalData);
                    // If module returned a VisualizationEngine instance, store it
                    if (result && typeof result.play === 'function') {
                        this.vizEngineInstance = result;
                        // map common engine controls
                        ['play','pause','stop','setSpeed','reset'].forEach(fn => {
                            if (typeof this.vizEngineInstance[fn] === 'function') {
                                const name = (fn === 'reset') ? 'clear' : fn;
                                this.visualization[name] = (...args) => this.vizEngineInstance[fn](...args);
                            }
                        });
                        // Auto-play the engine if available
                        try { if (typeof this.vizEngineInstance.play === 'function') this.vizEngineInstance.play(); } catch (e) { /* ignore */ }
                    }
                } catch (e) { console.error('viz init error', e); }
            }

            // Bind handler (accept both module-level handlers or engine-level handlers)
            if (this.viz && typeof this.viz.handleEvent === 'function') {
                this.vizEventHandler = (evt) => { try { return this.viz.handleEvent(evt); } catch (e) { console.warn('viz handler error', e); } };
            } else if (this.viz && typeof this.viz.processEvent === 'function') {
                this.vizEventHandler = (evt) => { try { return this.viz.processEvent(evt); } catch (e) { console.warn('viz handler error', e); } };
            } else if (this.vizEngineInstance && typeof this.vizEngineInstance.addEvent === 'function') {
                // map incoming events into simple engine actions (fallback)
                this.vizEventHandler = (evt) => {
                    try {
                        this.vizEngineInstance.addEvent(() => {
                            this.vizEngineInstance.logEvent(`${evt.event} (${evt.process})`, 'info');
                        }, 10);
                        return true;
                    } catch (e) { console.warn('engine event mapping error', e); }
                };
            } else {
                // final fallback: no-op handler that logs
                this.vizEventHandler = (evt) => { console.debug('No viz handler for event', evt); return false; };
            }

            console.log(`[Popup ${this.popupId}] Loaded visualization module: ${modulePath}`);
        } catch (err) {
            console.warn(`[Popup ${this.popupId}] Failed to load visualization module:`, err);
        }
    }

    startSimulation() {
        // ✅ CRITICAL: Use POPUP-SPECIFIC handlers, not global listeners
        // This ensures each popup receives ONLY its own events, with NO conflicts
        
        console.log(`[Popup ${this.popupId}] Registering isolated WebSocket handlers for: ${this.ipcType}`);

        // 1️⃣ Register popup-specific handler for UUID assignment (backend → popup)
        // This runs when backend assigns unique popupId to this popup
        wsManager.registerPopupHandler(this.popupId, "popup_connected", (data) => {
            this.wsPopupId = data.popupId;
            console.log(`[Popup ${this.popupId}] ✓ Backend assigned UUID: ${this.wsPopupId}`);
            this.updateConnectionStatus("Connected");
        });

        // 2️⃣ Register popup-specific handler for simulation events
        // Each event from backend includes popupId; this handler ONLY triggers for OUR popupId
        wsManager.registerPopupHandler(this.popupId, "event", (data) => {
            // This handler ONLY fires if backend routed message to this popup's handlers
            // So we KNOW data.popupId === this.wsPopupId (guaranteed by routing)
            console.log(`[Popup ${this.popupId}] ✓ Event received:`, data.event.event);
            this.handleEvent(data.event);
        });

        // 3️⃣ Register popup-specific handler for simulation completion
        wsManager.registerPopupHandler(this.popupId, "simulation_complete", (data) => {
            console.log(`[Popup ${this.popupId}] ✓ Simulation complete (${data.eventCount} events)`);
            this.updateStatus("Complete");
            this.updateConnectionStatus("Disconnected");
        });

        // 4️⃣ Register popup-specific handler for backend errors
        wsManager.registerPopupHandler(this.popupId, "error", (error) => {
            console.error(`[Popup ${this.popupId}] ✗ Backend error:`, error);
            this.updateConnectionStatus("Error");
        });

        // 5️⃣ Trigger backend to spawn IPC binary and stream events TO THIS POPUP
        console.log(`[Popup ${this.popupId}] → Sending start_simulation request for: ${this.ipcType}`);
        wsManager.send({
            type: "start_simulation",
            ipcType: this.ipcType,
            popupId: this.popupId  // ✅ Include popupId so backend knows where to route events
        });
    }

    _flushPendingEvents() {
        if (!this.pendingEvents || this.pendingEvents.length === 0) return;
        // process events in order, respecting a small delay for animations controlled by speed
        const delay = Math.max(10, 300 / (this.speed || 1));
        const toProcess = this.pendingEvents.slice();
        this.pendingEvents = [];
        toProcess.forEach((ev, idx) => {
            setTimeout(() => {
                try {
                    if (this.vizEventHandler) this.vizEventHandler(ev);
                    else if (this.visualization && typeof this.visualization.handle === 'function') this.visualization.handle(ev);
                } catch (e) { console.warn(e); }
                this.addEventToHistory(ev);
            }, idx * delay);
        });
    }


    handleEvent(event) {
        // Record the event locally for history and export
        this.events.push(event);
        this.updateEventCount();

        // If paused (and not stepping), buffer events locally and do not forward
        if (this.isPaused && !this.stepMode) {
            this.pendingEvents.push(event);
            // still show in history and dev panel
            this.addEventToHistory(event);
            if (this.devPanel) this.devPanel.log(`[${event.process}] ${event.event}: ${event.detail}`, 'info');
            return;
        }

        // Try module-specific handler first
        let handledByModule = false;
        if (this.vizEventHandler) {
            try {
                const res = this.vizEventHandler(event);
                if (res === true) handledByModule = true;
            } catch (e) {
                console.warn(`[Popup ${this.popupId}] Visualization module handler error:`, e);
            }
        } else if (this.viz && typeof this.viz.handle === 'function') {
            try { const r = this.viz.handle(event); if (r === true) handledByModule = true; } catch (e) { console.warn(e); }
        }

        if (!handledByModule) {
            // Forward to visualization engine or fallback handler
            if (this.visualization && typeof this.visualization.enqueueEvent === 'function') {
                this.visualization.enqueueEvent(event);
            } else if (this.visualization && typeof this.visualization.handle === 'function') {
                try { this.visualization.handle(event); } catch (e) { console.warn(e); }
            } else {
                try { processEvent(this.visualization, event); } catch (e) { /* ignore */ }
            }
        }

        // Add to history panel and developer log
        this.addEventToHistory(event);
        if (this.devPanel) this.devPanel.log(`[${event.process}] ${event.event}: ${event.detail}`, 'info');

        if (this.stepMode) {
            // After handling one event, remain paused until user steps again
            this.visualization.pause();
        }
    }

    addEventToHistory(event) {
        const historyList = this.element.querySelector(`#history-${this.popupId}`);
        const item = document.createElement('li');
        item.className = 'event-item';
        item.innerHTML = `
            <div class="event-type">${event.event}</div>
            <div class="event-process">${event.process}</div>
            <div class="event-detail">${event.detail}</div>
            <div class="event-time">${new Date(event.timestamp).toLocaleTimeString()}</div>
        `;
        historyList.appendChild(item);
        historyList.scrollTop = historyList.scrollHeight;

        // Keep only last 50 events
        while (historyList.children.length > 50) {
            historyList.removeChild(historyList.firstChild);
        }
    }

    updateEventCount() {
        this.element.querySelector(`#event-count-${this.popupId}`).textContent = this.events.length;
        this.element.querySelector(`#event-total-${this.popupId}`).textContent = this.events.length;
    }

    updateStatus(status) {
        const statusBadge = this.element.querySelector(`#status-${this.popupId}`);
        statusBadge.textContent = status;
    }

    updateConnectionStatus(status) {
        const statusEl = this.element.querySelector(`#conn-status-${this.popupId}`);
        statusEl.textContent = status;
    }

    makeDraggable() {
        let isDragging = false;
        let dragStartX = 0;
        let dragStartY = 0;

        const header = this.element.querySelector('.popup-header');
        
        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('.popup-btn') || e.target.closest('.popup-close')) return;
            isDragging = true;
            dragStartX = e.clientX - this.x;
            dragStartY = e.clientY - this.y;
            header.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            this.x = e.clientX - dragStartX;
            this.y = e.clientY - dragStartY;
            this.element.style.left = this.x + 'px';
            this.element.style.top = this.y + 'px';
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            header.style.cursor = 'grab';
        });
    }

    makeResizable() {
        let isResizing = false;
        let resizeStartX = 0;
        let resizeStartY = 0;

        const handle = this.element.querySelector('.resize-handle');

        handle.addEventListener('mousedown', (e) => {
            isResizing = true;
            resizeStartX = e.clientX;
            resizeStartY = e.clientY;
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            this.width += e.clientX - resizeStartX;
            this.height += e.clientY - resizeStartY;
            this.width = Math.max(400, this.width);
            this.height = Math.max(300, this.height);
            this.element.style.width = this.width + 'px';
            this.element.style.height = this.height + 'px';
            resizeStartX = e.clientX;
            resizeStartY = e.clientY;
        });

        document.addEventListener('mouseup', () => {
            isResizing = false;
        });
    }

    exportLogs() {
        const data = {
            ipcType: this.ipcType,
            popupId: this.popupId,
            exportTime: new Date().toISOString(),
            eventCount: this.events.length,
            events: this.events
        };

        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.ipcType}_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    formatIpcName(type) {
        const names = {
            mutex: 'Mutex Lock',
            binary_semaphore: 'Binary Semaphore',
            counting_semaphore: 'Counting Semaphore',
            spinlock: 'Spinlock',
            rw_lock: 'Reader-Writer Lock',
            pipe: 'Anonymous Pipe',
            named_pipe: 'Named Pipe (FIFO)',
            shared_memory: 'Shared Memory',
            message_queue: 'Message Queue'
        };
        return names[type] || type;
    }

    destroy() {
        // ✅ Clean up popup-specific WebSocket handlers to prevent memory leaks
        wsManager.unregisterPopupHandlers(this.popupId);
        console.log(`[Popup ${this.popupId}] WebSocket handlers unregistered and cleaned up`);
        
        if (this.element) {
            this.element.remove();
        }
        // Remove from manager map if present
        if (this.manager && this.manager.popups && this.manager.popups.has(this.popupId)) {
            this.manager.popups.delete(this.popupId);
        }
    }
}

// Initialize global popup manager
const popupManager = new PopupManager();
