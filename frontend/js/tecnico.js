let timerInterval;

document.addEventListener('DOMContentLoaded', async () => {
    const user = getUser();
    if (!user || user.rol !== 'tecnico') {
        logout();
        return;
    }

    document.getElementById('user-name').innerText = user.nombre;
    document.getElementById('logout-btn').addEventListener('click', logout);

    // Initial check for active orders and rule
    await checkActiveState();

    // Tab logic
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
            document.querySelectorAll('.content-section').forEach(sec => sec.style.display = 'none');
            
            const target = e.currentTarget.getAttribute('data-target');
            e.currentTarget.classList.add('active');
            document.getElementById(target).style.display = 'block';

            if (target === 'tab-history') {
                const reportDateEl = document.getElementById('report-date');
                if (!reportDateEl.value) reportDateEl.value = new Date().toISOString().split('T')[0];
                loadHistory(user.id);
            }
        });
    });

    document.getElementById('take-next-btn').addEventListener('click', takeNextTask);
    document.getElementById('finish-btn').addEventListener('click', finishCurrentTask);
    document.getElementById('pause-btn').addEventListener('click', pauseCurrentTask);
    document.getElementById('resume-btn').addEventListener('click', resumeCurrentTask);
    
    document.getElementById('report-date').addEventListener('change', () => loadHistory(user.id));
    document.getElementById('download-report-btn').addEventListener('click', downloadCsvReport);
});

async function checkActiveState() {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        // 1. Fetch current rule to show
        try {
            const myRule = await fetchApi('/rules/my-rule');
            if (myRule) {
                document.getElementById('current-rule').innerText = `Asignación Hoy: ${myRule.modelo} - ${myRule.tipo_proceso.toUpperCase()}`;
                document.getElementById('current-rule').className = 'badge badge-info';
            } else {
                document.getElementById('current-rule').innerText = `Sin asignación. Solicitar a supervisor.`;
                document.getElementById('current-rule').className = 'badge badge-danger';
            }
        } catch (e) {
            console.error('Cant fetch rule', e);
        }

        // 2. Fetch active order assigned to me explicitly
        const activeObj = await fetchApi('/orders/my-active');

        if (activeObj) {
            showActiveOrder(activeObj);
        } else {
            showEmptyState();
        }

    } catch (err) {
        console.error('Error checking state', err);
    }
}

async function takeNextTask() {
    try {
        const res = await fetchApi('/orders/take-next', { method: 'POST' });
        alert(res.message);
        showActiveOrder(res.orden);
    } catch (err) {
        alert(err.message);
    }
}

function showActiveOrder(order) {
    document.getElementById('no-order-state').style.display = 'none';
    const activeState = document.getElementById('active-order-state');
    activeState.style.display = 'block';

    document.getElementById('active-order-id').innerText = order.orden_servicio;
    document.getElementById('active-model').innerText = order.modelo;
    document.getElementById('active-process').innerText = order.tipo_proceso === 'diagnostico' ? 'Diagnóstico' : 'Reparación';
    document.getElementById('active-comments').innerText = order.comentarios || 'N/A';

    // Location display
    const locationSpan = document.getElementById('active-location');
    locationSpan.innerText = order.ubicacion || 'Sin ubicación registrada';
    document.getElementById('location-display').style.display = 'flex';
    document.getElementById('location-edit').style.display = 'none';

    // Wire up location edit controls (replace to avoid duplicate listeners)
    const editBtn = document.getElementById('edit-location-btn');
    const saveBtn = document.getElementById('save-location-btn');
    const cancelBtn = document.getElementById('cancel-location-btn');
    const locationInput = document.getElementById('location-input');

    const newEditBtn = editBtn.cloneNode(true);
    editBtn.parentNode.replaceChild(newEditBtn, editBtn);
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    newEditBtn.addEventListener('click', () => {
        locationInput.value = order.ubicacion || '';
        document.getElementById('location-display').style.display = 'none';
        document.getElementById('location-edit').style.display = 'flex';
    });

    newCancelBtn.addEventListener('click', () => {
        document.getElementById('location-display').style.display = 'flex';
        document.getElementById('location-edit').style.display = 'none';
    });

    newSaveBtn.addEventListener('click', async () => {
        const newLocation = locationInput.value.trim();
        try {
            const res = await fetchApi(`/orders/${order.id}/location`, {
                method: 'PUT',
                body: JSON.stringify({ ubicacion: newLocation })
            });
            order.ubicacion = res.orden.ubicacion;
            locationSpan.innerText = res.orden.ubicacion || 'Sin ubicación registrada';
            document.getElementById('location-display').style.display = 'flex';
            document.getElementById('location-edit').style.display = 'none';
        } catch (err) {
            alert('Error al guardar ubicación: ' + err.message);
        }
    });

    document.getElementById('active-priority').style.display = order.prioridad ? 'inline-block' : 'none';

    // Set action IDs
    document.getElementById('finish-btn').dataset.id = order.id;
    document.getElementById('pause-btn').dataset.id = order.id;
    document.getElementById('resume-btn').dataset.id = order.id;

    // Start timer logically
    startTimer(order);
}

function showEmptyState() {
    document.getElementById('no-order-state').style.display = 'block';
    document.getElementById('active-order-state').style.display = 'none';
    if(timerInterval) clearInterval(timerInterval);
}

