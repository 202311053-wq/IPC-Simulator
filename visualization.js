// ============================================================================
// ADVANCED ANIMATION ENGINE - Complete Rewrite
// ============================================================================

class AnimationController {
    constructor() {
        this.animations = [];
        this.isRunning = false;
        this.isPaused = false;
        this.speed = 1;
        this.animationFrameId = null;
    }

    addAnimation(animation) {
        this.animations.push({
            ...animation,
            startTime: Date.now(),
            progress: 0,
            complete: false
        });
    }

    setSpeed(speed) {
        this.speed = Math.max(0.1, speed);
    }

    pause() {
        this.isPaused = true;
    }

    resume() {
        this.isPaused = false;
    }

    step() {
        if (this.animations.length === 0) return;
        const animation = this.animations[0];
        animation.progress = Math.min(1, animation.progress + 0.2);
        animation.onUpdate?.(animation.progress);
        if (animation.progress >= 1) {
            animation.onComplete?.();
            this.animations.shift();
        }
    }

    update() {
        if (this.isPaused) return;

        const now = Date.now();
        for (let i = this.animations.length - 1; i >= 0; i--) {
            const anim = this.animations[i];
            const elapsed = now - anim.startTime;
            const duration = anim.duration / this.speed;
            anim.progress = Math.min(1, elapsed / duration);

            anim.onUpdate?.(anim.progress);

            if (anim.progress >= 1) {
                anim.onComplete?.();
                this.animations.splice(i, 1);
            }
        }
    }

    clear() {
        this.animations = [];
    }
}

// ============================================================================
// VISUALIZATION ENGINE - Completely Rewritten
// ============================================================================

class VisualizationEngine {
    constructor(container) {
        this.container = container;
        this.ipcType = null;
        this.svg = null;
        this.processes = new Map();
        this.animController = new AnimationController();
        this.speed = 1;
        this.uniqueProcesses = new Set();
        this.state = {
            lockHolder: null,
            queueItems: [],
            memoryValues: {},
            activeReaders: new Set(),
            activeWriter: null
        };

        this.eventQueue = [];
        this._lastEventTime = {};
        this.playbackTimer = null;
        this.playbackIntervalBase = 200;

        this.setupSVG();
        this.startAnimationLoop();
        this.startPlaybackLoop();
    }

    setupSVG() {
        this.container.innerHTML = '';
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.setAttribute('viewBox', '0 0 1000 600');
        svg.style.cssText = 'background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); display: block;';
        
        this.container.appendChild(svg);
        this.svg = svg;

        // Add defs for gradients and markers
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        defs.innerHTML = `
            <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                <polygon points="0 0, 10 3, 0 6" fill="#333" />
            </marker>
            <linearGradient id="processGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
            </linearGradient>
            <linearGradient id="lockGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#f093fb;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#f5576c;stop-opacity:1" />
            </linearGradient>
        `;
        this.svg.appendChild(defs);
    }

    setIpcType(ipcType) {
        this.ipcType = ipcType;
        this.renderLayout();
    }

    renderLayout() {
        const layouts = {
            mutex: () => this.renderMutexLayout(),
            binary_semaphore: () => this.renderMutexLayout(),
            counting_semaphore: () => this.renderSemaphoreLayout(),
            spinlock: () => this.renderMutexLayout(),
            rw_lock: () => this.renderRWLockLayout(),
            pipe: () => this.renderPipeLayout(),
            named_pipe: () => this.renderPipeLayout(),
            shared_memory: () => this.renderSharedMemoryLayout(),
            message_queue: () => this.renderMessageQueueLayout()
        };

        layouts[this.ipcType]?.();
    }

