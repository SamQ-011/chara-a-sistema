// window.ENV.API_URL permite que al pasar a producción, solo inyectes un script de config antes de api.js
const API_BASE_URL = window.ENV?.API_URL || (window.location.origin.startsWith("http") ? `${window.location.origin}/api` : "http://127.0.0.1:8000/api");

/* =========================================
   HELPER GLOBAL DE NORMALIZACIÓN DE ÍTEMS (DRY)
========================================= */
window.normalizarItem = function(i) {
    if (!i || typeof i !== "object") return { nro: 1, nro_item: 1, objeto: "", objeto_corto: "", descripcion: "", descripcion_larga: "", tipuni: "", unidad: "", cant: 0, cantidad: 0, precio_unitario: 0, total_item: 0 };

    const limpiarTexto = (val) => {
        if (!val || val === "undefined" || val === "null") return "";
        return String(val).trim();
    };

    const obj = limpiarTexto(i.objeto) || limpiarTexto(i.objeto_corto);
    const desc = limpiarTexto(i.descripcion) || limpiarTexto(i.descripcion_larga);
    const uni = limpiarTexto(i.tipuni) || limpiarTexto(i.unidad);
    const cantVal = parseFloat(i.cant ?? i.cantidad ?? 0);
    const precVal = parseFloat(i.precio_unitario ?? 0);
    const totVal = parseFloat(i.total_item ?? (cantVal * precVal));
    const nroVal = parseInt(i.nro ?? i.nro_item ?? 1);

    return {
        nro: nroVal,
        nro_item: nroVal,
        objeto: obj,
        objeto_corto: obj,
        descripcion: desc,
        descripcion_larga: desc,
        tipuni: uni,
        unidad: uni,
        cant: cantVal,
        cantidad: cantVal,
        precio_unitario: precVal,
        total_item: totVal
    };
};

/* =========================================
   SISTEMA DE NOTIFICACIONES TOAST (MODERNO)
========================================= */

window.mostrarToast = function(mensaje, tipo = "auto", duracion = 4500) {
    let container = document.getElementById("toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        container.className = "fixed top-5 right-5 z-[9999] flex flex-col gap-3 max-w-md w-full pointer-events-none px-4";
        document.body.appendChild(container);
    }

    const lowerMsg = String(mensaje).toLowerCase();

    // Auto-detección inteligente del tipo de mensaje
    let finalTipo = tipo;
    if (tipo === "auto") {
        if (lowerMsg.includes("éxito") || lowerMsg.includes("correctamente") || lowerMsg.includes("completad") || lowerMsg.includes("guardado") || lowerMsg.includes("registrado") || lowerMsg.includes("exitosamente")) {
            finalTipo = "success";
        } else if (lowerMsg.includes("error") || lowerMsg.includes("falló") || lowerMsg.includes("inválid") || lowerMsg.includes("denegad") || lowerMsg.includes("cancelad") || lowerMsg.includes("incorrect")) {
            finalTipo = "error";
        } else if (lowerMsg.includes("advertencia") || lowerMsg.includes("obligatorio") || lowerMsg.includes("debe") || lowerMsg.includes("atención") || lowerMsg.includes("⚠️") || lowerMsg.includes("⛔")) {
            finalTipo = "warning";
        } else {
            finalTipo = "info";
        }
    }

    // Configuración visual según el tipo
    let bgClasses = "bg-slate-900/95 text-slate-100 border-slate-700 shadow-slate-950/30";
    let iconMarkup = `<i data-lucide="info" class="w-5 h-5 text-indigo-400 shrink-0 mt-0.5"></i>`;

    if (finalTipo === "success") {
        bgClasses = "bg-slate-900/95 text-emerald-100 border-emerald-500/50 shadow-emerald-950/20";
        iconMarkup = `<div class="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0"><i data-lucide="check" class="w-4 h-4"></i></div>`;
    } else if (finalTipo === "error") {
        bgClasses = "bg-slate-900/95 text-rose-100 border-rose-500/50 shadow-rose-950/20";
        iconMarkup = `<div class="w-6 h-6 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0"><i data-lucide="alert-circle" class="w-4 h-4"></i></div>`;
    } else if (finalTipo === "warning") {
        bgClasses = "bg-slate-900/95 text-amber-100 border-amber-500/50 shadow-amber-950/20";
        iconMarkup = `<div class="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0"><i data-lucide="alert-triangle" class="w-4 h-4"></i></div>`;
    } else if (finalTipo === "info") {
        bgClasses = "bg-slate-900/95 text-blue-100 border-blue-500/50 shadow-blue-950/20";
        iconMarkup = `<div class="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0"><i data-lucide="info" class="w-4 h-4"></i></div>`;
    }

    const toast = document.createElement("div");
    toast.className = `pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border shadow-2xl backdrop-blur-md transition-all duration-300 transform translate-y-2 opacity-0 ${bgClasses}`;

    // Limpiar emojis repetidos si el texto ya trae
    let mensajeLimpio = mensaje.replace(/^[❌⚠️⛔✅]\s*/, "");

    toast.innerHTML = `
        ${iconMarkup}
        <div class="flex-1 text-sm font-medium leading-snug break-words">${mensajeLimpio}</div>
        <button class="toast-close-btn text-slate-400 hover:text-white transition p-1 -mr-1 -mt-1 rounded-lg">
            <i data-lucide="x" class="w-4 h-4"></i>
        </button>
    `;

    container.appendChild(toast);
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Animación de entrada
    requestAnimationFrame(() => {
        toast.classList.remove("translate-y-2", "opacity-0");
        toast.classList.add("translate-y-0", "opacity-100");
    });

    // Handler para cerrar manualmente
    const closeBtn = toast.querySelector(".toast-close-btn");
    if (closeBtn) {
        closeBtn.addEventListener("click", () => removerToast(toast));
    }

    // Auto-cierre
    const timer = setTimeout(() => removerToast(toast), duracion);

    function removerToast(t) {
        clearTimeout(timer);
        t.classList.remove("translate-y-0", "opacity-100");
        t.classList.add("translate-x-4", "opacity-0");
        setTimeout(() => {
            if (t.parentElement) t.remove();
        }, 300);
    }
};

