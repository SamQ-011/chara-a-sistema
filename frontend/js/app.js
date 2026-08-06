// archivo: js/app.js
const API_PROCESOS = "/api/procesos/";
const API_DASHBOARD = "/api/procesos/dashboard";

const tabla = document.getElementById("tabla-procesos");
const buscador = document.getElementById("buscador");

// Variables globales de estado
let procesosCache = [];
let listasClasificadas = { pendientes: [], procesados: [] };
let tabActual = "PENDIENTES";

const estados = {
    BORRADOR: { color: "bg-slate-100 text-slate-700 border-slate-300", icono: "📝" },
    "EN CURSO": { color: "bg-blue-50 text-blue-800 border-blue-200 font-semibold", icono: "🔄" },
    "CON PENDIENTES": { color: "bg-amber-50 text-amber-800 border-amber-200 font-semibold", icono: "⚠️" },
    FINALIZADO: { color: "bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold", icono: "✔" },
    ANULADO: { color: "bg-rose-50 text-rose-800 border-rose-200 font-semibold", icono: "❌" }
};

// Matriz de responsabilidades: ¿Qué debe generar cada rol para considerar su trabajo "terminado"?
const TAREAS_POR_ROL = {
    "SOLICITANTE": ["especificaciones_tecnicas", "solicitud_cp", "solicitud_inicio", "informe_cotizacion", "acta_recepcion", "informe_conformidad"],
    "PRESUPUESTO": ["cert_presupuestaria"],
    "ADMIN": ["informe_cotizacion", "almacenes"],
    "RPC": ["autorizacion_inicio", "notificacion_adjudicacion", "orden_compra"]
};

/*=========================================
    INICIALIZACIÓN
=========================================*/
async function inicializarDashboard() {
    const rolActual = localStorage.getItem("user_rol");
    
    document.getElementById("ui-user-name").textContent = localStorage.getItem("user_nombre") || "Usuario";
    document.getElementById("ui-user-rol").textContent = localStorage.getItem("user_cargo") || "Funcionario"; 
    
    if (!["SOLICITANTE", "SECRETARIA"].includes(rolActual)) {
        const btnSidebar = document.getElementById("btn-nuevo-proceso-sidebar");
        const btnMain = document.getElementById("btn-nuevo-proceso-main");
        
        if (btnSidebar) btnSidebar.style.display = "none";
        if (btnMain) btnMain.style.display = "none";
    }

    if (!["ADMIN", "RPC", "PRESUPUESTO"].includes(rolActual)) {
        const btnCatalogos = document.getElementById("menu-catalogos");
        if (btnCatalogos) btnCatalogos.style.display = "none";
    }

    // NUEVO: Revelar el filtro de unidades para roles gerenciales
    if (["ADMIN", "RPC", "PRESUPUESTO"].includes(rolActual)) {
        document.getElementById("contenedor-filtro-unidad").classList.remove("hidden");
        try {
            const unidades = await window.API.unidades.listar();
            const selectUnidad = document.getElementById("filtro-unidad");
            unidades.forEach(u => {
                const opt = document.createElement("option");
                opt.value = u.id;
                opt.textContent = u.nombre;
                selectUnidad.appendChild(opt);
            });
        } catch (e) {
            console.error("No se pudo cargar el filtro de unidades");
        }
    }

    // Llamamos a la nueva función que carga y clasifica (así podemos re-usarla)
    await cargarProcesosYClasificar();
}

window.recargarBandejaPorUnidad = async function() {
    await cargarProcesosYClasificar();
};

async function cargarProcesosYClasificar() {
    mostrarCarga();
    const rolActual = localStorage.getItem("user_rol");
    const filtroSelect = document.getElementById("filtro-unidad");
    let unidadSeleccionada = "";

    if (filtroSelect && !filtroSelect.closest('.hidden')) {
        unidadSeleccionada = filtroSelect.value;
    }

    try {
        const [procesosData, statsData] = await Promise.all([
            window.API.procesos.listar(unidadSeleccionada ? { unidad_id: unidadSeleccionada } : {}),
            window.API.procesos.dashboard() 
        ]);

        procesosCache = procesosData;
        clasificarBandeja(); 
        renderizarVistaActual();

        if (rolActual === "ADMIN" || rolActual === "RPC") {
            pintarPanelGerencial(statsData.data.metricas_globales);
        }

    } catch (error) {
        tabla.innerHTML = `<tr><td colspan="6" class="text-center py-10 text-rose-600 font-medium">❌ Error: ${error.message}</td></tr>`;
    }
}