    renderMutexLayout() {
        // Central lock icon
        const lockGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        lockGroup.id = 'lock-center';
        lockGroup.innerHTML = `
            <rect x="450" y="250" width="100" height="120" rx="10" fill="url(#lockGradient)" stroke="#333" stroke-width="2"/>
            <rect x="470" y="240" width="60" height="30" rx="5" fill="none" stroke="#333" stroke-width="2"/>
            <rect x="492" y="282" width="16" height="26" rx="2" fill="#333"/>
            <text x="500" y="350" text-anchor="middle" font-size="14" font-weight="bold" fill="#333">LOCK</text>
        `;
        this.svg.appendChild(lockGroup);

        // Process nodes around lock
        this.renderProcessNodes([
            { name: 'parent', x: 150, y: 150 },
            { name: 'child', x: 850, y: 150 },
            { name: 'process3', x: 150, y: 450 },
            { name: 'process4', x: 850, y: 450 }
        ]);

        // Queue visualization for waiting processes
        this.renderWaitingQueue();
    }

    renderSemaphoreLayout() {
        // Semaphore counter display
        const semGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        semGroup.id = 'semaphore-display';
        semGroup.innerHTML = `
            <rect x="400" y="240" width="200" height="120" rx="10" fill="#e8f4f8" stroke="#0277bd" stroke-width="2"/>
            <text x="500" y="275" text-anchor="middle" font-size="14" font-weight="bold" fill="#0277bd">Semaphore Count</text>
            <rect class="sem-count" x="470" y="305" width="60" height="40" rx="6" fill="#0277bd"/>
            <text class="sem-count-text" x="500" y="332" text-anchor="middle" font-size="18" font-weight="bold" fill="white">3</text>
        `;
        this.svg.appendChild(semGroup);

        this.renderProcessNodes([
            { name: 'parent', x: 150, y: 150 },
            { name: 'child1', x: 850, y: 150 },
            { name: 'child2', x: 150, y: 450 },
            { name: 'child3', x: 850, y: 450 }
        ]);
    }

    renderRWLockLayout() {
        // Reader/Writer sections
        const rwGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        rwGroup.id = 'rw-layout';
        rwGroup.innerHTML = `
            <rect x="350" y="200" width="300" height="200" rx="6" fill="#f3f0fb" stroke="#7b1fa2" stroke-width="2"/>
            <text x="500" y="230" text-anchor="middle" font-size="16" font-weight="bold" fill="#7b1fa2">Protected Resource</text>
            <rect class="rw-slot" x="420" y="270" width="30" height="30" rx="4" fill="#2196f3" opacity="0.7"/>
            <rect class="rw-slot" x="485" y="270" width="30" height="30" rx="4" fill="#2196f3" opacity="0.7"/>
            <rect class="rw-slot" x="550" y="270" width="30" height="30" rx="4" fill="#2196f3" opacity="0.7"/>
            <text x="500" y="360" text-anchor="middle" font-size="12" fill="#7b1fa2">Readers: 0</text>
        `;
        this.svg.appendChild(rwGroup);

        this.renderProcessNodes([
            { name: 'reader1', x: 100, y: 100 },
            { name: 'reader2', x: 250, y: 100 },
            { name: 'writer', x: 900, y: 300 }
        ]);
    }

    renderPipeLayout() {
        // Horizontal pipe
        const pipeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        pipeGroup.id = 'pipe-visual';
        pipeGroup.innerHTML = `
            <defs>
                <pattern id="pipePattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                    <line x1="0" y1="0" x2="20" y2="20" stroke="#ccc" stroke-width="1"/>
                </pattern>
            </defs>
            <rect x="150" y="270" width="700" height="60" rx="30" fill="url(#pipePattern)" stroke="#666" stroke-width="2"/>
            <text x="500" y="310" text-anchor="middle" font-size="12" fill="#333">Pipe Buffer</text>
        `;
        this.svg.appendChild(pipeGroup);

        this.renderProcessNodes([
            { name: 'parent', x: 100, y: 150 },
            { name: 'child', x: 900, y: 150 }
        ]);
    }

