// ============================================================================
// WEBSOCKET COMMUNICATION
// ============================================================================

class WebSocketManager {
    constructor() {
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000;
        this.listeners = {};
        // ✅ NEW: Track popup-specific handlers to prevent conflicts
        this.popupHandlers = new Map(); // Map<popupId, Map<eventType, [callbacks]>>
    }

    connect() {
        return new Promise((resolve, reject) => {
            const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
            this.ws = new WebSocket(`${protocol}://${window.location.host}`);

            this.ws.onopen = () => {
                console.log('[WS] Connected');
                this.reconnectAttempts = 0;
                this.emit('connected');
                resolve();
            };

            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleMessage(message);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };

            this.ws.onerror = (error) => {
                console.error('[WS] Error:', error);
                this.emit('error', error);
                reject(error);
            };

            this.ws.onclose = () => {
                console.log('[WS] Disconnected');
                this.emit('disconnected');
                this.attemptReconnect();
            };
        });
    }

    handleMessage(message) {
        const { type, popupId } = message;
        console.log('[WS] Message received:', type, message);

        // ✅ ROUTE to popup-specific handlers if this is a popup message
        if (popupId && this.popupHandlers.has(popupId)) {
            const popupListeners = this.popupHandlers.get(popupId);
            if (popupListeners.has(type)) {
                popupListeners.get(type).forEach(callback => callback(message));
            }
        }

        // Also emit to global listeners for backward compatibility
        this.emit(type, message);
    }

    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.warn('[WS] WebSocket not open, message queued');
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`[WS] Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            setTimeout(() => this.connect().catch(() => {}), this.reconnectDelay);
        }
    }

    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data));
        }
    }

    // ✅ NEW: Register popup-specific handlers
    registerPopupHandler(popupId, eventType, callback) {
        if (!this.popupHandlers.has(popupId)) {
            this.popupHandlers.set(popupId, new Map());
        }
        const popupListeners = this.popupHandlers.get(popupId);
        if (!popupListeners.has(eventType)) {
            popupListeners.set(eventType, []);
        }
        popupListeners.get(eventType).push(callback);
    }

    // ✅ NEW: Unregister all handlers for a popup
    unregisterPopupHandlers(popupId) {
        this.popupHandlers.delete(popupId);
    }

    // ✅ NEW: Clear handlers for a popup event type
    clearPopupHandler(popupId, eventType) {
        if (this.popupHandlers.has(popupId)) {
            const popupListeners = this.popupHandlers.get(popupId);
            popupListeners.delete(eventType);
        }
    }

    startSimulation(ipcType) {
        this.send({
            type: 'start_simulation',
            ipcType
        });
    }

    requestHistory() {
        this.send({
            type: 'request_history'
        });
    }

    pause() {
        this.send({ type: 'pause' });
    }

    resume() {
        this.send({ type: 'resume' });
    }
}

// Initialize global WebSocket manager
const wsManager = new WebSocketManager();

// ============================================================================
// API FUNCTIONS
// ============================================================================

const API = {
    async getActiveConnections() {
        const response = await fetch('/api/active-connections');
        return response.json();
    },

    async getHistory() {
        const response = await fetch('/api/history');
        return response.json();
    },

    async getSimulationLogs() {
        const response = await fetch('/api/simulation-logs');
        return response.json();
    },

    async getSimulationLog(id) {
        const response = await fetch(`/api/simulation-logs/${id}`);
        return response.json();
    }
};

// ============================================================================
// INITIALIZE
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await wsManager.connect();
        console.log('WebSocket connected successfully');
    } catch (error) {
        console.error('Failed to connect WebSocket:', error);
    }
});