/*=========================================
    MOTOR DE CLASIFICACIÓN (EL CEREBRO)
=========================================*/
function clasificarBandeja() {
    const rol = localStorage.getItem("user_rol") || "SOLICITANTE";
    listasClasificadas = { pendientes: [], procesados: [] };

    procesosCache.forEach(p => {
        if (p.estado === "ANULADO") {
            listasClasificadas.procesados.push(p);
            return;
        }

        const tareasObligatorias = TAREAS_POR_ROL[rol] || [];
        const docsFinalizados = p.docs_finalizados || (p.documentos || []).filter(d => d.estado === "FINALIZADO").map(d => d.clave_documento);
        
        // Un trámite está "Terminado para mi rol" únicamente si se han generado TODOS los documentos asignados a mi rol
        const termineMiTrabajo = tareasObligatorias.length > 0 && tareasObligatorias.every(doc => docsFinalizados.includes(doc));
        
        if (termineMiTrabajo || p.estado === "FINALIZADO") {
            listasClasificadas.procesados.push(p);
        } else {
            listasClasificadas.pendientes.push(p);
        }
    });

    actualizarKPIs(rol);
}

/*=========================================
    FILTRADO DESDE CARDS DE KPI
=========================================*/
window.filtrarPorKpi = function(tipo) {
    const cards = ['card-kpi-total', 'card-kpi-encurso', 'card-kpi-pendientes', 'card-kpi-finalizados'];
    cards.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('ring-2', 'ring-blue-700', 'border-blue-700');
    });

    let datosFiltrados = [];
    if (tipo === 'TODOS') {
        document.getElementById('card-kpi-total')?.classList.add('ring-2', 'ring-blue-700');
        datosFiltrados = procesosCache.filter(p => p.estado !== "ANULADO");
    } else if (tipo === 'ENCURSO') {
        document.getElementById('card-kpi-encurso')?.classList.add('ring-2', 'ring-blue-700');
        datosFiltrados = procesosCache.filter(p => p.estado === "EN CURSO" || p.estado === "CON PENDIENTES");
    } else if (tipo === 'PENDIENTES') {
        document.getElementById('card-kpi-pendientes')?.classList.add('ring-2', 'ring-blue-700');
        cambiarTab('PENDIENTES');
        return;
    } else if (tipo === 'FINALIZADOS') {
        document.getElementById('card-kpi-finalizados')?.classList.add('ring-2', 'ring-blue-700');
        datosFiltrados = procesosCache.filter(p => p.estado === "FINALIZADO");
    }

    pintarTabla(datosFiltrados);
};

/*=========================================
    RENDERIZADO DE UI
=========================================*/
window.cambiarTab = function(tab) {
    tabActual = tab;
    
    const btnPendientes = document.getElementById("btn-tab-pendientes");
    const btnProcesados = document.getElementById("btn-tab-procesados");

    if(tab === "PENDIENTES") {
        btnPendientes.className = "text-xs font-bold text-blue-900 border-b-2 border-blue-900 pb-2 transition flex items-center gap-2";
        btnProcesados.className = "text-xs font-semibold text-slate-500 hover:text-slate-800 pb-2 transition flex items-center gap-2";
    } else {
        btnProcesados.className = "text-xs font-bold text-blue-900 border-b-2 border-blue-900 pb-2 transition flex items-center gap-2";
        btnPendientes.className = "text-xs font-semibold text-slate-500 hover:text-slate-800 pb-2 transition flex items-center gap-2";
    }
    
    if(buscador) buscador.value = "";
    renderizarVistaActual();
};

function renderizarVistaActual(filtroTexto = "") {
    let datos = tabActual === "PENDIENTES" ? listasClasificadas.pendientes : listasClasificadas.procesados;

    if (filtroTexto) {
        const texto = filtroTexto.toLowerCase();
        datos = datos.filter(p => 
            (p.codigo_proceso || "").toLowerCase().includes(texto) ||
            (p.objeto_contratacion || "").toLowerCase().includes(texto)
        );
    }

    pintarTabla(datos);
}