    renderSharedMemoryLayout() {
        // Memory grid
        const memGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        memGroup.id = 'memory-grid';
        
        let cellHTML = '';
        for (let i = 0; i < 8; i++) {
            const x = 300 + (i * 70);
            cellHTML += `
                <g class="memory-cell" data-index="${i}">
                    <rect x="${x}" y="250" width="60" height="60" rx="5" fill="#fff9c4" stroke="#f57f17" stroke-width="2"/>
                    <text x="${x + 30}" y="290" text-anchor="middle" font-size="12" font-weight="bold" fill="#333">0</text>
                </g>
            `;
        }
        memGroup.innerHTML = cellHTML + `<text x="500" y="350" text-anchor="middle" font-size="12" fill="#666">Shared Memory (8 bytes)</text>`;
        this.svg.appendChild(memGroup);

        this.renderProcessNodes([
            { name: 'parent', x: 150, y: 450 },
            { name: 'child', x: 850, y: 450 }
        ]);
    }

    renderMessageQueueLayout() {
        // Queue visualization
        const queueGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        queueGroup.id = 'message-queue';
        queueGroup.innerHTML = `
            <rect x="300" y="240" width="400" height="100" rx="5" fill="#e3f2fd" stroke="#1976d2" stroke-width="2"/>
            <text x="500" y="265" text-anchor="middle" font-size="14" font-weight="bold" fill="#1976d2">Message Queue (FIFO)</text>
            <text x="320" y="295" font-size="11" fill="#666">[Empty]</text>
        `;
        this.svg.appendChild(queueGroup);

        this.renderProcessNodes([
            { name: 'sender', x: 100, y: 450 },
            { name: 'receiver', x: 900, y: 450 }
        ]);
    }

    renderProcessNodes(nodeConfigs) {
        const nodesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        nodesGroup.id = 'process-nodes';

        nodeConfigs.forEach(config => {
            // Only add if not already added (fix duplicate System issue)
            if (!this.uniqueProcesses.has(config.name)) {
                this.uniqueProcesses.add(config.name);

                const nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                nodeGroup.id = `node-${config.name}`;
                nodeGroup.setAttribute('data-process', config.name);
                // Place children at origin and position group via transform for easy animation
                nodeGroup.setAttribute('transform', `translate(${config.x}, ${config.y})`);
                nodeGroup.innerHTML = `
                    <rect class="process-rect" x="-80" y="-20" width="160" height="40" rx="6" fill="#9E9E9E" stroke="#333" stroke-width="1" />
                    <text x="-70" y="0" text-anchor="start" font-size="12" font-weight="600" fill="#fff">${config.name.charAt(0).toUpperCase() + config.name.slice(1)}</text>
                    <text x="70" y="0" text-anchor="end" font-size="11" fill="#fff" class="process-state">Idle</text>
                `;

                nodesGroup.appendChild(nodeGroup);
                this.processes.set(config.name, { x: config.x, y: config.y, state: 'idle' });
            }
        });

        this.svg.appendChild(nodesGroup);
    }

    renderWaitingQueue() {
        const queueGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        queueGroup.id = 'waiting-queue';
        queueGroup.innerHTML = `
            <text x="500" y="520" text-anchor="middle" font-size="12" fill="#666" class="queue-text">Waiting: None</text>
        `;
        this.svg.appendChild(queueGroup);
    }

    processEvent(event) {
        // New: enqueue/playback wrapper (deprecated direct processing)
        // For backward compatibility, calling processEvent will enqueue into the playback queue
        this.enqueueEvent(event);
    }

