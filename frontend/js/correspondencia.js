// JS para la Bandeja de Correspondencia y Ventanilla Única
let correspondenciasCache = [];
let filtroEstadoActual = "TODOS";
let correspondenciaSeleccionadaId = null;
let paginaActualCorr = 1;
const TAMANO_PAGINA_CORR = 50;
document.addEventListener("DOMContentLoaded", async () => {
    verificarTokenYPagina();
    if (document.getElementById("tabla-correspondencia")) {
        inicializarVistaCorrespondencia();
    }
});

async function inicializarVistaCorrespondencia() {
    const rolActual = getEffectiveRole();
    
    const elName = document.getElementById("ui-user-name");
    const elRol = document.getElementById("ui-user-rol");
    if (elName) elName.textContent = localStorage.getItem("user_nombre") || "Usuario";
    if (elRol) elRol.textContent = localStorage.getItem("user_cargo") || "Funcionario"; 

    // Ocultar catálogos y reportes para roles no administrativos
    if (!["ADMIN", "RPC", "PRESUPUESTO"].includes(rolActual)) {
        const btnCatalogos = document.getElementById("menu-catalogos");
        const btnReportes = document.getElementById("menu-reportes");
        if (btnCatalogos) btnCatalogos.style.display = "none";
        if (btnReportes) btnReportes.style.display = "none";
    }

    // Cargar selector de unidades para filtro gerencial
    if (["ADMIN", "RPC", "PRESUPUESTO", "SECRETARIA"].includes(rolActual)) {
        const cntUnidad = document.getElementById("contenedor-filtro-unidad");
        if (cntUnidad) cntUnidad.classList.remove("hidden");
        try {
            const unidades = await window.API.unidades.listar();
            const selectFiltro = document.getElementById("filtro-unidad");
            const selectModal = document.getElementById("unidad_destino_id");

            if (selectFiltro) {
                unidades.forEach(u => {
                    const opt = document.createElement("option");
                    opt.value = u.id;
                    opt.textContent = u.nombre;
                    selectFiltro.appendChild(opt);
                });
            }

            if (selectModal) {
                selectModal.innerHTML = '<option value="">Seleccione Unidad Destino...</option>';
                unidades.forEach(u => {
                    const opt = document.createElement("option");
                    opt.value = u.id;
                    opt.textContent = u.nombre;
                    selectModal.appendChild(opt);
                });
            }
        } catch (e) {
            console.error("No se pudieron cargar las unidades:", e);
        }
    } else {
        // Cargar unidades solo para el modal de ingreso
        try {
            const unidades = await window.API.unidades.listar();
            const selectModal = document.getElementById("unidad_destino_id");
            if (selectModal) {
                selectModal.innerHTML = '<option value="">Seleccione Unidad Destino...</option>';
                unidades.forEach(u => {
                    const opt = document.createElement("option");
                    opt.value = u.id;
                    opt.textContent = u.nombre;
                    selectModal.appendChild(opt);
                });
            }
        } catch (e) {}
    }

    await cargarCorrespondencias();
}

async function cargarCorrespondencias() {
    const filtroSelect = document.getElementById("filtro-unidad");
    let unidadVal = "";
    if (filtroSelect && !filtroSelect.closest('.hidden')) {
        unidadVal = filtroSelect.value;
    }

    try {
        const resp = await window.API.correspondencia.listar(unidadVal ? { unidad_id: unidadVal } : {});
        correspondenciasCache = resp.data || [];
        actualizarKPIsCorrespondencia();
        renderizarTablaCorrespondencia();
    } catch (e) {
        console.error("Error al cargar correspondencias:", e);
        const tbl = document.getElementById("tabla-correspondencia");
        if (tbl) {
            tbl.innerHTML = `
                <tr><td colspan="6" class="py-8 text-center text-rose-600 font-medium">❌ Error al cargar correspondencias: ${e.message}</td></tr>
            `;
        }
    }
}

function esCorrespondenciaPromovida(c) {
    return (c.proceso_id != null && c.proceso_id !== 0) || c.estado_general === "PROMOVIDO_A_COMPRA";
}