const LISTA_DOCS_COMPLETA = [
    { id: "especificaciones_tecnicas", sigla: "ET", nombre: "Especificaciones Técnicas" },
    { id: "solicitud_cp", sigla: "SCP", nombre: "Solicitud CP" },
    { id: "cert_presupuestaria", sigla: "CP", nombre: "Certificación Presupuestaria" },
    { id: "solicitud_inicio", sigla: "SIP", nombre: "Solicitud de Inicio" },
    { id: "autorizacion_inicio", sigla: "AUT", nombre: "Autorización de Inicio" },
    { id: "informe_cotizacion", sigla: "COT", nombre: "Informe de Cotización" },
    { id: "notificacion_adjudicacion", sigla: "NOT", nombre: "Notificación de Adjudicación" },
    { id: "orden_compra", sigla: "OC", nombre: "Orden de Compra / Servicio" },
    { id: "almacenes", sigla: "ALM", nombre: "Almacenes (Ingreso/Salida)" },
    { id: "acta_recepcion", sigla: "ACT", nombre: "Acta de Entrega" },
    { id: "informe_conformidad", sigla: "INF", nombre: "Informe de Conformidad" }
];

function calcularDiasTranscurridos(fechaStr) {
    if (!fechaStr) return 0;
    const fecha = new Date(fechaStr);
    if (isNaN(fecha.getTime())) return 0;
    const hoy = new Date();
    const difMs = hoy - fecha;
    return Math.max(0, Math.floor(difMs / (1000 * 60 * 60 * 24)));
}

function obtenerUbicacionYPendiente(proceso) {
    const docsListos = proceso.docs_finalizados || (proceso.documentos || []).filter(d => d.estado === "FINALIZADO").map(d => d.clave_documento);
    
    const flujoResponsables = [
        { doc: "especificaciones_tecnicas", rol: "SOLICITANTE", label: "Esp. Técnicas" },
        { doc: "solicitud_cp", rol: "SOLICITANTE", label: "Solicitud CP" },
        { doc: "cert_presupuestaria", rol: "PRESUPUESTO", label: "Certificación CP" },
        { doc: "solicitud_inicio", rol: "SOLICITANTE", label: "Solicitud Inicio" },
        { doc: "autorizacion_inicio", rol: "RPC", label: "Autorización Inicio" },
        { doc: "informe_cotizacion", rol: "SOLICITANTE", label: "Informe Cotización" },
        { doc: "notificacion_adjudicacion", rol: "RPC", label: "Notif. Adjudicación" },
        { doc: "orden_compra", rol: "RPC", label: "Orden de Compra" },
        { doc: "almacenes", rol: "ADMIN", label: "Almacenes" },
        { doc: "acta_recepcion", rol: "SOLICITANTE", label: "Acta de Entrega" },
        { doc: "informe_conformidad", rol: "SOLICITANTE", label: "Informe Conformidad" }
    ];

    for (const item of flujoResponsables) {
        if (!docsListos.includes(item.doc)) {
            return { rol: item.rol, label: item.label, listo: false };
        }
    }
    return { rol: "CONCLUIDO", label: "Completado", listo: true };
}