    // Enqueue incoming events for buffered playback. Playback respects pause/resume/step and
    // rate-limits high-frequency events (e.g., spinlock) to avoid flooding the renderer.
    enqueueEvent(event) {
        if (!event) return;
        const { event: eventType, process } = event;

        // Skip duplicate 'initialized' events (prevents repeated System additions)
        if (eventType === 'initialized') return;

        // Throttle high-frequency events for spinlock
        const now = Date.now();
        const key = `${process || 'anon'}::${eventType}`;
        if (!this._lastEventTime) this._lastEventTime = {};
        const last = this._lastEventTime[key] || 0;
        const minInterval = (this.ipcType === 'spinlock') ? 100 : 0; // ms
        if (minInterval && (now - last) < minInterval) {
            // Drop or aggregate high-frequency spin events to keep UI responsive
            return;
        }
        this._lastEventTime[key] = now;

        // Ensure process node exists now (de-duplicated by uniqueProcesses)
        if (process && !this.uniqueProcesses.has(process)) {
            const nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            nodeGroup.id = `node-${process}`;
            nodeGroup.setAttribute('data-process', process);
            const x = 200 + Math.random() * 600;
            const y = 200 + Math.random() * 200;
            nodeGroup.setAttribute('transform', `translate(${x}, ${y})`);
            nodeGroup.innerHTML = `
                <rect class="process-rect" x="-80" y="-20" width="160" height="40" rx="6" fill="#9E9E9E" stroke="#333" stroke-width="1" />
                <text x="-70" y="0" text-anchor="start" font-size="12" font-weight="600" fill="#fff">${process.charAt(0).toUpperCase() + process.slice(1)}</text>
                <text x="70" y="0" text-anchor="end" font-size="11" fill="#fff" class="process-state">Idle</text>
            `;
            this.svg.appendChild(nodeGroup);
            this.processes.set(process, { x, y, state: 'idle' });
            this.uniqueProcesses.add(process);
        }

        // Push to queue
        if (!this.eventQueue) this.eventQueue = [];
        this.eventQueue.push(event);
    }

    // Internal: process one event immediately (consumes from queue playback loop)
    _handleEventNow(event) {
        if (!event) return;
        const { event: eventType, process, detail } = event;

        // Route to type-specific animation methods
        const animators = {
            mutex: () => this.animateMutexEvent(eventType, process),
            binary_semaphore: () => this.animateMutexEvent(eventType, process),
            counting_semaphore: () => this.animateSemaphoreEvent(eventType, process, detail),
            spinlock: () => this.animateMutexEvent(eventType, process),
            rw_lock: () => this.animateRWLockEvent(eventType, process),
            pipe: () => this.animatePipeEvent(eventType, process, detail),
            named_pipe: () => this.animatePipeEvent(eventType, process, detail),
            shared_memory: () => this.animateSharedMemoryEvent(eventType, process, detail),
            message_queue: () => this.animateMessageQueueEvent(eventType, process, detail)
        };

        animators[this.ipcType]?.();
        this.updateProcessState(process, eventType);
    }

    startPlaybackLoop() {
        // Base interval controls how quickly events are consumed; scaled by speed
        this.playbackIntervalBase = 200; // ms
        if (this.playbackTimer) clearInterval(this.playbackTimer);
        this.playbackTimer = setInterval(() => {
            if (this.animController.isPaused) return;
            if (!this.eventQueue || this.eventQueue.length === 0) return;
            const evt = this.eventQueue.shift();
            if (evt) this._handleEventNow(evt);
        }, Math.max(20, this.playbackIntervalBase / Math.max(0.1, this.speed)));
    }

    animateMutexEvent(eventType, process) {
        const node = this.processes.get(process);
        if (!node) return;

        const lockCenter = { x: 500, y: 310 };

        switch (eventType) {
            case 'lock_acquired':
                this.animateLockAcquisition(node, lockCenter, process);
                break;
            case 'lock_released':
                this.animateLockRelease(node, lockCenter);
                break;
            case 'waiting':
                this.animateWaiting(node, lockCenter, process);
                break;
            case 'spin_wait':
                // Spinlock-style busy-waiting: flash the process lane to indicate attempts
                const nodeElSpin = this.svg.querySelector(`#node-${process}`);
                if (nodeElSpin) {
                    const rectSpin = nodeElSpin.querySelector('rect.process-rect');
                    if (rectSpin) {
                        this.animController.addAnimation({
                            duration: 300,
                            onUpdate: (p) => {
                                const val = p < 0.5 ? '#FFC107' : '#9E9E9E';
                                rectSpin.setAttribute('fill', val);
                            },
                            onComplete: () => rectSpin.setAttribute('fill', '#9E9E9E')
                        });
                    }
                }
                break;
        }
    }