function actualizarKPIsCorrespondencia() {
    const activas = correspondenciasCache.filter(c => !esCorrespondenciaPromovida(c)).length;
    const enBandeja = correspondenciasCache.filter(c => !esCorrespondenciaPromovida(c) && c.estado_general === "EN_BANDEJA").length;
    const enProceso = correspondenciasCache.filter(c => !esCorrespondenciaPromovida(c) && c.estado_general === "EN_PROCESO").length;
    const respondidos = correspondenciasCache.filter(c => !esCorrespondenciaPromovida(c) && (c.estado_general === "RESPONDIDO" || c.estado_general === "ATENDIDO")).length;
    const promovidos = correspondenciasCache.filter(c => esCorrespondenciaPromovida(c)).length;

    const elTot = document.getElementById("kpi-corr-total");
    const elBan = document.getElementById("kpi-corr-bandeja");
    const elPro = document.getElementById("kpi-corr-proceso");
    const elRes = document.getElementById("kpi-corr-respondidos");
    const elPrm = document.getElementById("kpi-corr-promovidos");

    if (elTot) elTot.textContent = activas;
    if (elBan) elBan.textContent = enBandeja;
    if (elPro) elPro.textContent = enProceso;
    if (elRes) elRes.textContent = respondidos;
    if (elPrm) elPrm.textContent = promovidos;
}

function cambiarFiltroEstado(estado) {
    filtroEstadoActual = estado;

    const btns = ['btn-filtro-todos', 'btn-filtro-bandeja', 'btn-filtro-proceso', 'btn-filtro-respondidos', 'btn-filtro-promovidos'];
    btns.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.className = "px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-900 transition cursor-pointer";
        }
    });

    const activeMap = {
        'TODOS': 'btn-filtro-todos',
        'EN_BANDEJA': 'btn-filtro-bandeja',
        'EN_PROCESO': 'btn-filtro-proceso',
        'RESPONDIDO': 'btn-filtro-respondidos',
        'PROMOVIDO_A_COMPRA': 'btn-filtro-promovidos'
    };

    const activeEl = document.getElementById(activeMap[estado]);
    if (activeEl) {
        activeEl.className = "px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-slate-900 shadow-xs border border-slate-200 cursor-pointer";
    }

    renderizarTablaCorrespondencia();
}