function renderizarBannerAlarma() {
    const bannerId = "banner-alerta-retrasos";
    let bannerEl = document.getElementById(bannerId);
    
    const tramitesCriticos = (listasClasificadas.pendientes || []).filter(p => {
        if (p.estado === "ANULADO" || p.estado === "FINALIZADO") return false;
        const dias = calcularDiasTranscurridos(p.fecha_solicitud || p.fecha_creacion);
        return dias > 5;
    });

    const contenedorSeccion = document.querySelector("section.p-8");
    if (!contenedorSeccion) return;

    if (tramitesCriticos.length > 0) {
        if (!bannerEl) {
            bannerEl = document.createElement("div");
            bannerEl.id = bannerId;
            bannerEl.className = "bg-gradient-to-r from-rose-600 to-rose-700 text-white px-6 py-4 rounded-2xl shadow-md border border-rose-500 mb-6 flex items-center justify-between transition-all";
            contenedorSeccion.insertBefore(bannerEl, contenedorSeccion.firstChild);
        }
        bannerEl.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center font-bold text-white text-lg shrink-0">🚨</div>
                <div>
                    <h4 class="font-bold text-sm">Alerta de Atasco Documental (${tramitesCriticos.length} trámites con retraso crítico)</h4>
                    <p class="text-xs text-rose-100 mt-0.5">Existen trámites asignados a tu bandeja con más de 5 días de antigüedad que requieren tu atención.</p>
                </div>
            </div>
            <button onclick="filtrarPorKpi('PENDIENTES')" class="bg-white text-rose-700 hover:bg-rose-50 px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm shrink-0">
                Ver trámites urgentes
            </button>
        `;
    } else if (bannerEl) {
        bannerEl.remove();
    }
}

function pintarTabla(datos) {
    if (!tabla) return;
    
    renderizarBannerAlarma();

    if (!datos || datos.length === 0) {
        tabla.innerHTML = `<tr><td colspan="6" class="py-16 text-center text-slate-400 font-medium">No se encontraron trámites en esta vista.</td></tr>`;
        return;
    }

    const rol = localStorage.getItem("user_rol") || "SOLICITANTE";
    
    tabla.innerHTML = datos.map(p => {
        const estadoObj = estados[p.estado] || estados.BORRADOR;
        const docsListos = p.docs_finalizados || [];
        
        let btnTexto = "Abrir Expediente";
        let btnColor = "bg-blue-900 hover:bg-blue-800 text-white shadow-xs"; 
        
        if (tabActual === "PROCESADOS") {
            btnTexto = "Ver Expediente";
            btnColor = "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300";
        } else {
            if (rol === "PRESUPUESTO") {
                btnTexto = "Atender Trámite";
                btnColor = "bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs";
            } else if (rol === "ADMIN" || rol === "RPC") {
                btnTexto = "Revisar / Emitir";
                btnColor = "bg-slate-900 hover:bg-slate-800 text-white shadow-xs";
            }
        }

        const semaforoHtml = LISTA_DOCS_COMPLETA.map(doc => {
            const estaCompletado = docsListos.includes(doc.id);
            if (estaCompletado) {
                return `<span class="px-1.5 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 rounded shadow-xs" title="${doc.nombre}: COMPLETADO">${doc.sigla}</span>`;
            } else {
                return `<span class="px-1.5 py-0.5 text-[10px] font-semibold bg-slate-50 text-slate-400 border border-slate-200 rounded opacity-60" title="${doc.nombre}: PENDIENTE">${doc.sigla}</span>`;
            }
        }).join("");

        let checkboxHabilitado = "";
        if (tabActual !== "PROCESADOS" && (p.estado === "EN CURSO" || p.estado === "BORRADOR")) {
            checkboxHabilitado = `<input type="checkbox" value="${p.id}" data-hr="${p.hoja_ruta || p.codigo_proceso}" class="chk-tramite w-4 h-4 cursor-pointer text-blue-900 rounded border-slate-300 focus:ring-blue-700" onchange="verificarSeleccion()">`;
        } else {
            checkboxHabilitado = `<input type="checkbox" disabled class="w-4 h-4 opacity-30 cursor-not-allowed">`;
        }

        const ubicacionInfo = obtenerUbicacionYPendiente(p);
        const dias = calcularDiasTranscurridos(p.fecha_solicitud || p.fecha_creacion);

        let ubicacionBadgeHtml = "";
        if (ubicacionInfo.listo || p.estado === "FINALIZADO") {
            ubicacionBadgeHtml = `<span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">✅ Concluido</span>`;
        } else {
            const colorRol = ubicacionInfo.rol === rol ? "bg-amber-50 text-amber-800 border-amber-200 font-bold" : "bg-slate-100 text-slate-700 border-slate-200 font-medium";
            ubicacionBadgeHtml = `<span class="px-2.5 py-1 rounded-lg text-xs ${colorRol} border flex items-center gap-1.5 w-fit" title="Próximo documento pendiente">
                <i data-lucide="map-pin" class="w-3.5 h-3.5 text-slate-400"></i> ${ubicacionInfo.label} (${ubicacionInfo.rol})
            </span>`;
        }

        let slaBadgeHtml = "";
        if (p.estado !== "FINALIZADO" && p.estado !== "ANULADO") {
            if (dias <= 2) {
                slaBadgeHtml = `<span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200" title="En tiempo normal">🟢 ${dias}d transcurridos</span>`;
            } else if (dias <= 5) {
                slaBadgeHtml = `<span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200" title="Atención requerida">🟡 ${dias}d transcurridos</span>`;
            } else {
                slaBadgeHtml = `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse" title="Alerta de retraso crítico">🔴 🚨 ${dias}d (Atascado)</span>`;
            }
        } else {
            slaBadgeHtml = `<span class="px-2 py-1 rounded-full text-xs font-medium bg-slate-50 text-slate-400 border border-slate-200">--</span>`;
        }

        return `
        <tr class="hover:bg-slate-50/80 transition duration-150 border-b border-slate-100 last:border-0">
            <td class="px-4 py-4 text-center align-middle">
                ${checkboxHabilitado}
            </td>

            <td class="px-6 py-4 font-mono font-bold text-blue-900 text-xs whitespace-nowrap align-middle">${p.hoja_ruta || p.codigo_proceso}</td>
            
            <td class="px-6 py-4 text-slate-700 align-middle">
                <div class="flex flex-col gap-1">
                    <span class="line-clamp-2 font-semibold text-slate-900 text-xs leading-snug" title="${p.objeto_contratacion || 'Sin objeto definido'}">
                        ${p.objeto_contratacion || 'Sin objeto definido'}
                    </span>
                    <span class="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                        <i data-lucide="building" class="w-3 h-3 text-slate-400"></i> ${p.unidad_nombre || 'Sin Unidad Asignada'}
                    </span>
                </div>
            </td>

            <td class="px-6 py-4 align-middle whitespace-nowrap">
                ${ubicacionBadgeHtml}
            </td>

            <td class="px-6 py-4 align-middle">
                <div class="flex flex-wrap gap-1 max-w-[280px]">
                    ${semaforoHtml}
                </div>
            </td>

            <td class="px-6 py-4 whitespace-nowrap align-middle">
                ${slaBadgeHtml}
            </td>

            <td class="px-6 py-4 text-center whitespace-nowrap align-middle">
                <button onclick="gestionarProceso(${p.id})" class="${btnColor} px-3.5 py-2 rounded-lg transition-all font-bold text-xs flex items-center gap-1.5 justify-center mx-auto whitespace-nowrap">
                    <span>${btnTexto}</span> <i data-lucide="${tabActual === 'PROCESADOS' ? 'folder-open' : 'arrow-right'}" class="w-3.5 h-3.5"></i>
                </button>
            </td>
        </tr>
        `;
    }).join("");
    
    lucide.createIcons();
}

