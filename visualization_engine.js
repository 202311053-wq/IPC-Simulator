// VisualizationEngine: core helper for IPC visualizations
export class VisualizationEngine {
    constructor(svgCanvas, statsPanel, logPanel) {
        this.svg = svgCanvas;
        this.stats = statsPanel;
        this.log = logPanel;

        this.actors = new Map(); // id => {id, element, label, state, currentZone}
        this.zones = new Map(); // name => {x,y,width,height,slots:[]}
        this.statsElements = new Map();

        this.eventQueue = [];
        this.simulationTimer = null;
        this.playbackState = 'paused';
        this.speed = 1.0;

        this.clearCanvas();
    }

    // --- Canvas / Reset ---
    reset() {
        this.stop();
        this.clearCanvas();
        this.actors.clear();
        this.zones.clear();
        this.statsElements.clear();
        this.eventQueue = [];
    }

    clearCanvas() {
        if (this.svg) this.svg.innerHTML = '';
        if (this.stats) this.stats.innerHTML = '';
        if (this.log) this.log.innerHTML = '';

        if (!this.svg) return;
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        this.svg.appendChild(defs);
    }

    // --- Playback Controls ---
    play() {
        if (this.playbackState === 'playing') return;
        this.playbackState = 'playing';
        this.processNextEvent();
    }
    pause() {
        this.playbackState = 'paused';
        if (this.simulationTimer) { clearTimeout(this.simulationTimer); this.simulationTimer = null; }
    }
    stop() { this.pause(); this.playbackState = 'stopped'; }
    setSpeed(speedValue) { this.speed = Number(speedValue) || 1.0; }

    addEvent(action, delay = 500) {
        this.eventQueue.push({ action, delay });
    }

    processNextEvent() {
        if (this.playbackState !== 'playing' || this.eventQueue.length === 0) {
            if (this.eventQueue.length === 0) this.playbackState = 'stopped';
            return;
        }
        const ev = this.eventQueue.shift();
        const effectiveDelay = Math.max(0, ev.delay * this.speed);
        this.simulationTimer = setTimeout(() => {
            try {
                ev.action();
                this.processNextEvent();
            } catch (e) {
                console.error('Simulation error:', e);
                this.pause();
            }
        }, effectiveDelay);
    }

    // --- Actor Management ---
    createActor(id, label, initialCoords = { x: 0, y: 0 }, type = 'process') {
        if (!this.svg) throw new Error('SVG canvas not available');
        const ns = 'http://www.w3.org/2000/svg';
        const actorGroup = document.createElementNS(ns, 'g');
        actorGroup.setAttribute('id', `actor-${id}`);
        actorGroup.setAttribute('class', `viz-actor ${type}`);
        actorGroup.setAttribute('transform', `translate(${initialCoords.x}, ${initialCoords.y})`);

        const rect = document.createElementNS(ns, 'rect');
        rect.setAttribute('width', '80');
        rect.setAttribute('height', '30');
        rect.setAttribute('rx', '6');
        rect.setAttribute('x', '0');
        rect.setAttribute('y', '0');

        const text = document.createElementNS(ns, 'text');
        text.setAttribute('x', '40');
        text.setAttribute('y', '20');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.textContent = label;

        actorGroup.appendChild(rect);
        actorGroup.appendChild(text);
        this.svg.appendChild(actorGroup);

        const actor = { id, element: actorGroup, label, state: 'idle', currentZone: null };
        this.actors.set(id, actor);
        return actor;
    }

    moveActor(id, coords) {
        const actor = this.actors.get(id);
        if (!actor) return null;
        actor.element.setAttribute('transform', `translate(${coords.x}, ${coords.y})`);
        return actor;
    }

    setActorState(id, state) {
        const actor = this.actors.get(id);
        if (!actor) return;
        actor.state = state;
        actor.element.setAttribute('data-state', state);
    }

    removeActor(id) {
        const actor = this.actors.get(id);
        if (!actor) return;
        if (actor.element && actor.element.parentNode) actor.element.parentNode.removeChild(actor.element);
        this.actors.delete(id);
        this.freeSlot(id);
    }

    // --- Zone Management ---
    createZone(name, box, label = name, slots = 1) {
        if (!this.svg) throw new Error('SVG canvas not available');
        const ns = 'http://www.w3.org/2000/svg';
        const zoneGroup = document.createElementNS(ns, 'g');
        zoneGroup.setAttribute('class', 'viz-zone');

        const zoneRect = document.createElementNS(ns, 'rect');
        zoneRect.setAttribute('x', box.x);
        zoneRect.setAttribute('y', box.y);
        zoneRect.setAttribute('width', box.width);
        zoneRect.setAttribute('height', box.height);

        const zoneText = document.createElementNS(ns, 'text');
        zoneText.setAttribute('x', box.x + box.width / 2);
        zoneText.setAttribute('y', box.y + 18);
        zoneText.setAttribute('text-anchor', 'middle');
        zoneText.textContent = label;

        zoneGroup.appendChild(zoneRect);
        zoneGroup.appendChild(zoneText);
        this.svg.prepend(zoneGroup);

        const slotPositions = [];
        for (let i = 0; i < slots; i++) {
            slotPositions.push({ x: box.x + 10 + (i * 90), y: box.y + 40, occupiedBy: null });
        }

        this.zones.set(name, { x: box.x, y: box.y, width: box.width, height: box.height, slots: slotPositions });
        return this.zones.get(name);
    }