    animateLockAcquisition(node, lockCenter, process) {
        // Draw line from process to lock
        // Draw line from process to lock (start at process group position)
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        const start = { x: node.x, y: node.y };
        line.setAttribute('x1', start.x);
        line.setAttribute('y1', start.y);
        line.setAttribute('x2', lockCenter.x);
        line.setAttribute('y2', lockCenter.y);
        line.setAttribute('stroke', '#4caf50');
        line.setAttribute('stroke-width', '3');
        line.setAttribute('stroke-dasharray', '5,5');
        line.id = `lock-line-${process}`;
        this.svg.appendChild(line);

        // Animate the process group moving to the lock center
        const nodeEl = this.svg.querySelector(`#node-${process}`);
        if (nodeEl) {
            const from = { x: node.x, y: node.y };
            const to = { x: lockCenter.x, y: lockCenter.y };
            this.animController.addAnimation({
                duration: 1200,
                onUpdate: (p) => {
                    const cx = from.x + (to.x - from.x) * p;
                    const cy = from.y + (to.y - from.y) * p;
                    nodeEl.setAttribute('transform', `translate(${cx}, ${cy})`);
                    // update linking line start
                    line.setAttribute('x1', cx);
                    line.setAttribute('y1', cy);
                },
                onComplete: () => {
                    line.setAttribute('stroke-dasharray', 'none');
                    // indicate lock holder visually (rect fill)
                    const rect = nodeEl.querySelector('rect.process-rect');
                    if (rect) rect.setAttribute('fill', '#4caf50');
                    const stateText = nodeEl.querySelector('.process-state');
                    if (stateText) stateText.textContent = 'In CS';
                }
            });
            // update stored position
            this.processes.get(process).x = to.x;
            this.processes.get(process).y = to.y;
        }

        this.state.lockHolder = process;
    }

    animateLockRelease(node, lockCenter) {
        // Fade out lock line
        // Fade out lock line
        const line = this.svg.querySelector(`#lock-line-${this.state.lockHolder}`);
        if (line) {
            this.animController.addAnimation({
                duration: 600,
                onUpdate: (progress) => {
                    line.setAttribute('opacity', 1 - progress);
                },
                onComplete: () => line.remove()
            });
        }

        // Reset visual of previous holder and move it slightly away from center
        const prev = this.state.lockHolder;
        if (prev) {
            const nodeEl = this.svg.querySelector(`#node-${prev}`);
            if (nodeEl) {
                const base = this.processes.get(prev) || { x: 450, y: 200 };
                const to = { x: base.x + 120, y: base.y + 80 };
                const from = { x: this.processes.get(prev).x, y: this.processes.get(prev).y };
                this.animController.addAnimation({
                    duration: 800,
                    onUpdate: (p) => {
                        const cx = from.x + (to.x - from.x) * p;
                        const cy = from.y + (to.y - from.y) * p;
                        nodeEl.setAttribute('transform', `translate(${cx}, ${cy})`);
                    },
                    onComplete: () => {
                        const rect = nodeEl.querySelector('rect.process-rect');
                        if (rect) rect.setAttribute('fill', '#9E9E9E');
                        // update stored position
                        this.processes.get(prev).x = to.x;
                        this.processes.get(prev).y = to.y;
                        const stateText = nodeEl.querySelector('.process-state');
                        if (stateText) stateText.textContent = 'Idle';
                    }
                });
            }
        }

        // Reset lock color
        const lockRect = this.svg.querySelector('#lock-center rect');
        if (lockRect) {
            this.animController.addAnimation({
                duration: 500,
                onUpdate: (p) => {
                    lockRect.style.fill = `rgba(240, 147, 251, ${1 - p * 0.5})`;
                }
            });
        }

        this.state.lockHolder = null;
    }