function startTimer(order) {
    const timeNode = document.getElementById('active-time');
    if(timerInterval) clearInterval(timerInterval);
    
    const startTime = new Date(order.fecha_inicio);
    const tiempoPausado = order.tiempo_pausado_segundos || 0;

    if (order.pausa_inicio) {
        const pauseTime = new Date(order.pausa_inicio);
        let diff = Math.floor((pauseTime - startTime) / 1000) - tiempoPausado;
        if (diff < 0) diff = 0;

        const h = Math.floor(diff / 3600).toString().padStart(2, '0');
        const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
        const s = (diff % 60).toString().padStart(2, '0');
        
        timeNode.innerText = `${h}:${m}:${s} (PAUSADO)`;
        timeNode.style.color = 'var(--warning-color, #f39c12)';
        
        document.getElementById('pause-btn').style.display = 'none';
        document.getElementById('resume-btn').style.display = 'block';
    } else {
        timeNode.style.color = 'var(--state-process)';
        document.getElementById('pause-btn').style.display = 'block';
        document.getElementById('resume-btn').style.display = 'none';

        timerInterval = setInterval(() => {
            const now = new Date();
            let diff = Math.floor((now - startTime) / 1000) - tiempoPausado;
            if (diff < 0) diff = 0;
            
            const h = Math.floor(diff / 3600).toString().padStart(2, '0');
            const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
            const s = (diff % 60).toString().padStart(2, '0');
            
            timeNode.innerText = `${h}:${m}:${s}`;
        }, 1000);
    }
}

async function pauseCurrentTask(e) {
    const id = e.target.dataset.id;
    try {
        const res = await fetchApi(`/orders/${id}/pause`, { method: 'POST' });
        showActiveOrder(res.orden);
    } catch(err) {
        alert(err.message);
    }
}

async function resumeCurrentTask(e) {
    const id = e.target.dataset.id;
    try {
        const res = await fetchApi(`/orders/${id}/resume`, { method: 'POST' });
        showActiveOrder(res.orden);
    } catch(err) {
        alert(err.message);
    }
}

async function finishCurrentTask(e) {
    const id = e.target.dataset.id;
    if(confirm('¿Confirmar que has terminado con el proceso para esta orden?')) {
        try {
            await fetchApi(`/orders/${id}/finish`, { method: 'POST' });
            alert('Tarea finalizada y registrada con éxito.');
            showEmptyState();
        } catch(err) {
            alert(err.message);
        }
    }
}

let currentReportData = [];

async function loadHistory(userId) {
    const dateVal = document.getElementById('report-date').value || new Date().toISOString().split('T')[0];
    try {
        const historyObj = await fetchApi(`/users/daily-report?date=${dateVal}`);
        currentReportData = historyObj; // Store for CSV
        
        const tbody = document.getElementById('history-table-body');
        tbody.innerHTML = '';
        if (historyObj.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4">No hay historial registrado en este día.</td></tr>';
            return;
        }

        historyObj.forEach(o => {
            const dateStr = new Date(o.fecha_fin_real || o.fecha_accion).toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City' });
            let startStr = 'N/A';
            let endStr = new Date(o.fecha_fin_real || o.fecha_accion).toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour12: true });
            let totalMinutos = 'N/A';
            const pSeg = o.tiempo_pausado_segundos || 0;
            const pauseStr = Math.floor(pSeg / 60) + 'm ' + (pSeg % 60) + 's';

            if (o.fecha_inicio_real && o.fecha_fin_real) {
                startStr = new Date(o.fecha_inicio_real).toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour12: true });
                const diffSeg = Math.floor((new Date(o.fecha_fin_real) - new Date(o.fecha_inicio_real)) / 1000);
                const netSeg = Math.max(0, diffSeg - pSeg);
                totalMinutos = Math.floor(netSeg / 60) + 'm ' + (netSeg % 60) + 's';
            }
            
            tbody.innerHTML += `
               <tr>
                    <td>${dateStr}</td>
                    <td><strong>${o.orden_servicio}</strong></td>
                    <td>${o.modelo}</td>
                    <td><span class="badge badge-info">${o.accion}</span></td>
                    <td>${startStr}</td>
                    <td>${pauseStr}</td>
                    <td>${endStr}</td>
                    <td><strong>${totalMinutos}</strong></td>
               </tr>
            `;
        });
    } catch(err) {
        console.error(err);
    }
}

function downloadCsvReport() {
    if (currentReportData.length === 0) {
        alert('No hay datos para descargar en el día seleccionado.');
        return;
    }
    
    const headers = 'Fecha,Orden,Modelo,Acción Realizada,Fecha/Hora Inicio,Minutos en Pausa,Fecha/Hora Final,Total Minutos\n';
    const rows = currentReportData.map(o => {
        const dateStr = new Date(o.fecha_fin_real || o.fecha_accion).toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City' });
        let startStr = 'N/A';
        let endStr = new Date(o.fecha_fin_real || o.fecha_accion).toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour12: true });
        let totalMinutos = 'N/A';
        const pSeg = o.tiempo_pausado_segundos || 0;
        const pauseStr = Math.floor(pSeg / 60) + 'm ' + (pSeg % 60) + 's';

        if (o.fecha_inicio_real && o.fecha_fin_real) {
            startStr = new Date(o.fecha_inicio_real).toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour12: true });
            const diffSeg = Math.floor((new Date(o.fecha_fin_real) - new Date(o.fecha_inicio_real)) / 1000);
            const netSeg = Math.max(0, diffSeg - pSeg);
            totalMinutos = Math.floor(netSeg / 60) + 'm ' + (netSeg % 60) + 's';
        }

        return `"${dateStr}","${o.orden_servicio}","${o.modelo}","${o.accion}","${startStr}","${pauseStr}","${endStr}","${totalMinutos}"`;
    }).join('\n');
    
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_tecnico_${document.getElementById('report-date').value}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}
