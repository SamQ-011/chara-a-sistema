// archivo: js/reportes.js

document.addEventListener("DOMContentLoaded", async () => {
    document.getElementById("ui-user-name").textContent = localStorage.getItem("user_nombre") || "Usuario";
    document.getElementById("ui-user-rol").textContent = localStorage.getItem("user_cargo") || "Funcionario";

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

        document.getElementById("rep-monto-solic").textContent = formateador.format(glob.presupuesto_solicitado || 0);
        document.getElementById("rep-monto-adj").textContent = formateador.format(glob.presupuesto_ejecutado || 0);
        document.getElementById("rep-monto-ahorro").textContent = formateador.format(glob.ahorro_acumulado || 0);
        document.getElementById("rep-sla").textContent = `${glob.sla_promedio_dias || 3.5} días`;

        // Renderizar Top Partidas
        const tbodyPartidas = document.getElementById("tabla-top-partidas");
        if (glob.top_partidas && glob.top_partidas.length > 0) {
            tbodyPartidas.innerHTML = glob.top_partidas.map(p => `
                <tr class="hover:bg-slate-50 transition">
                    <td class="px-4 py-3 font-bold text-indigo-900">${p.partida}</td>
                    <td class="px-4 py-3 text-slate-700 font-medium">${p.descripcion}</td>
                    <td class="px-4 py-3 text-right font-black text-slate-900 tabular-nums">${formateador.format(p.monto)}</td>
                </tr>
            `).join("");
        } else {
            tbodyPartidas.innerHTML = `<tr><td colspan="3" class="px-4 py-4 text-center text-slate-400 italic">No hay registros de partidas de gasto.</td></tr>`;
        }

        // Renderizar Ranking Proveedores
        const tbodyProv = document.getElementById("tabla-ranking-proveedores");
        if (glob.ranking_proveedores && glob.ranking_proveedores.length > 0) {
            tbodyProv.innerHTML = glob.ranking_proveedores.map(pr => `
                <tr class="hover:bg-slate-50 transition">
                    <td class="px-4 py-3 font-bold text-slate-800">${pr.proveedor}</td>
                    <td class="px-4 py-3 text-center"><span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px]">${pr.contratos} contrato(s)</span></td>
                    <td class="px-4 py-3 text-right font-black text-emerald-700 tabular-nums">${formateador.format(pr.monto)}</td>
                </tr>
            `).join("");
        } else {
            tbodyProv.innerHTML = `<tr><td colspan="3" class="px-4 py-4 text-center text-slate-400 italic">Sin adjudicaciones registradas en proveedores.</td></tr>`;
        }

        // Renderizar Matriz Consolidada
        const tbodyMatriz = document.getElementById("tabla-matriz-consolidada");
        if (procesosReporteCache.length > 0) {
            tbodyMatriz.innerHTML = procesosReporteCache.map(p => {
                const sol = parseFloat(p.monto_total) || 0;
                const adj = p.monto_adjudicado !== null ? parseFloat(p.monto_adjudicado) : null;
                const ahorro = (adj !== null && sol > adj) ? (sol - adj) : 0;

                const badgeAdj = adj !== null 
                    ? `<span class="font-bold text-emerald-700">${formateador.format(adj)}</span>` 
                    : `<span class="text-amber-600 font-semibold italic text-[11px]">En Proceso</span>`;

                const badgeAhorro = ahorro > 0 
                    ? `<span class="font-bold text-blue-600">+ ${formateador.format(ahorro)}</span>` 
                    : `<span class="text-slate-400">-</span>`;

                return `
                    <tr class="hover:bg-slate-50 transition">
                        <td class="px-6 py-4 font-mono font-bold text-indigo-900">${p.codigo_proceso}</td>
                        <td class="px-6 py-4 font-bold text-slate-800">${p.objeto_contratacion || 'Sin definir'}</td>
                        <td class="px-6 py-4 font-medium text-slate-600">${p.unidad_solicitante || 'S/N'}</td>
                        <td class="px-6 py-4"><span class="px-2.5 py-1 rounded-full text-[10px] font-bold border ${p.estado === 'FINALIZADO' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-blue-50 text-blue-800 border-blue-200'}">${p.estado}</span></td>
                        <td class="px-6 py-4 text-right font-bold text-slate-900 tabular-nums">${formateador.format(sol)}</td>
                        <td class="px-6 py-4 text-right tabular-nums">${badgeAdj}</td>
                        <td class="px-6 py-4 text-right tabular-nums">${badgeAhorro}</td>
                    </tr>
                `;
            }).join("");
        } else {
            tbodyMatriz.innerHTML = `<tr><td colspan="7" class="px-6 py-6 text-center text-slate-400 italic">No hay procesos registrados.</td></tr>`;
        }

        if (typeof lucide !== 'undefined') lucide.createIcons();

    } catch (e) {
        console.error("Error cargando reporte:", e);
        alert("No se pudieron cargar los datos del reporte: " + e.message);
    }
}

function exportarExcelConsolidado() {
    if (!procesosReporteCache || procesosReporteCache.length === 0) {
        alert("No hay procesos disponibles para exportar.");
        return;
    }

    let csvContent = "\uFEFF"; // UTF-8 BOM
    csvContent += "Código Proceso;Hoja de Ruta;Objeto de Contratación;Unidad Solicitante;Estado;Presupuesto Solicitado (Bs);Presupuesto Adjudicado (Bs);Ahorro Municipal (Bs)\n";

    procesosReporteCache.forEach(p => {
        const sol = (parseFloat(p.monto_total) || 0).toFixed(2);
        const adj = p.monto_adjudicado !== null ? (parseFloat(p.monto_adjudicado) || 0).toFixed(2) : "0.00";
        const ahorro = (p.monto_adjudicado !== null && parseFloat(p.monto_total) > parseFloat(p.monto_adjudicado)) 
            ? (parseFloat(p.monto_total) - parseFloat(p.monto_adjudicado)).toFixed(2) 
            : "0.00";

        const objLimpio = String(p.objeto_contratacion || "").replace(/;/g, ",").replace(/\n/g, " ");
        const uniLimpia = String(p.unidad_solicitante || "").replace(/;/g, ",");

        csvContent += `"${p.codigo_proceso}";"${p.hoja_ruta || ''}";"${objLimpio}";"${uniLimpia}";"${p.estado}";${sol};${adj};${ahorro}\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Reporte_Consolidado_GAMCH_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