    animateWaiting(node, lockCenter, process) {
        // Orbit animation for waiting process
        // Orbit animation for waiting process (slow, visible)
        const startAngle = Math.atan2(node.y - lockCenter.y, node.x - lockCenter.x);
        const radius = Math.sqrt(
            Math.pow(node.x - lockCenter.x, 2) +
            Math.pow(node.y - lockCenter.y, 2)
        );

        const nodeEl = this.svg.querySelector(`#node-${process}`);
        if (!nodeEl) return;

        this.animController.addAnimation({
            duration: 1800,
            onUpdate: (progress) => {
                const angle = startAngle + progress * Math.PI * 2;
                const x = lockCenter.x + radius * Math.cos(angle);
                const y = lockCenter.y + radius * Math.sin(angle);
                nodeEl.setAttribute('transform', `translate(${x}, ${y})`);
            }
        });
    }

    animateSemaphoreEvent(eventType, process, detail) {
        // Semaphore display uses a rect token area
        const display = this.svg.querySelector('#semaphore-display rect.sem-count');
        const textEl = this.svg.querySelector('#semaphore-display text.sem-count-text');
        if (!display) return;

        const countMatch = detail?.match(/\d+/);
        const newCount = countMatch ? parseInt(countMatch[0]) : 0;

        if (eventType === 'semaphore_wait') {
            // briefly flash consumer lane and decrement display
            this.animController.addAnimation({
                duration: 600,
                onUpdate: (p) => {
                    display.setAttribute('fill', `rgba(2,119,189, ${1 - p * 0.5})`);
                },
                onComplete: () => {
                    if (textEl) textEl.textContent = String(newCount);
                    display.setAttribute('fill', '#0277bd');
                }
            });
        }
    }

    animateRWLockEvent(eventType, process) {
        const rwLayout = this.svg.querySelector('#rw-layout');
        if (!rwLayout) return;

        if (eventType === 'reader_enter') {
            this.state.activeReaders.add(process);
            const slots = rwLayout.querySelectorAll('rect.rw-slot');
            slots.forEach((slot, idx) => {
                if (idx < this.state.activeReaders.size) {
                    this.animController.addAnimation({
                        duration: 400,
                        onUpdate: (p) => {
                            slot.setAttribute('fill', `rgb(33, ${150 + Math.round(p * 50)}, 243)`);
                            slot.setAttribute('opacity', 0.7 + p * 0.3);
                        }
                    });
                }
            });
        } else if (eventType === 'writer_enter') {
            this.state.activeWriter = process;
            const slots = rwLayout.querySelectorAll('rect.rw-slot');
            slots.forEach(slot => {
                this.animController.addAnimation({
                    duration: 400,
                    onUpdate: (p) => {
                        slot.setAttribute('fill', `rgb(255, ${Math.max(50, 150 - Math.round(p * 100))}, 0)`);
                    }
                });
            });
        } else if (eventType === 'reader_exit') {
            this.state.activeReaders.delete(process);
            const slots = rwLayout.querySelectorAll('rect.rw-slot');
            slots.forEach((slot, idx) => {
                if (idx >= this.state.activeReaders.size) {
                    this.animController.addAnimation({
                        duration: 300,
                        onComplete: () => slot.setAttribute('fill', '#ddd')
                    });
                }
            });
        } else if (eventType === 'writer_exit') {
            this.state.activeWriter = null;
            const slots = rwLayout.querySelectorAll('rect.rw-slot');
            slots.forEach(slot => {
                this.animController.addAnimation({
                    duration: 300,
                    onComplete: () => slot.setAttribute('fill', '#ddd')
                });
            });
        }
    }

    animatePipeEvent(eventType, process, detail) {
        const pipe = this.svg.querySelector('#pipe-visual rect');
        if (!pipe) return;

        if (eventType === 'message_sent') {
            const bubble = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            bubble.setAttribute('transform', `translate(170, 300)`);
            bubble.innerHTML = `
                <rect x="-15" y="-8" width="30" height="16" rx="3" fill="#2196f3" opacity="0.95" />
                <text x="0" y="4" text-anchor="middle" font-size="10" fill="white">Pkt</text>
            `;
            this.svg.appendChild(bubble);

            this.animController.addAnimation({
                duration: 1400,
                onUpdate: (p) => {
                    const x = 170 + (700 * p);
                    bubble.setAttribute('transform', `translate(${x}, 300)`);
                },
                onComplete: () => bubble.remove()
            });
        }
    }

