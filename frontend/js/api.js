// window.ENV.API_URL permite que al pasar a producción, solo inyectes un script de config antes de api.js
const API_BASE_URL = window.ENV?.API_URL || "http://127.0.0.1:8000/api";

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
    obtenerPoa: async () => {
        const token = localStorage.getItem('access_token');
        const res = await fetch(`${API_BASE_URL}/poa/arbol`, { 
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Error al obtener catálogo POA");
        return await res.json();
    },
    crearProgramaPOA: async (datos) => {
        const token = localStorage.getItem('access_token');
        const res = await fetch(`${API_BASE_URL}/poa/programas`, {
            method: "POST",
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(datos)
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },
    crearProyectoPOA: async (datos) => {
        const token = localStorage.getItem('access_token');
        const res = await fetch(`${API_BASE_URL}/poa/proyectos`, {
            method: "POST",
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(datos)
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },
    crearPartidaPOA: async (datos) => {
        const token = localStorage.getItem('access_token');
        const res = await fetch(`${API_BASE_URL}/poa/partidas`, {
            method: "POST",
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(datos)
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    }
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