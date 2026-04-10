document.addEventListener('DOMContentLoaded', async () => {
    const user = getUser();
    if (!user || user.rol !== 'ejecutivo') {
        logout();
        return;
    }

    document.getElementById('user-name').innerText = user.nombre;
    document.getElementById('logout-btn').addEventListener('click', logout);

    // Navigation setup
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
            document.querySelectorAll('.content-section').forEach(sec => sec.style.display = 'none');
            
            const target = e.currentTarget.getAttribute('data-target');
            e.currentTarget.classList.add('active');
            document.getElementById(target).style.display = 'block';

            if (target === 'tab-approvals') loadApprovals();
            if (target === 'tab-deliveries') loadDeliveries();
            if (target === 'tab-notifications') loadNotifications();
            if (target === 'tab-reports') {
                const reportDateEl = document.getElementById('report-date');
                if (!reportDateEl.value) reportDateEl.value = new Date().toISOString().split('T')[0];
                loadReport();
            }
        });
    });

    // New Order Form Submittal
    document.getElementById('order-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            orden_servicio: document.getElementById('order-id').value,
            modelo: document.getElementById('order-model').value,
            comentarios: document.getElementById('order-comments').value,
            prioridad: document.getElementById('order-priority').checked
        };

        try {
            await fetchApi('/orders', { method: 'POST', body: JSON.stringify(payload) });
            alert('Orden ingresada correctamente. Pasará a la fila de diagnóstico.');
            e.target.reset();
        } catch (err) {
            alert(err.message);
        }
    });

    document.getElementById('report-date').addEventListener('change', loadReport);
    document.getElementById('download-report-btn').addEventListener('click', downloadCsvReport);

    // Init data layer background loops (mock real time)
    loadApprovals();
    loadDeliveries();
    loadNotifications();

    // Poll for global updates every 15 seconds
    setInterval(() => {
        loadApprovals();
        loadDeliveries();
        loadNotifications();
    }, 15000);
});

async function loadApprovals() {
    try {
        const orders = await fetchApi('/orders'); // Reuses supervisor endpoint but filters locally
        const tbody = document.getElementById('approvals-table-body');
        
        // Filter those needing approval
        const pendings = orders.filter(o => o.estado === 'DIAGNOSTICO_TERMINADO');
        
        document.getElementById('approval-count').innerText = pendings.length;

        if (pendings.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4">No hay equipos listos para cobro.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        pendings.forEach(o => {
            tbody.innerHTML += `
                <tr>
                    <td><strong>${o.orden_servicio}</strong></td>
                    <td>${o.modelo}</td>
                    <td>${o.tecnico_diagnostico_nombre || 'Sistema'}</td>
                    <td>
                        <button class="btn-primary authorize-btn" data-id="${o.id}" style="padding: 0.5rem; width: auto;">
                            Registrar Pago Constatado
                        </button>
                    </td>
                </tr>
            `;
        });

        // Attach auth events
        document.querySelectorAll('.authorize-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                if (confirm('¿Confirmas que se recibió el cobro por esta reparación de Unifila?')) {
                    try {
                        const res = await fetchApi(`/orders/${id}/pay`, { method: 'POST' });
                        alert(res.message);
                        loadApprovals(); // Refresh visual
                    } catch (err) {
                        alert(err.message);
                    }
                }
            });
        });
    } catch (err) {
        console.error('Error fetching approvals', err);
    }
}

async function loadDeliveries() {
    try {
        const orders = await fetchApi('/orders'); 
        const tbody = document.getElementById('deliveries-table-body');
        
        // El ciclo termina cuando la orden se repara y se entrega.
        const pendings = orders.filter(o => o.estado === 'REPARACION_TERMINADA');
        
        document.getElementById('delivery-count').innerText = pendings.length;

        if (pendings.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4">No hay equipos listos para entregar.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        pendings.forEach(o => {
            tbody.innerHTML += `
                <tr>
                    <td><strong>${o.orden_servicio}</strong></td>
                    <td>${o.modelo}</td>
                    <td>${o.tecnico_reparacion_nombre || 'Sistema'}</td>
                    <td>
                        <button class="btn-primary deliver-btn" data-id="${o.id}" style="padding: 0.5rem; width: auto; background-color: var(--state-done);">
                            Finalizar (Entregar a Cliente)
                        </button>
                    </td>
                </tr>
            `;
        });

        document.querySelectorAll('.deliver-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                if (confirm('¿Confirmas que se ha entregado el equipo al cliente? Esto dará por finalizado todo el ciclo.')) {
                    try {
                        const res = await fetchApi(`/orders/${id}/finish-order`, { method: 'POST' });
                        alert(res.message);
                        loadDeliveries(); 
                    } catch (err) {
                        alert(err.message);
                    }
                }
            });
        });
    } catch (err) {
        console.error('Error fetching deliveries', err);
    }
}

async function loadNotifications() {
    try {
        const notifs = await fetchApi('/users/notifications');
        document.getElementById('notif-count').innerText = notifs.length;
        document.getElementById('notif-count').style.display = notifs.length > 0 ? 'inline-block' : 'none';

        const container = document.getElementById('notifications-container');
        if (notifs.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted);">No tienes mensajes nuevos en este momento.</p>';
            return;
        }

        container.innerHTML = '';
        notifs.forEach(n => {
            const dateStr = new Date(n.fecha).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });
            container.innerHTML += `
                <div style="background:var(--bg-color); padding:1rem; border-radius:var(--radius); border-left: 4px solid var(--primary-color); margin-bottom: 1rem; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <p style="margin-bottom:0.5rem; color:var(--text-main); font-weight: 500;">${n.mensaje}</p>
                        <small style="color:var(--text-muted);">${dateStr}</small>
                    </div>
                    <button class="btn-secondary mark-read-btn" data-id="${n.id}">Marcar Leída</button>
                </div>
            `;
        });

        document.querySelectorAll('.mark-read-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                try {
                    await fetchApi(`/users/notifications/${id}/read`, { method: 'POST' });
                    loadNotifications();
                } catch (err) {
                    alert('Error al leer: ' + err.message);
                }
            });
        });

    } catch (e) {
        console.error('Error fetching notifications', e);
    }
}

let currentReportData = [];

async function loadReport() {
    const dateVal = document.getElementById('report-date').value || new Date().toISOString().split('T')[0];
    try {
        const historyObj = await fetchApi(`/users/daily-report?date=${dateVal}`);
        currentReportData = historyObj; // Store for CSV
        
        const tbody = document.getElementById('report-table-body');
        tbody.innerHTML = '';
        if (historyObj.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4">No hay actividades registradas en la fecha seleccionada.</td></tr>';
            return;
        }

        historyObj.forEach(o => {
            const dateStr = new Date(o.fecha_fin_real || o.fecha_accion || new Date()).toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City' });
            let startStr = 'N/A';
            let endStr = new Date(o.fecha_fin_real || o.fecha_accion || new Date()).toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour12: true });
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
        const dateStr = new Date(o.fecha_fin_real || o.fecha_accion || new Date()).toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City' });
        let startStr = 'N/A';
        let endStr = new Date(o.fecha_fin_real || o.fecha_accion || new Date()).toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour12: true });
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
    a.download = `reporte_ejecutivo_${document.getElementById('report-date').value}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}