// Sobreescritura global transparente de alert()
window.alert = function(msg) {
    if (msg) window.mostrarToast(msg, "auto");
};

// Helper Toast global
window.toast = {
    success: (msg, dur) => window.mostrarToast(msg, "success", dur),
    error: (msg, dur) => window.mostrarToast(msg, "error", dur),
    warning: (msg, dur) => window.mostrarToast(msg, "warning", dur),
    info: (msg, dur) => window.mostrarToast(msg, "info", dur)
};

/* =========================================
   CORE FETCH WRAPPER
========================================= */

async function request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = localStorage.getItem("access_token");

    const headers = {
        ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        ...(options.headers || {})
    };

    if (options.body instanceof FormData) {
        delete headers["Content-Type"];
    } else if (!headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
    }

    const config = { ...options, headers };

    try {
        const response = await fetch(url, config);
        
        if (response.status === 401) {
            if (typeof cerrarSesion === "function") cerrarSesion();
            throw new Error("Sesión expirada o inválida.");
        }

        const isJson = response.headers.get("content-type")?.includes("application/json");
        const data = isJson ? await response.json() : null;

        if (!response.ok) {
            throw new Error(data?.message || data?.detail || "Error en la petición al servidor");
        }

        return data;

    } catch (error) {
        console.error(`[API ERROR] ${endpoint}`, error.message);
        throw error;
    }
}


window.mostrarCarga = function(mensaje = "Procesando documento...") {
    const overlay = document.getElementById("loading-overlay");
    const txt = document.getElementById("loading-text");
    if (txt) txt.textContent = mensaje;
    if (overlay) {
        overlay.classList.remove("hidden");
        overlay.classList.add("flex");
    }
};

window.ocultarCarga = function() {
    const overlay = document.getElementById("loading-overlay");
    if (overlay) {
        overlay.classList.add("hidden");
        overlay.classList.remove("flex");
    }
};

window.abrirVisorPDF = function(fileURL, titulo = "Documento Oficial") {
    const modal = document.getElementById("modal-visor-pdf");
    const iframe = document.getElementById("iframe-visor-pdf");
    const tituloTxt = document.getElementById("visor-titulo-doc");

    if (tituloTxt) tituloTxt.textContent = titulo;
    if (iframe) iframe.src = fileURL;
    if (modal) {
        modal.classList.remove("hidden");
        modal.classList.add("flex");
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.cerrarVisorPDF = function() {
    const modal = document.getElementById("modal-visor-pdf");
    const iframe = document.getElementById("iframe-visor-pdf");
    if (modal) {
        modal.classList.add("hidden");
        modal.classList.remove("flex");
    }
    if (iframe) iframe.src = "about:blank"; // Limpieza de memoria
};

/* =========================================
   CORE DOWNLOAD / VIEW WRAPPER
========================================= */

async function downloadFile(endpoint, nombreArchivo = "documento", formato = "word") {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = localStorage.getItem("access_token");

    mostrarCarga(formato === "pdf" ? "Generando previsualización..." : "Preparando descarga...");

    try {
        const response = await fetch(url, {
            method: "GET",
            headers: {
                ...(token ? { "Authorization": `Bearer ${token}` } : {})
            }
        });

        if (response.status === 401) throw new Error("Sesión expirada. No se puede acceder al archivo.");
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || "Error en el servidor al generar el documento.");
        }

        const rawBlob = await response.blob();

        if (formato === "pdf") {
            // MOSTRAR EN VISOR INTEGRADO
            const pdfBlob = new Blob([rawBlob], { type: "application/pdf" });
            const fileURL = URL.createObjectURL(pdfBlob);
            
            ocultarCarga();
            abrirVisorPDF(fileURL, nombreArchivo);

        } else {
            // DESCARGA DIRECTA (Word / Excel / ZIP)
            const fileURL = URL.createObjectURL(rawBlob);
            const a = document.createElement("a");
            a.href = fileURL;

            const disposition = response.headers.get('Content-Disposition');
            if (disposition && disposition.includes('filename=')) {
                const matches = /filename="?([^"]+)"?/.exec(disposition);
                if (matches != null && matches[1]) nombreArchivo = matches[1];
            } else if (formato === "zip") {
                nombreArchivo += ".zip";
            } else {
                nombreArchivo += rawBlob.type.includes("spreadsheetml") ? ".xlsx" : ".docx";
            }

            a.download = nombreArchivo;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            ocultarCarga();
            setTimeout(() => window.URL.revokeObjectURL(fileURL), 1000);
        }

    } catch (error) {
        ocultarCarga();
        console.error(`[DOWNLOAD ERROR]`, error.message);
        alert(`❌ ${error.message}`);
    }
}