    animateSharedMemoryEvent(eventType, process, detail) {
        const cells = this.svg.querySelectorAll('.memory-cell rect');
        if (cells.length === 0) return;

        if (eventType === 'shared_memory_update') {
            const cellIndex = Math.floor(Math.random() * cells.length);
            const cell = cells[cellIndex];

            this.animController.addAnimation({
                duration: 500,
                onUpdate: (p) => {
                    const hue = 60 + p * 60;
                    cell.setAttribute('fill', `hsl(${hue}, 100%, 50%)`);
                }
            });
        }
    }

    animateMessageQueueEvent(eventType, process, detail) {
        const queue = this.svg.querySelector('#message-queue');
        if (!queue) return;

        if (eventType === 'message_sent') {
            const item = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            item.innerHTML = `
                <rect x="310" y="280" width="40" height="30" rx="3" fill="#4caf50" stroke="#333" stroke-width="1"/>
                <text x="330" y="300" text-anchor="middle" font-size="9" fill="white">Msg</text>
            `;
            queue.appendChild(item);

            this.animController.addAnimation({
                duration: 300,
                onUpdate: (p) => {
                    const dx = p * 30;
                    item.setAttribute('transform', `translate(${dx}, 0)`);
                }
            });
        }
    }

    updateProcessState(process, eventType) {
        const node = this.svg.querySelector(`#node-${process}`);
        if (!node) return;

        const stateText = node.querySelector('.process-state');
        const stateMap = {
            'lock_acquired': 'Locked',
            'lock_released': 'Released',
            'waiting': 'Waiting',
            'reading': 'Reading',
            'writing': 'Writing',
            'message_sent': 'Sent',
            'message_received': 'Received'
        };

        if (stateText && stateMap[eventType]) {
            stateText.textContent = stateMap[eventType];
        }

        // Color transition for rectangular process block
        const rect = node.querySelector('rect.process-rect');
        const colorMap = {
            'lock_acquired': '#4CAF50',
            'lock_released': '#9E9E9E',
            'waiting': '#FFC107',
            'reading': '#2196F3',
            'writing': '#F44336',
            'message_sent': '#4CAF50',
            'message_received': '#2196F3'
        };

        if (rect && colorMap[eventType]) {
            const target = colorMap[eventType];
            this.animController.addAnimation({
                duration: 300,
                onUpdate: (p) => {
                    // simple opacity-based highlight during transition
                    rect.setAttribute('opacity', 0.8 + p * 0.2);
                },
                onComplete: () => {
                    rect.setAttribute('fill', target);
                    rect.setAttribute('opacity', 1);
                }
            });
        }
    }

    setSpeed(speed) {
        this.speed = speed;
        this.animController.setSpeed(speed);
        // restart playback timer to reflect new speed
        this.startPlaybackLoop();
    }

    pause() {
        this.animController.pause();
    }

    resume() {
        this.animController.resume();
    }

    step() {
        // If there are queued events, process a single event and pause afterwards
        if (this.eventQueue && this.eventQueue.length > 0) {
            const evt = this.eventQueue.shift();
            if (evt) this._handleEventNow(evt);
            this.animController.pause();
            return;
        }

        // Fallback to stepping animations if no queued events
        this.animController.step();
    }

    clear() {
        this.svg.innerHTML = '';
        this.processes.clear();
        this.uniqueProcesses.clear();
        this.animController.clear();
    }

    startAnimationLoop() {
        const loop = () => {
            this.animController.update();
            this.animationFrameId = requestAnimationFrame(loop);
        };
        loop();
    }
}

// ============================================================================
// PROCESS EVENT HANDLER
// ============================================================================

function processEvent(visualization, event) {
    if (!visualization.ipcType) {
        return;
    }
    visualization.processEvent(event);
}
