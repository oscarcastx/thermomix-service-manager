import { fetchApi, getUser, logout } from './api.js';

document.addEventListener('DOMContentLoaded', async () => {
    const user = getUser();
    if (!user || user.rol !== 'supervisor') {
        logout();
        return;
    }

    document.getElementById('user-name').innerText = user.nombre;
    document.getElementById('logout-btn').addEventListener('click', logout);

    // Tab logic
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
            document.querySelectorAll('.content-section').forEach(sec => sec.style.display = 'none');
            
            const target = e.target.getAttribute('data-target');
            e.target.classList.add('active');
            document.getElementById(target).style.display = 'block';

            if (target === 'tab-dashboard') loadDashboard();
            if (target === 'tab-rules') loadRulesData();
            if (target === 'tab-orders') loadOrders();
            if (target === 'tab-users') loadUsers();
        });
    });

    const todayVal = new Date().toISOString().split('T')[0];
    document.getElementById('report-date').value = todayVal;

    document.getElementById('download-report-btn')?.addEventListener('click', async () => {
        try {
            const dateVal = document.getElementById('report-date').value || todayVal;
            const historyObj = await fetchApi(`/users/daily-report?date=${dateVal}`);
            
            if (historyObj.length === 0) {
                alert('No hay actividades registradas en la fecha seleccionada.');
                return;
            }

            const headers = 'Fecha,Orden,Modelo,Acción Realizada,Fecha/Hora Inicio,Minutos en Pausa,Fecha/Hora Final,Total Minutos\n';
            const rows = historyObj.map(o => {
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
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `reporte_maestro_${dateVal}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (e) {
            alert('Error al descargar reporte: ' + e.message);
        }
    });

    // User Form Setup (Create new personal)
    document.getElementById('user-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const payload = {
            nombre: document.getElementById('user-name-input').value,
            email: document.getElementById('user-email-input').value,
            password: document.getElementById('user-password-input').value,
            rol: document.getElementById('user-role-input').value
        };

        try {
            await fetchApi('/users', { method: 'POST', body: JSON.stringify(payload) });
            alert('Usuario creado exitosamente. Ahora puede iniciar sesión con estas credenciales.');
            e.target.reset();
            loadUsers();
            if (payload.rol === 'tecnico') {
                loadTechnicians();
            }
        } catch (err) {
            alert(err.message);
        }
    });

    // Rule Form Setup
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('rule-date').value = today;

    document.getElementById('rule-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const payload = {
            tecnico_id: document.getElementById('rule-tecnico').value,
            modelo: document.getElementById('rule-modelo').value,
            tipo_proceso: document.getElementById('rule-proceso').value,
            fecha: today
        };

        try {
            await fetchApi('/rules', { method: 'POST', body: JSON.stringify(payload) });
            alert('Regla guardada correctamente');
            loadRulesData();
        } catch (err) {
            alert(err.message);
        }
    });

    document.getElementById('refresh-orders-btn').addEventListener('click', loadOrders);

    document.getElementById('btn-save-config')?.addEventListener('click', async () => {
        const val = document.getElementById('config-modo-asignacion').value;
        const statusEl = document.getElementById('config-status');
        statusEl.innerText = 'Guardando...';
        try {
            await fetchApi('/config', { method: 'PUT', body: JSON.stringify({ modo_asignacion: val }) });
            statusEl.innerText = '¡Guardado!';
            setTimeout(() => statusEl.innerText = '', 3000);
        } catch(e) {
            statusEl.innerText = 'Error: ' + e.message;
        }
    });

    // Initial Load
    await loadDashboard();
    await loadTechnicians();
    await loadRulesData();
    await loadConfig();
});

async function loadConfig() {
    try {
        const config = await fetchApi('/config');
        if (config && config.modo_asignacion) {
            document.getElementById('config-modo-asignacion').value = config.modo_asignacion;
        }
    } catch(e) {
        console.error('Error fetching config', e);
    }
}

async function loadDashboard() {
    try {
        const stats = await fetchApi('/dashboard/stats');
        const ordersDiv = document.getElementById('stats-orders');
        ordersDiv.innerHTML = '';
        if (stats.ordersByStatus.length === 0) ordersDiv.innerHTML = '<p>No hay órdenes registradas.</p>';
        stats.ordersByStatus.forEach(stat => {
            ordersDiv.innerHTML += `
                <div style="display:flex; justify-content:space-between; margin-bottom: 0.5rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border-color);">
                    <span class="badge badge-info">${stat.estado.replace('_', ' ').toUpperCase()}</span>
                    <strong>${stat.cantidad}</strong>
                </div>
            `;
        });

        const techDiv = document.getElementById('stats-techs');
        techDiv.innerHTML = '';
        if (stats.technicianLoad.length === 0) techDiv.innerHTML = '<p>No hay técnicos activos.</p>';
        stats.technicianLoad.forEach(tech => {
            techDiv.innerHTML += `
                <div style="display:flex; justify-content:space-between; margin-bottom: 0.5rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border-color);">
                    <span>${tech.tecnico}</span>
                    <span class="badge ${tech.ordenes_activas > 0 ? 'badge-warning' : 'badge-success'}">${tech.ordenes_activas} procesando</span>
                </div>
            `;
        });

        const techs = await fetchApi('/dashboard/technicians');
        const tbody = document.getElementById('dashboard-tech-table');
        tbody.innerHTML = '';
        if (techs.length === 0) tbody.innerHTML = '<tr><td colspan="3">No hay técnicos.</td></tr>';
        
        techs.forEach(t => {
            const ruleStatus = t.tarea_hoy 
                ? `<span class="badge badge-primary">${t.modelo} - ${t.tarea_hoy.toUpperCase()}</span>`
                : '<span class="badge badge-danger" style="background:#ddd; color:#333; border: 1px solid #aaa">Sin Asignación</span>';
                
            tbody.innerHTML += `
                <tr>
                    <td><strong>${t.nombre}</strong></td>
                    <td>${ruleStatus}</td>
                    <td>${t.email}</td>
                </tr>
            `;
        });

        // Actividad Reciente
        const activity = await fetchApi('/dashboard/activity');
        const actBody = document.getElementById('dashboard-activity-table');
        actBody.innerHTML = '';
        if (activity.length === 0) actBody.innerHTML = '<tr><td colspan="4">No hay actividad reciente.</td></tr>';
        
        activity.forEach(a => {
            const dateStr = new Date(a.fecha).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });
            actBody.innerHTML += `
                <tr>
                    <td>${dateStr}</td>
                    <td><strong>${a.orden_servicio}</strong></td>
                    <td>${a.responsable || 'Sistema'}</td>
                    <td><span class="badge ${a.estado_nuevo === 'FINALIZADA' ? 'badge-success' : 'badge-info'}">${a.estado_anterior ? a.estado_anterior.replace('_',' ') : 'Inicio'} &rarr; ${a.estado_nuevo.replace('_',' ')}</span></td>
                </tr>
            `;
        });

    } catch (e) {
        console.error('Error loading dashboard', e);
    }
}

async function loadTechnicians() {
    try {
        const data = await fetchApi('/users/tecnicos');
        const select = document.getElementById('rule-tecnico');
        select.innerHTML = '';
        data.forEach(t => {
            select.innerHTML += `<option value="${t.id}">${t.nombre}</option>`;
        });
    } catch (error) {
        console.error('Error fetching technicians', error);
    }
}

async function loadRulesData() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const rules = await fetchApi(`/rules?fecha=${today}`);
        const tbody = document.getElementById('rules-table-body');
        
        if (rules.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4">No hay reglas activas para hoy.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        rules.forEach(rule => {
            tbody.innerHTML += `
                <tr>
                    <td>${rule.tecnico_nombre}</td>
                    <td><span class="badge badge-info">${rule.modelo}</span></td>
                    <td>${rule.tipo_proceso === 'diagnostico' ? 'Diagnóstico' : 'Reparación'}</td>
                    <td>
                        <button class="btn-secondary remove-rule-btn" data-id="${rule.id}" style="padding:0.25rem 0.5rem; border-color:var(--state-danger); color:var(--state-danger)">Desactivar</button>
                    </td>
                </tr>
            `;
        });

        document.querySelectorAll('.remove-rule-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm('¿Seguro que deseas desactivar esta regla?')) {
                    const id = e.target.getAttribute('data-id');
                    try {
                        await fetchApi(`/rules/${id}`, { method: 'DELETE' });
                        loadRulesData();
                    } catch (err) {
                        alert(err.message);
                    }
                }
            });
        });

    } catch (error) {
        console.error('Error fetching rules', error);
    }
}

async function loadOrders() {
    try {
        const orders = await fetchApi('/orders');
        const tbody = document.getElementById('orders-table-body');
        
        if (orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6">No hay órdenes registradas.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        orders.forEach(o => {
            let stateBadge = 'badge-info';
            if (o.estado.includes('pendiente')) stateBadge = 'badge-warning';
            if (o.estado === 'terminado') stateBadge = 'badge-success';
            if (o.estado === 'en_proceso') stateBadge = 'badge-primary';

            tbody.innerHTML += `
                <tr>
                    <td><strong>${o.orden_servicio}</strong></td>
                    <td>${o.modelo}</td>
                    <td><span class="badge ${stateBadge}">${o.estado.replace('_', ' ').toUpperCase()}</span></td>
                    <td>${o.tipo_proceso.toUpperCase()}</td>
                    <td>${o.tecnico_nombre || '<span style="color:#aaa;">Sin asignar</span>'}</td>
                    <td>${o.prioridad ? '🔥 Alta' : 'Normal'}</td>
                </tr>
            `;
        });
    } catch (error) {
        console.error('Error fetching orders', error);
    }
}

async function loadUsers() {
    try {
        const users = await fetchApi('/users');
        const tbody = document.getElementById('users-table-body');
        
        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">No hay usuarios en el sistema.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        users.forEach(u => {
            const roleBadge = u.rol === 'supervisor' ? 'badge-danger' : (u.rol === 'ejecutivo' ? 'badge-primary' : 'badge-info');
            const statusBadge = u.activo ? '<span class="badge badge-success">Activo</span>' : '<span class="badge" style="background:#666">Inactivo</span>';
            const actionBtn = u.activo ? `<button class="btn-secondary delete-user-btn" data-id="${u.id}" style="padding:0.25rem 0.5rem; border-color:var(--state-danger); color:var(--state-danger)">Deshabilitar / Eliminar</button>` : '';

            tbody.innerHTML += `
                <tr>
                    <td><strong>${u.nombre}</strong></td>
                    <td>${u.email}</td>
                    <td><span class="badge ${roleBadge}">${u.rol.toUpperCase()}</span></td>
                    <td>${statusBadge}</td>
                    <td>${actionBtn}</td>
                </tr>
            `;
        });

        document.querySelectorAll('.delete-user-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm('¿Estás seguro de que deseas eliminar o deshabilitar a este usuario? Esta acción puede afectar las reglas activas.')) {
                    const id = e.target.getAttribute('data-id');
                    try {
                        const res = await fetchApi(`/users/${id}`, { method: 'DELETE' });
                        alert(res.message);
                        loadUsers();
                        loadTechnicians(); // Refresh selects
                    } catch (err) {
                        alert(err.message);
                    }
                }
            });
        });
    } catch (error) {
        console.error('Error fetching users:', error);
    }
}