/*=========================================
    KPIS Y UTILIDADES
=========================================*/
function actualizarKPIs(rol) {
    const lblTotal = document.getElementById("lbl-kpi-total");
    const lblEnCurso = document.getElementById("lbl-kpi-encurso");
    const lblPendientes = document.getElementById("lbl-kpi-pendientes");
    const lblFinalizados = document.getElementById("lbl-kpi-finalizados");

    if (lblTotal) lblTotal.textContent = rol === "SOLICITANTE" ? "Mis Trámites" : "Total Trámites";
    if (lblEnCurso) lblEnCurso.textContent = "En Curso (Activos)";
    if (lblPendientes) lblPendientes.textContent = "Mis Pendientes";
    if (lblFinalizados) lblFinalizados.textContent = "Procesados / Listos";

    const elTotal = document.getElementById("totalProcesos");
    const elEnCurso = document.getElementById("enCurso");
    const elPendientes = document.getElementById("pendientes");
    const elFinalizados = document.getElementById("finalizados");

    const totalActivos = procesosCache.filter(p => p.estado !== "ANULADO").length;
    const countEnCurso = procesosCache.filter(p => (p.estado === "EN CURSO" || p.estado === "CON PENDIENTES")).length;
    const countPendientesAccion = listasClasificadas.pendientes.length;
    const countFinalizados = listasClasificadas.procesados.filter(p => p.estado !== "ANULADO").length;

    if(elTotal) elTotal.textContent = totalActivos;
    if(elEnCurso) elEnCurso.textContent = countEnCurso;
    if(elPendientes) elPendientes.textContent = countPendientesAccion;
    if(elFinalizados) elFinalizados.textContent = countFinalizados;
}

if (buscador) {
    buscador.addEventListener("input", (e) => {
        renderizarVistaActual(e.target.value);
    });
}

function mostrarCarga() {
    tabla.innerHTML = `<tr><td colspan="4" class="text-center py-12"><div class="flex justify-center items-center gap-3"><div class="w-6 h-6 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div><span class="text-slate-500 font-medium">Clasificando bandeja...</span></div></td></tr>`;
}

function gestionarProceso(id) {
    window.location.href = `detalle_proceso.html?id=${id}`;
}