/* =========================================
   PROCESOS API
========================================= */

const ProcesosAPI = {
    listar: async (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return await request(`/procesos${query ? `?${query}` : ""}`);
    },
    verSolicitudInicial: async (procesoId) => 
        await downloadFile(`/procesos/${procesoId}/ver-solicitud`, `Solicitud_Inicial_${procesoId}`, "pdf"),
    
    // NUEVO: DESCARGA MASIVA DEL EXPEDIENTE COMPLETO EN ZIP
    descargarExpedienteZip: async (procesoId) => 
        await downloadFile(`/procesos/${procesoId}/descargar-zip`, `Expediente_Completo_${procesoId}`, "zip"),

    obtener: async (id) => await request(`/procesos/${id}`),
    crear: async (payload) => await request(`/procesos`, { method: "POST", body: JSON.stringify(payload) }),
    actualizar: async (id, payload) => await request(`/procesos/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
    eliminar: async (id) => await request(`/procesos/${id}`, { method: "DELETE" }),
    subirSolicitud: async (procesoId, formData) => await request(`/procesos/${procesoId}/subir-solicitud`, { method: "POST", body: formData }),
    guardarDocumento: async (procesoId, payload) => await request(`/procesos/${procesoId}/documentos`, { method: "POST", body: JSON.stringify(payload) }),
    dashboard: async () => await request(`/procesos/dashboard`),
    descargarReporteExcel: async () => await downloadFile("/procesos/reportes/excel", "Reporte_Consolidado_GAMCH", "xlsx"),
    descargarDocumento: async (procesoId, tipoDoc, formato = 'word') => 
        await downloadFile(`/procesos/${procesoId}/documentos/${tipoDoc}?formato=${formato}`, tipoDoc, formato),
    fusionar: async (payload) => await request("/procesos/fusionar", {method: "POST",body: JSON.stringify(payload)}),
};

/* =========================================
   UNIDADES Y PROVEEDORES
========================================= */

const ProveedoresAPI = {
    listar: async () => await request(`/proveedores`),
    crear: async (payload) => await request(`/proveedores`, { method: "POST", body: JSON.stringify(payload) })
};

const UnidadesAPI = {
    listar: async () => await request(`/unidades`) 
};

/* =========================================
   PROYECTOS
========================================= */

const ProyectosAPI = {
    listar: async () => await request(`/proyectos`)
};

/* =========================================
   DOCUMENTOS
========================================= */

const DocumentosAPI = {
    generar: async (procesoId, tipoDocumento) => await request(`/procesos/${procesoId}/documentos/${tipoDocumento}`, { method: "POST" }),
    listar: async (procesoId) => await request(`/procesos/${procesoId}/documentos`)
};

/* =========================================
   DASHBOARD
========================================= */

const DashboardAPI = {
    obtener: async () => await request(`/dashboard`)
};

const CatalogosAPI = {
    obtenerPoa: async () => await request("/poa/arbol"),
    crearProgramaPOA: async (datos) => await request("/poa/programas", { method: "POST", body: JSON.stringify(datos) }),
    crearProyectoPOA: async (datos) => await request("/poa/proyectos", { method: "POST", body: JSON.stringify(datos) }),
    crearPartidaPOA: async (datos) => await request("/poa/partidas", { method: "POST", body: JSON.stringify(datos) })
};

window.API = {
    procesos: ProcesosAPI,
    proveedores: ProveedoresAPI,
    proyectos: ProyectosAPI,
    documentos: DocumentosAPI,
    dashboard: DashboardAPI,
    unidades: UnidadesAPI,
    catalogos: CatalogosAPI
};