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
    BORRADOR: { color: "bg-gray-100 text-gray-700", icono: "📝" },
    "EN CURSO": { color: "bg-blue-100 text-blue-700", icono: "🔄" },
    "CON PENDIENTES": { color: "bg-yellow-100 text-yellow-700", icono: "⚠️" },
    FINALIZADO: { color: "bg-green-100 text-green-700", icono: "✔" },
    ANULADO: { color: "bg-red-100 text-red-700", icono: "❌" }
};

// Matriz de responsabilidades: ¿Qué debe generar cada rol para considerar su trabajo "terminado"?
const TAREAS_POR_ROL = {
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

    if (rolActual !== "ADMIN", "RPC", "PRESUPESTO") {
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
            // Si el select tiene algo, le pasamos ?unidad_id=X a la API (tu API en api.js lo manejará por los params)
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
        tabla.innerHTML = `<tr><td colspan="4" class="text-center py-10 text-red-500 font-medium">❌ Error: ${error.message}</td></tr>`;
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

        if (rol === "SOLICITANTE") {
            // El solicitante considera procesado cuando el trámite muere (Finalizado globalmente)
            if (p.estado === "FINALIZADO") listasClasificadas.procesados.push(p);
            else listasClasificadas.pendientes.push(p);
        } else {
            // Lógica para Presupuesto, RPC, Admin
            const tareasObligatorias = TAREAS_POR_ROL[rol] || [];
            
            // ¿El trámite ya tiene TODOS los documentos que este rol debe emitir?
            const termineMiTrabajo = tareasObligatorias.length > 0 && tareasObligatorias.every(doc => p.docs_finalizados && p.docs_finalizados.includes(doc));
            
            if (termineMiTrabajo) {
                listasClasificadas.procesados.push(p); // Se va de la bandeja al historial
            } else {
                listasClasificadas.pendientes.push(p); // Se queda pidiendo atención
            }
        }
    });

    // Actualizamos las 4 tarjetas de arriba usando nuestra propia data matemática
    actualizarKPIs(rol);
}