document.addEventListener("DOMContentLoaded", inicializarDashboard);

function pintarPanelGerencial(metricas) {
    if (!metricas) return;
    document.getElementById("panel-gerencial").classList.remove("hidden");
    const formateador = new Intl.NumberFormat("es-BO", { style: "currency", currency: "BOB" });
    document.getElementById("monto-solicitado").textContent = formateador.format(metricas.presupuesto_solicitado);
    document.getElementById("monto-adjudicado").textContent = formateador.format(metricas.presupuesto_ejecutado);
    const listaUnidades = document.getElementById("lista-unidades");
    if (metricas.carga_por_unidad.length === 0) {
        listaUnidades.innerHTML = `<li class="text-gray-400 italic">No hay cuellos de botella registrados.</li>`;
        return;
    }
    listaUnidades.innerHTML = metricas.carga_por_unidad.map(u => `
        <li class="flex justify-between items-center bg-slate-50 p-2 rounded border border-slate-100">
            <span class="font-medium text-slate-700">${u.unidad}</span>
            <span class="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs font-bold">${u.cantidad} procesos</span>
        </li>
    `).join("");
}

// =========================================
// LÓGICA DE FUSIÓN DE TRÁMITES
// =========================================

function toggleAllCheckboxes(masterChk) {
    const checkboxes = document.querySelectorAll('.chk-tramite');
    checkboxes.forEach(chk => chk.checked = masterChk.checked);
    verificarSeleccion();
}

function verificarSeleccion() {
    const seleccionados = Array.from(document.querySelectorAll('.chk-tramite:checked'));
    const barra = document.getElementById('barra-accion-masiva');
    
    if (seleccionados.length >= 2) {
        document.getElementById('txt-seleccionados').textContent = seleccionados.length;
        barra.classList.remove('hidden');
    } else {
        barra.classList.add('hidden');
    }
}

function abrirModalFusion() {
    const seleccionados = Array.from(document.querySelectorAll('.chk-tramite:checked'));
    // Concatenar las Hojas de Ruta automáticamente para la vista previa
    const hrs = seleccionados.map(chk => chk.getAttribute('data-hr')).filter(hr => hr && hr.trim() !== "");
    document.getElementById('fusion-hr-auto').value = hrs.join(' / ');
    
    const modal = document.getElementById('modal-fusion');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

function cerrarModalFusion() {
    document.getElementById('modal-fusion').classList.add('hidden');
    document.getElementById('modal-fusion').classList.remove('flex');
    document.getElementById('fusion-objeto').value = "";
    document.getElementById('fusion-hr-manual').value = "";
    document.querySelector('input[value="concatenar"]').checked = true;
    toggleInputsHR();
}

function toggleInputsHR() {
    const esManual = document.querySelector('input[name="tipo_hr"]:checked').value === 'nueva';
    const inputManual = document.getElementById('fusion-hr-manual');
    inputManual.disabled = !esManual;
    if(esManual) inputManual.focus();
}

async function ejecutarFusion() {
    const objeto = document.getElementById('fusion-objeto').value.trim();
    if (!objeto) return alert("Debe definir el nuevo objeto de contratación unificado.");

    const tipoHR = document.querySelector('input[name="tipo_hr"]:checked').value;
    let hrFinal = "";
    if (tipoHR === 'concatenar') {
        hrFinal = document.getElementById('fusion-hr-auto').value;
    } else {
        hrFinal = document.getElementById('fusion-hr-manual').value.trim();
        if(!hrFinal) return alert("Debe escribir la nueva Hoja de Ruta.");
    }

    const idsSeleccionados = Array.from(document.querySelectorAll('.chk-tramite:checked')).map(chk => parseInt(chk.value));
    
    const payload = {
        ids_origen: idsSeleccionados,
        objeto_unificado: objeto,
        hoja_ruta_master: hrFinal
    };

    const btn = document.getElementById('btn-ejecutar-fusion');
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Unificando Expedientes...`;
    
    try {
        await ProcesosAPI.fusionar(payload);
        
        cerrarModalFusion();
        document.getElementById('barra-accion-masiva').classList.add('hidden');
        await cargarProcesosYClasificar();
        
        alert("¡Fusión completada con éxito!");
    } catch (error) {
        alert("Error en la fusión: " + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="check-circle" class="w-4 h-4"></i> Fusionar y Crear Expediente`;
    }
}