    getFreeSlot(zoneName, actorId) {
        const zone = this.zones.get(zoneName);
        if (!zone) return null;
        for (const slot of zone.slots) {
            if (slot.occupiedBy === null) { slot.occupiedBy = actorId; return { x: slot.x, y: slot.y }; }
        }
        return null;
    }

    freeSlot(actorId) {
        for (const zone of this.zones.values()) {
            for (const slot of zone.slots) {
                if (slot.occupiedBy === actorId) { slot.occupiedBy = null; return; }
            }
        }
    }

    // --- Stats & Logging ---
    addStat(name, initialValue) {
        if (!this.stats) return;
        const row = document.createElement('div'); row.className = 'stat-row';
        const label = document.createElement('span'); label.className = 'stat-label'; label.textContent = name;
        const value = document.createElement('span'); value.className = 'stat-value'; value.textContent = initialValue;
        row.appendChild(label); row.appendChild(value); this.stats.appendChild(row);
        this.statsElements.set(name, value);
    }

    updateStat(name, value) {
        const el = this.statsElements.get(name);
        if (el) el.textContent = String(value);
    }

    logEvent(message, type = 'info') {
        if (!this.log) return;
        const entry = document.createElement('div'); entry.className = `log-entry ${type}`;
        entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        this.log.appendChild(entry);
        this.log.scrollTop = this.log.scrollHeight;
    }
}
// Shared Visualization Engine
// Provides helpers for moving actors, updating stats, and an event player

const VisualEngine = (function(){
    // Helper: get transform offset between two elements (target and actor) relative to a container
    function _computeOffset(actorEl, targetEl, containerEl) {
        const aRect = actorEl.getBoundingClientRect();
        const tRect = targetEl.getBoundingClientRect();
        const cRect = containerEl.getBoundingClientRect();
        // compute center deltas relative to container
        const ax = aRect.left + aRect.width/2 - cRect.left;
        const ay = aRect.top + aRect.height/2 - cRect.top;
        const tx = tRect.left + tRect.width/2 - cRect.left;
        const ty = tRect.top + tRect.height/2 - cRect.top;
        return { dx: tx-ax, dy: ty-ay };
    }

    // Move actor element to target element using CSS transform (translate)
    // Supports HTML elements and SVG elements (SVG 'g' groups)
    function moveActor(actorEl, targetEl, containerEl, opts={duration: 400, onComplete:null}){
        return new Promise((resolve) => {
            if (!actorEl || !targetEl || !containerEl) { resolve(); return; }
            const { dx, dy } = _computeOffset(actorEl, targetEl, containerEl);
            // Ensure actor uses transform style
            actorEl.style.transition = `transform ${opts.duration}ms ease`;
            actorEl.style.willChange = 'transform';
            // apply translate
            actorEl.style.transform = `translate(${dx}px, ${dy}px)`;
            const timeout = setTimeout(()=>{
                // clear transition but keep final position
                actorEl.style.transition = '';
                if (typeof opts.onComplete === 'function') opts.onComplete();
                resolve();
            }, opts.duration + 20);
            // cleanup if element removed
            const obs = new MutationObserver(()=>{
                if (!document.contains(actorEl)) { clearTimeout(timeout); obs.disconnect(); resolve(); }
            });
            obs.observe(document.body, { childList:true, subtree:true });
        });
    }

    // Fade and remove an element
    function fadeOutAndRemove(el, duration=320){
        if (!el) return Promise.resolve();
        el.style.transition = `opacity ${duration}ms ease, transform ${duration}ms ease`;
        el.style.opacity = '0';
        el.style.transform = 'scale(0.98) translateY(-8px)';
        return new Promise((res)=> setTimeout(()=>{ if (el && el.parentNode) el.parentNode.removeChild(el); res(); }, duration+20));
    }

    // Update an HTML stat element inside a popup
    function updateStat(popupEl, statId, value){
        if (!popupEl) return;
        try {
            const el = popupEl.querySelector(`#${statId}`);
            if (el) el.textContent = String(value);
        } catch(e){ /* ignore */ }
    }

    // Simple event player that processes events using a handler callback
    class EventPlayer {
        constructor(handler){
            this.handler = handler; // function(event)
            this.queue = [];
            this.isPlaying = false;
            this.speed = 1; // multiplier
            this._timer = null;
        }
        push(event){ this.queue.push(event); }
        clear(){ this.queue = []; }
        setSpeed(speed){ this.speed = Math.max(0.1, speed); }
        play(){ if (this.isPlaying) return; this.isPlaying = true; this._tick(); }
        pause(){ this.isPlaying = false; if (this._timer) { clearTimeout(this._timer); this._timer = null; } }
        step(){ if (this.queue.length === 0) return; const e = this.queue.shift(); try{ this.handler(e); }catch(e){ console.warn(e); } }
        _tick(){ if (!this.isPlaying) return; if (this.queue.length === 0) { this.isPlaying = false; return; } const ev = this.queue.shift(); try{ this.handler(ev); }catch(e){ console.warn(e); } const delay = Math.max(40, 250 / this.speed); this._timer = setTimeout(()=> this._tick(), delay); }
    }

    return {
        moveActor,
        fadeOutAndRemove,
        updateStat,
        EventPlayer
    };
})();

export default VisualEngine;