function renderizarTablaCorrespondencia() {
    const tbody = document.getElementById("tabla-correspondencia");
    if (!tbody) return;

    let datos = correspondenciasCache;

    if (filtroEstadoActual === "TODOS") {
        // En "Todos", excluimos las correspondencias convertidas a procesos de compra
        datos = datos.filter(c => !esCorrespondenciaPromovida(c));
    } else if (filtroEstadoActual === "EN_BANDEJA") {
        datos = datos.filter(c => !esCorrespondenciaPromovida(c) && c.estado_general === "EN_BANDEJA");
    } else if (filtroEstadoActual === "EN_PROCESO") {
        datos = datos.filter(c => !esCorrespondenciaPromovida(c) && c.estado_general === "EN_PROCESO");
    } else if (filtroEstadoActual === "RESPONDIDO") {
        datos = datos.filter(c => !esCorrespondenciaPromovida(c) && (c.estado_general === "RESPONDIDO" || c.estado_general === "ATENDIDO"));
    } else if (filtroEstadoActual === "PROMOVIDO_A_COMPRA") {
        datos = datos.filter(c => esCorrespondenciaPromovida(c));
    }

    const buscador = document.getElementById("buscador");
    if (buscador && buscador.value.trim()) {
        const query = buscador.value.toLowerCase().trim();
        datos = datos.filter(c => 
            (c.numero_hr || "").toLowerCase().includes(query) ||
            (c.nombre_remitente || "").toLowerCase().includes(query) ||
            (c.cite_origen || "").toLowerCase().includes(query) ||
            (c.asunto || "").toLowerCase().includes(query)
        );
    }

    if (datos.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="6" class="py-12 text-center text-slate-400 font-medium">No se encontraron correspondencias en esta vista.</td></tr>
        `;
        renderizarControlesPaginacionCorrespondencia(0, 0, 0);
        return;
    }

    const totalRegistros = datos.length;
    const totalPaginas = Math.ceil(totalRegistros / TAMANO_PAGINA_CORR) || 1;
    if (paginaActualCorr > totalPaginas) paginaActualCorr = totalPaginas;
    if (paginaActualCorr < 1) paginaActualCorr = 1;

    const inicio = (paginaActualCorr - 1) * TAMANO_PAGINA_CORR;
    const fin = Math.min(inicio + TAMANO_PAGINA_CORR, totalRegistros);
    const datosPagina = datos.slice(inicio, fin);

    tbody.innerHTML = datosPagina.map(c => {
        let badgeEstado = '<span class="px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-50 text-amber-700 border border-amber-200">En Bandeja</span>';
        if (c.estado_general === "EN_PROCESO") {
            badgeEstado = '<span class="px-2.5 py-1 rounded-full text-xs font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">🔵 En Proceso</span>';
        } else if (c.estado_general === "RESPONDIDO" || c.estado_general === "ATENDIDO") {
            badgeEstado = '<span class="px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">✅ Respondido</span>';
        } else if (c.estado_general === "PROMOVIDO_A_COMPRA") {
            badgeEstado = '<span class="px-2.5 py-1 rounded-full text-xs font-extrabold bg-blue-50 text-blue-700 border border-blue-200">🛒 Promovido a Compra</span>';
        }

        let btnAccion = `
            <a href="detalle_correspondencia.html?id=${c.id}" class="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition shadow-xs flex items-center gap-1.5 mx-auto w-fit">
                <span>Ver Expediente</span> <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
            </a>
        `;

        if (c.proceso_id) {
            btnAccion = `
                <div class="flex items-center justify-center gap-2">
                    <a href="detalle_correspondencia.html?id=${c.id}" title="Ver Expediente HR" class="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition shadow-xs">
                        <i data-lucide="eye" class="w-4 h-4"></i>
                    </a>
                    <a href="detalle_proceso.html?id=${c.proceso_id}" class="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition shadow-xs flex items-center gap-1.5">
                        <span>Ver Compra</span> <i data-lucide="shopping-bag" class="w-3.5 h-3.5"></i>
                    </a>
                </div>
            `;
        }

        return `
        <tr class="hover:bg-slate-50 transition border-b border-slate-100 last:border-0">
            <td class="px-6 py-4 font-mono font-bold text-indigo-900 text-xs whitespace-nowrap align-middle">
                ${escapeHtml(c.numero_hr)}
                <span class="block text-[10px] text-slate-400 font-normal font-sans">${escapeHtml(c.fecha_recepcion)}</span>
            </td>

            <td class="px-6 py-4 align-middle">
                <div class="flex flex-col">
                    <span class="font-bold text-slate-900 text-xs">${escapeHtml(c.nombre_remitente)}</span>
                    <span class="text-[11px] text-slate-500 font-medium">${escapeHtml(c.cargo_remitente || 'Particular')}</span>
                    ${c.cite_origen ? `<span class="text-[10px] font-mono text-indigo-700 font-bold">${escapeHtml(c.cite_origen)}</span>` : ''}
                </div>
            </td>

            <td class="px-6 py-4 align-middle">
                <p class="line-clamp-2 text-xs font-medium text-slate-800 leading-relaxed" title="${escapeHtml(c.asunto)}">
                    ${escapeHtml(c.asunto)}
                </p>
            </td>

            <td class="px-6 py-4 align-middle whitespace-nowrap">
                <span class="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                    📍 ${escapeHtml(c.unidad_actual)}
                </span>
            </td>

            <td class="px-6 py-4 align-middle whitespace-nowrap text-center">
                ${badgeEstado}
            </td>

            <td class="px-6 py-4 align-middle text-center whitespace-nowrap">
                ${btnAccion}
            </td>
        </tr>
        `;
    }).join("");

    renderizarControlesPaginacionCorrespondencia(inicio, fin, totalRegistros);
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderizarControlesPaginacionCorrespondencia(inicio, fin, total) {
    const tbody = document.getElementById("tabla-correspondencia");
    let pagContainer = document.getElementById("paginacion-corr-container");
    if (!pagContainer && tbody) {
        const parentTable = tbody.closest("table")?.parentElement;
        if (parentTable) {
            pagContainer = document.createElement("div");
            pagContainer.id = "paginacion-corr-container";
            pagContainer.className = "flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 font-medium";
            parentTable.appendChild(pagContainer);
        }
    }
    if (!pagContainer) return;

    if (total === 0) {
        pagContainer.innerHTML = `<span class="text-slate-400 font-normal">Sin registros para mostrar</span>`;
        return;
    }

    const totalPaginas = Math.ceil(total / TAMANO_PAGINA_CORR);

    pagContainer.innerHTML = `
        <span>Mostrando <strong class="text-slate-900">${inicio + 1}</strong> a <strong class="text-slate-900">${fin}</strong> de <strong class="text-slate-900">${total}</strong> correspondencias</span>
        <div class="flex items-center gap-2">
            <button onclick="cambiarPaginaCorrespondencia(-1)" ${paginaActualCorr <= 1 ? 'disabled' : ''} class="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-semibold transition cursor-pointer">
                ← Anterior
            </button>
            <span class="font-bold text-slate-700 px-2">Pág. ${paginaActualCorr} / ${totalPaginas}</span>
            <button onclick="cambiarPaginaCorrespondencia(1)" ${paginaActualCorr >= totalPaginas ? 'disabled' : ''} class="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-semibold transition cursor-pointer">
                Siguiente →
            </button>
        </div>
    `;
}

window.cambiarPaginaCorrespondencia = function(dir) {
    paginaActualCorr += dir;
    renderizarTablaCorrespondencia();
};

function filtrarCorrespondencias() {
    renderizarTablaCorrespondencia();
}

/* =========================================
   SLIDE-OVER: DETALLE Y ATENCIÓN
========================================= */

function abrirSlideOver(data) {
    // Poblar datos
    document.getElementById("so-numero-hr").textContent = data.numero_hr;
    document.getElementById("so-remitente").textContent = data.nombre_remitente;
    document.getElementById("so-cargo").textContent = data.cargo_remitente || "Particular";
    document.getElementById("so-cite").textContent = data.cite_origen || "Sin CITE";
    document.getElementById("so-fecha-doc").textContent = data.fecha_doc_origen || "Sin fecha";
    document.getElementById("so-fojas").textContent = `${data.nro_fojas || 1} fojas`;
    document.getElementById("so-asunto").textContent = data.asunto;
    document.getElementById("so-unidad").textContent = data.unidad_actual || "—";

    // Botón PDF
    const btnPdf = document.getElementById("so-btn-pdf");
    const sinAdjunto = document.getElementById("so-pdf-sin-adjunto");
    const pdfContenedor = document.getElementById("so-pdf-contenedor");
    if (data.tiene_pdf) {
        const token = localStorage.getItem("token") || localStorage.getItem("access_token") || "";
        btnPdf.href = `/api/correspondencia/${data.id}/ver-pdf?token=${encodeURIComponent(token)}`;
        pdfContenedor.classList.remove("hidden");
        sinAdjunto.classList.add("hidden");
    } else {
        pdfContenedor.classList.add("hidden");
        sinAdjunto.classList.remove("hidden");
    }

    // Badge de estado
    const badge = document.getElementById("so-estado-badge");
    const contenedorAcciones = document.getElementById("so-contenedor-acciones");
    const estadoFinal = document.getElementById("so-estado-final");
    const infoAtencion = document.getElementById("so-info-atencion");

    if (data.estado_general === "ATENDIDO") {
        badge.className = "shrink-0 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 mt-1";
        badge.textContent = "✅ ATENDIDO";
        contenedorAcciones.classList.add("hidden");
        estadoFinal.classList.remove("hidden");

        if (data.resumen_respuesta) {
            infoAtencion.classList.remove("hidden");
            document.getElementById("so-nota-gestion-guardada").textContent = data.resumen_respuesta;
            document.getElementById("so-cite-guardado").textContent = data.cite_respuesta ? `CITE: ${data.cite_respuesta}` : "";
            document.getElementById("so-fecha-atencion").textContent = data.fecha_atencion ? `Atendido el ${data.fecha_atencion}` : "";
        }
    } else if (data.estado_general === "PROMOVIDO_A_COMPRA") {
        badge.className = "shrink-0 px-3 py-1 rounded-full text-xs font-extrabold bg-blue-50 text-blue-700 border border-blue-200 mt-1";
        badge.textContent = "🛒 PROMOVIDO A COMPRA";
        contenedorAcciones.classList.add("hidden");
        estadoFinal.classList.remove("hidden");
    } else {
        badge.className = "shrink-0 px-3 py-1 rounded-full text-xs font-extrabold bg-amber-50 text-amber-700 border border-amber-200 mt-1";
        badge.textContent = "EN BANDEJA";
        contenedorAcciones.classList.remove("hidden");
        estadoFinal.classList.add("hidden");
    }

    // Resetear formulario de atención
    const formAtender = document.getElementById("so-form-atender");
    if (formAtender) formAtender.classList.add("hidden");
    const chevron = document.getElementById("so-chevron-atender");
    if (chevron) chevron.classList.remove("rotate-180");
    const notaGestion = document.getElementById("so-nota-gestion");
    if (notaGestion) notaGestion.value = "";
    const citeRespuesta = document.getElementById("so-cite-respuesta");
    if (citeRespuesta) citeRespuesta.value = "";
    const campoCite = document.getElementById("so-campo-cite-respuesta");
    if (campoCite) campoCite.classList.add("hidden");
    // Resetear radio al primer valor
    const radios = document.querySelectorAll('input[name="tipo-atencion"]');
    if (radios.length) radios[0].checked = true;

    // Escuchar cambio en radio para mostrar/ocultar campo CITE
    radios.forEach(r => {
        r.onchange = () => {
            const campoCiteEl = document.getElementById("so-campo-cite-respuesta");
            if (campoCiteEl) {
                if (r.value === "respondida" && r.checked) {
                    campoCiteEl.classList.remove("hidden");
                } else if (r.checked) {
                    campoCiteEl.classList.add("hidden");
                }
            }
        };
    });

    // Animar apertura
    document.getElementById("slideover-overlay").classList.remove("hidden");
    requestAnimationFrame(() => {
        document.getElementById("slideover-panel").classList.remove("translate-x-full");
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function cerrarSlideOver() {
    document.getElementById("slideover-panel").classList.add("translate-x-full");
    setTimeout(() => {
        document.getElementById("slideover-overlay").classList.add("hidden");
    }, 300);
}

function toggleAccionAtender() {
    const form = document.getElementById("so-form-atender");
    const chevron = document.getElementById("so-chevron-atender");
    form.classList.toggle("hidden");
    chevron.classList.toggle("rotate-180");
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function abrirModalDetalleCorrespondencia(id) {
    correspondenciaSeleccionadaId = id;
    try {
        const resp = await window.API.correspondencia.obtener(id);
        const data = resp.data;
        // Necesitamos saber si hay PDF — lo deducimos de si existe ruta_archivo_respuesta
        // La API no expone esto directamente, pero podemos intentar con un fetch HEAD
        data.tiene_pdf = await verificarPdfExiste(id);
        abrirSlideOver(data);
    } catch (e) {
        window.mostrarToast(`No se pudo cargar el detalle: ${e.message}`, "error");
    }
}

async function verificarPdfExiste(id) {
    try {
        const token = localStorage.getItem("token") || localStorage.getItem("access_token") || "";
        const r = await fetch(`/api/correspondencia/${id}/ver-pdf?token=${encodeURIComponent(token)}`, {
            method: "HEAD"
        });
        return r.ok;
    } catch {
        return false;
    }
}

async function enviarAtencionCorrespondencia() {
    if (!correspondenciaSeleccionadaId) return;

    const nota = document.getElementById("so-nota-gestion")?.value.trim();
    if (!nota) {
        window.mostrarToast("Por favor escriba una nota de gestión / observación", "error");
        return;
    }

    const tipoSeleccionado = document.querySelector('input[name="tipo-atencion"]:checked')?.value || "en_proceso";
    const citeResp = document.getElementById("so-cite-respuesta")?.value.trim() || null;

    const payload = {
        cite_respuesta: tipoSeleccionado === "respondida" ? citeResp : null,
        resumen_respuesta: `[${tipoSeleccionado.toUpperCase()}] ${nota}`
    };

    const btnAtender = document.getElementById("so-btn-atender");
    if (btnAtender) {
        btnAtender.disabled = true;
        btnAtender.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Registrando...`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    try {
        const resp = await window.API.correspondencia.atender(correspondenciaSeleccionadaId, payload);
        if (resp.success) {
            window.mostrarToast("Gestión registrada correctamente", "success");
            cerrarSlideOver();
            await cargarCorrespondencias();
        }
    } catch (e) {
        window.mostrarToast(`Error: ${e.message}`, "error");
        if (btnAtender) {
            btnAtender.disabled = false;
            btnAtender.innerHTML = `<i data-lucide="check-circle-2" class="w-4 h-4"></i> Registrar Gestión`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }
}

async function ejecutarPromocionACompra() {
    if (!correspondenciaSeleccionadaId) return;

    if (!confirm("¿Desea convertir esta Hoja de Ruta en un Proceso de Contratación? Esto iniciará el trámite de compras en el Paso 1 (Especificaciones Técnicas).")) {
        return;
    }

    try {
        const resp = await window.API.correspondencia.promover(correspondenciaSeleccionadaId);
        if (resp.success) {
            window.mostrarToast(resp.message, "success");
            cerrarSlideOver();
            const procesoId = resp.data.proceso_id;
            window.location.href = `detalle_proceso.html?id=${procesoId}`;
        }
    } catch (e) {
        window.mostrarToast(`Error al promover a compra: ${e.message}`, "error");
    }
}

/* ========= FUNCIONES LEGACY (Modal 1 - ingreso desde bandeja) ========= */
async function abrirModalNuevaCorrespondencia() {
    const selectModal = document.getElementById("unidad_destino_id");
    if (selectModal && selectModal.options.length <= 1) {
        try {
            const unidades = await window.API.unidades.listar();
            selectModal.innerHTML = '<option value="">Seleccione Unidad Destino...</option>';
            unidades.forEach(u => {
                const opt = document.createElement("option");
                opt.value = u.id;
                opt.textContent = u.nombre;
                selectModal.appendChild(opt);
            });
        } catch (e) {
            console.error("Error cargando unidades:", e);
        }
    }
    document.getElementById("modal-ingreso-correspondencia")?.classList.remove("hidden");
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function cerrarModalNuevaCorrespondencia() {
    document.getElementById("modal-ingreso-correspondencia")?.classList.add("hidden");
}

async function guardarNuevaCorrespondencia(e) {
    e.preventDefault();

    const payload = {
        tipo_remitente: document.getElementById("tipo_remitente").value,
        nombre_remitente: document.getElementById("nombre_remitente").value,
        cargo_remitente: document.getElementById("cargo_remitente").value,
        telefono_remitente: document.getElementById("telefono_remitente").value,
        cite_origen: document.getElementById("cite_origen").value,
        fecha_doc_origen: document.getElementById("fecha_doc_origen").value,
        tipo_documento: document.getElementById("tipo_documento").value,
        asunto: document.getElementById("asunto_corr").value,
        nro_fojas: parseInt(document.getElementById("nro_fojas").value || 1),
        unidad_destino_id: parseInt(document.getElementById("unidad_destino_id").value),
        instruccion_proveido: document.getElementById("instruccion_proveido").value
    };

    if (!payload.unidad_destino_id) {
        window.mostrarToast("Por favor seleccione una Unidad Destino", "error");
        return;
    }

    try {
        const resp = await window.API.correspondencia.crear(payload);
        if (resp.success) {
            window.mostrarToast(resp.message, "success");
            cerrarModalNuevaCorrespondencia();
            await cargarCorrespondencias();
        }
    } catch (err) {
        window.mostrarToast(`Error: ${err.message}`, "error");
    }
}

/* Stubs de compatibilidad para funciones antiguas */
function cerrarModalDetalleCorrespondencia() { cerrarSlideOver(); }
function mostrarFormularioRespuesta() { toggleAccionAtender(); }
function ocultarFormularioRespuesta() { toggleAccionAtender(); }
function enviarRespuestaCorrespondencia() { enviarAtencionCorrespondencia(); }
