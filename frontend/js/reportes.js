// archivo: js/reportes.js

document.addEventListener("DOMContentLoaded", async () => {
    document.getElementById("ui-user-name").textContent = localStorage.getItem("user_nombre") || "Usuario";
    document.getElementById("ui-user-rol").textContent = localStorage.getItem("user_cargo") || "Funcionario";
    
    const elPrintFecha = document.getElementById("print-fecha-emision");
    if (elPrintFecha) {
        elPrintFecha.textContent = new Date().toLocaleDateString("es-BO") + " " + new Date().toLocaleTimeString("es-BO", { hour: '2-digit', minute: '2-digit' });
    }

    const rolActual = localStorage.getItem("user_rol");
    if (!["ADMIN", "RPC", "PRESUPUESTO"].includes(rolActual)) {
        alert("Acceso denegado. Este módulo está reservado para RPC, PRESUPUESTO y ADMIN.");
        window.location.href = "index.html";
        return;
    }

    await cargarDatosReportes();
});

let procesosReporteCache = [];

async function cargarDatosReportes() {
    try {
        const [statsData, procesosData] = await Promise.all([
            window.API.procesos.dashboard(),
            window.API.procesos.listar({})
        ]);

        procesosReporteCache = procesosData || [];

        const glob = statsData?.data?.metricas_globales || {};
        const formateador = new Intl.NumberFormat("es-BO", { style: "currency", currency: "BOB" });

        // KPIs principales
        document.getElementById("rep-monto-solic").textContent = formateador.format(glob.presupuesto_solicitado || 0);
        document.getElementById("rep-monto-adj").textContent = formateador.format(glob.presupuesto_ejecutado || 0);
        document.getElementById("rep-monto-ahorro").textContent = formateador.format(glob.ahorro_acumulado || 0);
        document.getElementById("rep-retenciones").textContent = formateador.format(glob.total_retenciones || 0);

        // SLA dinámico
        const elSla = document.getElementById("rep-sla");
        const elSlaSub = document.getElementById("rep-sla-subtitulo");
        if (glob.sla_promedio_dias !== null && glob.sla_promedio_dias !== undefined) {
            elSla.textContent = `${glob.sla_promedio_dias} días`;
            elSlaSub.textContent = glob.sla_promedio_dias <= 5 ? "⚡ Alta Eficiencia Operativa" : "⏳ Requiere revisión";
            elSlaSub.className = `text-[11px] font-bold mt-1 ${glob.sla_promedio_dias <= 5 ? 'text-emerald-600' : 'text-amber-600'}`;
        } else {
            elSla.textContent = "Sin datos";
            elSlaSub.textContent = "Sin trámites finalizados";
            elSlaSub.className = "text-[11px] font-medium mt-1 text-slate-400";
        }

        // Efectividad
        document.getElementById("rep-efectividad").textContent = `${glob.indice_efectividad || 0}%`;
        const efeSub = document.getElementById("rep-efectividad-sub");
        if (efeSub) {
            efeSub.textContent = `${glob.total_finalizados || 0} completados · ${glob.total_anulados || 0} anulados`;
        }

        // Top Partidas
        renderizarTopPartidas(glob.top_partidas, formateador);

        // Ranking Proveedores
        renderizarRankingProveedores(glob.ranking_proveedores, formateador);

        // Distribución por Tipo de Contratación
        renderizarDistribucionTipos(glob.distribucion_tipo_contratacion);

        // Matriz Consolidada
        renderizarMatrizConsolidada(formateador);

        if (typeof lucide !== 'undefined') lucide.createIcons();

    } catch (e) {
        console.error("Error cargando reporte:", e);
        alert("No se pudieron cargar los datos del reporte: " + e.message);
    }
}

function renderizarTopPartidas(partidas, fmt) {
    const tbody = document.getElementById("tabla-top-partidas");
    if (partidas && partidas.length > 0) {
        tbody.innerHTML = partidas.map(p => `
            <tr class="hover:bg-slate-50 transition">
                <td class="px-4 py-3 font-bold text-indigo-900">${p.partida}</td>
                <td class="px-4 py-3 text-slate-700 font-medium">${p.descripcion}</td>
                <td class="px-4 py-3 text-right font-black text-slate-900 tabular-nums">${fmt.format(p.monto)}</td>
            </tr>
        `).join("");
    } else {
        tbody.innerHTML = `<tr><td colspan="3" class="px-4 py-4 text-center text-slate-400 italic">No hay registros de partidas de gasto.</td></tr>`;
    }
}

function renderizarRankingProveedores(proveedores, fmt) {
    const tbody = document.getElementById("tabla-ranking-proveedores");
    if (proveedores && proveedores.length > 0) {
        tbody.innerHTML = proveedores.map(pr => `
            <tr class="hover:bg-slate-50 transition">
                <td class="px-4 py-3 font-bold text-slate-800">${pr.proveedor}</td>
                <td class="px-4 py-3 text-center"><span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px]">${pr.contratos} contrato(s)</span></td>
                <td class="px-4 py-3 text-right font-black text-emerald-700 tabular-nums">${fmt.format(pr.monto)}</td>
            </tr>
        `).join("");
    } else {
        tbody.innerHTML = `<tr><td colspan="3" class="px-4 py-4 text-center text-slate-400 italic">Sin adjudicaciones registradas en proveedores.</td></tr>`;
    }
}