/*=========================================
    RENDERIZADO DE UI
=========================================*/
window.cambiarTab = function(tab) {
    tabActual = tab;
    
    const btnPendientes = document.getElementById("btn-tab-pendientes");
    const btnProcesados = document.getElementById("btn-tab-procesados");

    if(tab === "PENDIENTES") {
        btnPendientes.className = "pb-2 text-sm font-bold text-indigo-600 border-b-2 border-indigo-600 transition-all";
        btnProcesados.className = "pb-2 text-sm font-medium text-slate-400 hover:text-slate-700 transition-all";
    } else {
        btnProcesados.className = "pb-2 text-sm font-bold text-indigo-600 border-b-2 border-indigo-600 transition-all";
        btnPendientes.className = "pb-2 text-sm font-medium text-slate-400 hover:text-slate-700 transition-all";
    }
    
    // Al cambiar de tab, limpiamos el buscador
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

function pintarTabla(datos) {
    if (!datos.length) {
        // CAMBIO 1: Cambié colspan="5" a colspan="6" porque agregamos la columna del checkbox
        tabla.innerHTML = `<tr><td colspan="6" class="py-16 text-center text-slate-400 font-medium">No se encontraron trámites en esta vista.</td></tr>`;
        return;
    }

    const rol = localStorage.getItem("user_rol") || "SOLICITANTE";
    
    tabla.innerHTML = datos.map(p => {
        const estadoObj = estados[p.estado] || estados.BORRADOR;
        const docsListos = p.docs_finalizados || [];
        
        // Estilos del botón según pestaña y rol
        let btnTexto = "Abrir Expediente";
        let btnColor = "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 text-white"; 
        
        if (tabActual === "PROCESADOS") {
            btnTexto = "Ver Expediente";
            btnColor = "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-300";
        } else {
            if (rol === "PRESUPUESTO") {
                btnTexto = "Atender Trámite";
                btnColor = "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200 text-white";
            } else if (rol === "ADMIN" || rol === "RPC") {
                btnTexto = "Revisar / Emitir";
                btnColor = "bg-slate-700 hover:bg-slate-800 shadow-slate-200 text-white";
            }
        }

        // CONSTRUCCIÓN DEL SEMÁFORO DE LOS 11 DOCUMENTOS
        const semaforoHtml = LISTA_DOCS_COMPLETA.map(doc => {
            const estaCompletado = docsListos.includes(doc.id);
            if (estaCompletado) {
                return `<span class="px-1.5 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 rounded shadow-xs" title="${doc.nombre}: COMPLETADO">${doc.sigla}</span>`;
            } else {
                return `<span class="px-1.5 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-400 border border-slate-200 rounded opacity-60" title="${doc.nombre}: PENDIENTE">${doc.sigla}</span>`;
            }
        }).join("");

        // ==========================================
        // CAMBIO 2: LÓGICA DEL CHECKBOX DE FUSIÓN
        // Solo se permite fusionar si está EN CURSO o BORRADOR y en la pestaña de pendientes
        // ==========================================
        let checkboxHabilitado = "";
        if (tabActual !== "PROCESADOS" && (p.estado === "EN CURSO" || p.estado === "BORRADOR")) {
            checkboxHabilitado = `<input type="checkbox" value="${p.id}" data-hr="${p.hoja_ruta || p.codigo_proceso}" class="chk-tramite w-4 h-4 cursor-pointer text-indigo-600 rounded focus:ring-indigo-500" onchange="verificarSeleccion()">`;
        } else {
            checkboxHabilitado = `<input type="checkbox" disabled class="w-4 h-4 opacity-30 cursor-not-allowed">`;
        }

        return `
        <tr class="hover:bg-slate-50 transition duration-200 border-b border-slate-100 last:border-0">
            <!-- NUEVA COLUMNA: CHECKBOX -->
            <td class="px-6 py-5 text-center align-middle">
                ${checkboxHabilitado}
            </td>

            <td class="px-8 py-5 font-bold text-indigo-700 whitespace-nowrap align-middle">${p.codigo_proceso}</td>
            
            <td class="px-8 py-5 text-slate-600 font-medium align-middle">
                <div class="flex flex-col gap-1">
                    <span class="line-clamp-2 font-semibold text-slate-800" title="${p.objeto_contratacion || 'Sin objeto definido'}">
                        ${p.objeto_contratacion || 'Sin objeto definido'}
                    </span>
                    <span class="text-xs font-bold text-indigo-600 flex items-center gap-1">
                        🏢 ${p.unidad_nombre || 'Sin Unidad Asignada'}
                    </span>
                </div>
            </td>

            <td class="px-8 py-5 align-middle">
                <div class="flex flex-wrap gap-1 max-w-[280px]">
                    ${semaforoHtml}
                </div>
            </td>

            <td class="px-8 py-5 whitespace-nowrap align-middle">
                <span class="px-3 py-1.5 rounded-lg text-xs font-bold ${estadoObj.color} border border-current/10">
                    ${estadoObj.icono} ${p.estado}
                </span>
            </td>

            <td class="px-8 py-5 text-center whitespace-nowrap align-middle">
                <button onclick="gestionarProceso(${p.id})" class="${btnColor} px-5 py-2.5 rounded-xl transition-all shadow-sm font-semibold text-sm flex items-center gap-2 justify-center mx-auto">
                    ${btnTexto} <i data-lucide="${tabActual === 'PROCESADOS' ? 'folder-open' : 'arrow-right'}" class="w-4 h-4"></i>
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
    // Ajuste de Títulos según rol
    const lblTotal = document.getElementById("lbl-kpi-total");
    const lblEnCurso = document.getElementById("lbl-kpi-encurso");
    const lblPendientes = document.getElementById("lbl-kpi-pendientes");
    const lblFinalizados = document.getElementById("lbl-kpi-finalizados");

    if (rol === "PRESUPUESTO") {
        if(lblEnCurso) lblEnCurso.textContent = "Pendientes (Mi Bandeja)";
        if(lblPendientes) lblPendientes.textContent = "Certificados Hoy";
        if(lblFinalizados) lblFinalizados.textContent = "Total Emitidos";
    } else if (rol === "SOLICITANTE") {
        if(lblTotal) lblTotal.textContent = "Mis Trámites";
        if(lblEnCurso) lblEnCurso.textContent = "En Curso (Activos)";
    }

    // Inyectamos las matemáticas puras de nuestra clasificación
    const elTotal = document.getElementById("totalProcesos");
    const elPendientes = document.getElementById("enCurso");
    const elProcesados = document.getElementById("pendientes");
    const elFinalizados = document.getElementById("finalizados");

    if(elTotal) elTotal.textContent = procesosCache.length;
    if(elPendientes) elPendientes.textContent = listasClasificadas.pendientes.length; // Bandeja activa
    if(elProcesados) elProcesados.textContent = listasClasificadas.procesados.length; // Historial
    if(elFinalizados) elFinalizados.textContent = procesosCache.filter(p => p.estado === "FINALIZADO").length;
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
        cargarProcesos();
        
        alert("¡Fusión completada con éxito!");
    } catch (error) {
        alert("Error en la fusión: " + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="check-circle" class="w-4 h-4"></i> Fusionar y Crear Expediente`;
    }
}