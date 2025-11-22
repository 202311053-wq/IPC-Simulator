// ============================================================================
// UI EVENT HANDLERS
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // IPC Card click handlers
    document.querySelectorAll('.ipc-card').forEach(card => {
        card.addEventListener('click', () => {
            const ipcType = card.dataset.type;
            popupManager.createPopup(ipcType);
        });

        // Visualize button - open visualization inside the existing popup
        // NOTE: Do NOT open new pages or routes. Create a popup and run the visualization module inside it.
        const btn = card.querySelector('.visualize-btn');
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const ipcType = card.dataset.type;
            // Always open visualization inside the popup (single-page behavior)
            popupManager.createPopup(ipcType);
        });
    });

    // Info modal
    const infoBtn = document.getElementById('info-btn');
    const infoModal = document.getElementById('info-modal');
    const closeBtn = infoModal.querySelector('.close');

    infoBtn.addEventListener('click', () => {
        infoModal.style.display = 'block';
    });

    closeBtn.addEventListener('click', () => {
        infoModal.style.display = 'none';
    });

    window.addEventListener('click', (e) => {
        if (e.target === infoModal) {
            infoModal.style.display = 'none';
        }
    });

    // Start listening for real-time updates
    startRealtimeUpdates();
});

// ============================================================================
// REAL-TIME UPDATES
// ============================================================================

async function startRealtimeUpdates() {
    // Update active connections every second
    setInterval(updateActiveConnections, 1000);
    
    // Update history every 500ms
    setInterval(updateHistory, 500);
    
    // Update simulation logs every 2 seconds
    setInterval(updateSimulationLogs, 2000);

    // Listen for WebSocket messages
    wsManager.on('active_connections', (data) => {
        updateActiveConnectionsUI(data.connections);
    });

    wsManager.on('global_event', (data) => {
        addHistoryEntry(data.event);
    });
}

async function updateActiveConnections() {
    try {
        const data = await API.getActiveConnections();
        updateActiveConnectionsUI(data.connections);
    } catch (error) {
        console.error('Error fetching active connections:', error);
    }
}

function updateActiveConnectionsUI(connections) {
    const list = document.getElementById('active-connections-list');
    
    if (connections.length === 0) {
        list.innerHTML = '<p class="empty-state">No active visualizations</p>';
        return;
    }

    list.innerHTML = connections.map(conn => `
        <div class="connection-item">
            <div class="connection-info">
                <div class="connection-type">🔴 ${formatIpcName(conn.type)}</div>
                <div class="connection-time">Connected: ${new Date(conn.connectedTime).toLocaleTimeString()}</div>
                <div class="connection-time">Process: ${conn.process || 'pending'}</div>
            </div>
            <div class="connection-status connected"></div>
        </div>
    `).join('');
}

async function updateHistory() {
    try {
        const data = await API.getHistory();
        // Handled by WebSocket for real-time updates
    } catch (error) {
        console.error('Error fetching history:', error);
    }
}

function addHistoryEntry(event) {
    const list = document.getElementById('history-list');
    
    // Remove empty state if present
    if (list.querySelector('.empty-state')) {
        list.innerHTML = '';
    }

    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `
        <div class="history-event">
            <div class="history-type">${event.event}</div>
            <div class="history-detail">${event.detail} (${event.process})</div>
            <div class="event-time">${new Date(event.timestamp).toLocaleTimeString()}</div>
        </div>
    `;

    list.insertBefore(item, list.firstChild);

    // Keep only last 20
    while (list.children.length > 20) {
        list.removeChild(list.lastChild);
    }
}

async function updateSimulationLogs() {
    try {
        const data = await API.getSimulationLogs();
        updateSimulationLogsUI(data.logs);
    } catch (error) {
        console.error('Error fetching simulation logs:', error);
    }
}

function updateSimulationLogsUI(logs) {
    const container = document.getElementById('simulation-logs');
    
    if (logs.length === 0) {
        container.innerHTML = '<p class="empty-state">No previous simulations</p>';
        return;
    }

    container.innerHTML = logs.map(log => `
        <div class="log-card" onclick="viewSimulationLog('${log.popupId}')">
            <h4>${formatIpcName(log.ipcType)}</h4>
            <p>📊 ${log.eventCount} events</p>
            <p>🕒 ${new Date(log.startTime).toLocaleTimeString()}</p>
        </div>
    `).join('');
}

async function viewSimulationLog(popupId) {
    try {
        const log = await API.getSimulationLog(popupId);
        // Create a new popup with the log data (replay mode)
        console.log('Viewing simulation log:', log);
        alert(`Simulation Log: ${log.ipcType}\nEvents: ${log.eventCount}\nDuration: ${log.endTime - log.startTime}ms`);
    } catch (error) {
        console.error('Error viewing simulation log:', error);
    }
}

function formatIpcName(type) {
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

// ============================================================================
// INFO SECTION TOGGLE
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    const infoBtn = document.getElementById('info-btn');
    const infoSection = document.getElementById('info-section');
    
    infoBtn.addEventListener('click', () => {
        if (infoSection.style.display === 'none') {
            infoSection.style.display = 'block';
            infoSection.scrollIntoView({ behavior: 'smooth' });
        } else {
            infoSection.style.display = 'none';
        }
    });
});