function renderizarDistribucionTipos(tipos) {
    const container = document.getElementById("distribucion-tipos");
    if (!tipos || tipos.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-400 italic col-span-full">No hay tipos de contratación registrados.</p>`;
        return;
    }

    const colores = [
        { bg: "bg-indigo-50", text: "text-indigo-800", border: "border-indigo-200", badge: "bg-indigo-100 text-indigo-700" },
        { bg: "bg-emerald-50", text: "text-emerald-800", border: "border-emerald-200", badge: "bg-emerald-100 text-emerald-700" },
        { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200", badge: "bg-amber-100 text-amber-700" },
        { bg: "bg-rose-50", text: "text-rose-800", border: "border-rose-200", badge: "bg-rose-100 text-rose-700" },
        { bg: "bg-violet-50", text: "text-violet-800", border: "border-violet-200", badge: "bg-violet-100 text-violet-700" }
    ];

    container.innerHTML = tipos.map((t, i) => {
        const c = colores[i % colores.length];
        return `
            <div class="rounded-xl p-4 border ${c.border} ${c.bg} flex justify-between items-center">
                <span class="text-xs font-bold ${c.text}">${t.tipo || 'Sin clasificar'}</span>
                <span class="px-2.5 py-1 rounded-full text-[10px] font-extrabold ${c.badge}">${t.cantidad} trámites</span>
            </div>
        `;
    }).join("");
}

function renderizarMatrizConsolidada(fmt) {
    const tbody = document.getElementById("tabla-matriz-consolidada");

    if (procesosReporteCache.length > 0) {
        tbody.innerHTML = procesosReporteCache.map(p => {
            const sol = parseFloat(p.monto_total) || 0;
            const adj = p.monto_adjudicado !== null && p.monto_adjudicado !== undefined ? parseFloat(p.monto_adjudicado) : null;
            const ret = parseFloat(p.retencion_monto) || 0;
            const ahorro = (adj !== null && sol > adj) ? (sol - adj) : 0;

            const badgeEstado = {
                "FINALIZADO": "bg-emerald-50 text-emerald-800 border-emerald-200",
                "EN CURSO": "bg-blue-50 text-blue-800 border-blue-200",
                "CON PENDIENTES": "bg-amber-50 text-amber-800 border-amber-200",
                "BORRADOR": "bg-slate-50 text-slate-600 border-slate-200",
                "ANULADO": "bg-rose-50 text-rose-800 border-rose-200"
            };

            const badgeAdj = adj !== null
                ? `<span class="font-bold text-emerald-700">${fmt.format(adj)}</span>`
                : `<span class="text-amber-600 font-semibold italic text-[11px]">En Proceso</span>`;

            const badgeAhorro = ahorro > 0
                ? `<span class="font-bold text-blue-600">+ ${fmt.format(ahorro)}</span>`
                : `<span class="text-slate-400">-</span>`;

            const badgeRet = ret > 0
                ? `<span class="font-bold text-rose-600">${fmt.format(ret)}</span>`
                : `<span class="text-slate-400">-</span>`;

            return `
                <tr class="hover:bg-slate-50 transition">
                    <td class="px-6 py-4 font-mono font-bold text-indigo-900">${p.codigo_proceso}</td>
                    <td class="px-6 py-4 font-bold text-slate-800">${p.objeto_contratacion || 'Sin definir'}</td>
                    <td class="px-6 py-4 font-medium text-slate-600">${p.unidad_solicitante || 'S/N'}</td>
                    <td class="px-6 py-4"><span class="px-2.5 py-1 rounded-full text-[10px] font-bold border ${badgeEstado[p.estado] || 'bg-slate-50 text-slate-600 border-slate-200'}">${p.estado}</span></td>
                    <td class="px-6 py-4 text-right font-bold text-slate-900 tabular-nums">${fmt.format(sol)}</td>
                    <td class="px-6 py-4 text-right tabular-nums">${badgeAdj}</td>
                    <td class="px-6 py-4 text-right tabular-nums">${badgeRet}</td>
                    <td class="px-6 py-4 text-right tabular-nums">${badgeAhorro}</td>
                </tr>
            `;
        }).join("");
    } else {
        tbody.innerHTML = `<tr><td colspan="8" class="px-6 py-6 text-center text-slate-400 italic">No hay procesos registrados.</td></tr>`;
    }
}

async function exportarExcelConsolidado() {
    try {
        if (typeof window.mostrarToast === 'function') {
            window.mostrarToast("Generando reporte Excel (.xlsx) institucional...", "info");
        }
        await window.API.procesos.descargarReporteExcel();
        if (typeof window.mostrarToast === 'function') {
            window.mostrarToast("Reporte Excel descargado exitosamente.", "success");
        }
    } catch (e) {
        console.error("Error al descargar Excel:", e);
        alert("Falló la generación del reporte Excel: " + (e.message || e));
    }
}
