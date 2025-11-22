/**
 * Modal Manager - Handles modal popup lifecycle and simulator loading
 */
class ModalManager {
    constructor() {
        this.currentSimulator = null;
        this.simulators = {};
        this.setupModal();
    }

    setupModal() {
        const modalHTML = `
            <div id="visualizationModal" class="modal-overlay">
                <div class="modal-container">
                    <div class="modal-header">
                        <h2 id="modalTitle">
                            <span id="modalIcon"></span>
                            <span id="modalTitleText"></span>
                        </h2>
                        <button class="modal-close" id="closeModal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="control-panel">
                            <h3 style="color: white; margin-bottom: 20px;">⚙️ Controls</h3>
                            
                            <label>
                                Number of Processes/Threads:
                                <input type="number" id="processCount" min="2" max="10" value="4">
                            </label>

                            <label>
                                Speed:
                                <input type="range" id="speedControl" min="100" max="2000" value="1000" step="100">
                                <span id="speedLabel" style="color: #4caf50;">Normal</span>
                            </label>

                            <div class="control-buttons">
                                <button id="startBtn" class="btn btn-success">▶ Start</button>
                                <button id="pauseBtn" class="btn btn-warning" disabled>⏸ Pause</button>
                                <button id="resumeBtn" class="btn btn-info" disabled>▶ Resume</button>
                                <button id="stepBtn" class="btn btn-secondary">⏭ Step</button>
                                <button id="resetBtn" class="btn btn-danger">🔄 Reset</button>
                                <button id="exportBtn" class="btn btn-secondary">📥 Export</button>
                            </div>

                            <div id="statsPanel" style="margin-top: 20px; padding: 15px; background: rgba(255,255,255,0.05); border-radius: 8px;">
                                <h4 style="color: #4caf50; margin-bottom: 10px;">📊 Statistics</h4>
                                <div id="statsContent" style="color: #aaa; font-size: 12px;"></div>
                            </div>
                        </div>

                        <div class="visualization-canvas" id="visualizationCanvas"></div>

                        <div class="console-panel">
                            <div class="console-header">
                                <h3>🖥️ Developer Console</h3>
                                <button id="clearConsole" class="btn btn-secondary" style="padding: 5px 10px; font-size: 12px;">Clear</button>
                            </div>
                            <div class="console-tabs">
                                <button class="active" data-tab="log">Event Log</button>
                                <button data-tab="states">Process States</button>
                                <button data-tab="code">System Calls</button>
                            </div>
                            <div class="console-content" id="consoleContent"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.setupEventListeners();
    }

    setupEventListeners() {
        const modal = document.getElementById('visualizationModal');
        const closeBtn = document.getElementById('closeModal');

        closeBtn.addEventListener('click', () => this.close());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.close();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('active')) {
                this.close();
            }
        });

        // Control buttons
        document.getElementById('startBtn').addEventListener('click', () => {
            if (this.currentSimulator) {
                const count = parseInt(document.getElementById('processCount').value);
                this.currentSimulator.start(count);
                document.getElementById('startBtn').disabled = true;
                document.getElementById('pauseBtn').disabled = false;
                document.getElementById('stepBtn').disabled = true;
            }
        });

        document.getElementById('pauseBtn').addEventListener('click', () => {
            if (this.currentSimulator) {
                this.currentSimulator.pause();
                document.getElementById('pauseBtn').disabled = true;
                document.getElementById('resumeBtn').disabled = false;
            }
        });

        document.getElementById('resumeBtn').addEventListener('click', () => {
            if (this.currentSimulator) {
                this.currentSimulator.resume();
                document.getElementById('resumeBtn').disabled = true;
                document.getElementById('pauseBtn').disabled = false;
            }
        });

        document.getElementById('stepBtn').addEventListener('click', () => {
            if (this.currentSimulator) this.currentSimulator.step();
        });

        document.getElementById('resetBtn').addEventListener('click', () => {
            if (this.currentSimulator) {
                this.currentSimulator.reset();
                document.getElementById('startBtn').disabled = false;
                document.getElementById('pauseBtn').disabled = true;
                document.getElementById('resumeBtn').disabled = true;
                document.getElementById('stepBtn').disabled = false;
            }
        });

        document.getElementById('exportBtn').addEventListener('click', () => {
            if (this.currentSimulator) this.currentSimulator.exportLog();
        });

        document.getElementById('clearConsole').addEventListener('click', () => {
            document.getElementById('consoleContent').innerHTML = '';
        });

        document.getElementById('speedControl').addEventListener('input', (e) => {
            const speed = parseInt(e.target.value);
            const label = document.getElementById('speedLabel');
            
            if (speed < 500) label.textContent = 'Very Fast';
            else if (speed < 1000) label.textContent = 'Fast';
            else if (speed < 1500) label.textContent = 'Normal';
            else label.textContent = 'Slow';

            if (this.currentSimulator) {
                this.currentSimulator.setSpeed(speed);
            }
        });

        // Console tabs
        document.querySelectorAll('.console-tabs button').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.console-tabs button').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                
                if (this.currentSimulator) {
                    this.currentSimulator.switchTab(e.target.dataset.tab);
                }
            });
        });
    }

    open(type, icon, title) {
        const modal = document.getElementById('visualizationModal');
        document.getElementById('modalIcon').textContent = icon;
        document.getElementById('modalTitleText').textContent = title;
        
        document.getElementById('visualizationCanvas').innerHTML = '';
        document.getElementById('consoleContent').innerHTML = '';
        document.getElementById('statsContent').innerHTML = '';
        
        document.getElementById('startBtn').disabled = false;
        document.getElementById('pauseBtn').disabled = true;
        document.getElementById('resumeBtn').disabled = true;
        document.getElementById('stepBtn').disabled = false;
        
        this.loadSimulator(type);
        
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    loadSimulator(type) {
        if (this.currentSimulator) {
            this.currentSimulator.destroy();
        }

        switch(type) {
            case 'mutex_lock':
                this.currentSimulator = new MutexLockSimulator();
                break;
            case 'binary_semaphore':
                this.currentSimulator = new BinarySemaphoreSimulator();
                break;
            case 'counting_semaphore':
                this.currentSimulator = new CountingSemaphoreSimulator();
                break;
            case 'spinlock':
                this.currentSimulator = new SpinlockSimulator();
                break;
            case 'reader_writer_lock':
                this.currentSimulator = new ReaderWriterLockSimulator();
                break;
            case 'anonymous_pipe':
                this.currentSimulator = new AnonymousPipeSimulator();
                break;
            case 'named_pipe':
                this.currentSimulator = new NamedPipeSimulator();
                break;
            case 'shared_memory':
                this.currentSimulator = new SharedMemorySimulator();
                break;
            case 'message_queue':
                this.currentSimulator = new MessageQueueSimulator();
                break;
        }

        if (this.currentSimulator) {
            this.currentSimulator.init();
        }
    }

    close() {
        if (this.currentSimulator) {
            this.currentSimulator.destroy();
            this.currentSimulator = null;
        }
        
        const modal = document.getElementById('visualizationModal');
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
}
