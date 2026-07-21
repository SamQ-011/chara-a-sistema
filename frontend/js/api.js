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

async function downloadFile(endpoint, nombreArchivo = "documento.docx") {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = localStorage.getItem("access_token");

    try {
        const response = await fetch(url, {
            method: "GET",
            headers: {
                ...(token ? { "Authorization": `Bearer ${token}` } : {})
            }
        });

        if (response.status === 401) throw new Error("Sesión expirada. No se puede descargar el archivo.");
        if (!response.ok) throw new Error("Error en el servidor al generar el documento.");

        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        
        const disposition = response.headers.get('Content-Disposition');
        if (disposition && disposition.includes('filename=')) {
            const matches = /filename="?([^"]+)"?/.exec(disposition);
            if (matches != null && matches[1]) nombreArchivo = matches[1];
        }
        
        a.download = nombreArchivo;
        document.body.appendChild(a);
        a.click();
        
        document.body.removeChild(a);
        window.URL.revokeObjectURL(downloadUrl);

    } catch (error) {
        console.error(`[DOWNLOAD ERROR]`, error.message);
        throw error;
    }
}

/* =========================================
   PROCESOS
========================================= */

const ProcesosAPI = {
    listar: async (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return await request(`/procesos${query ? `?${query}` : ""}`);
    },
    obtener: async (id) => await request(`/procesos/${id}`),
    crear: async (payload) => await request(`/procesos`, { method: "POST", body: JSON.stringify(payload) }),
    actualizar: async (id, payload) => await request(`/procesos/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
    eliminar: async (id) => await request(`/procesos/${id}`, { method: "DELETE" }),
    subirSolicitud: async (procesoId, formData) => await request(`/procesos/${procesoId}/subir-solicitud`, { method: "POST", body: formData }),
    guardarDocumento: async (procesoId, payload) => await request(`/procesos/${procesoId}/documentos`, { method: "POST", body: JSON.stringify(payload) }),
    dashboard: async () => await request(`/procesos/dashboard`),
    descargarDocumento: async (procesoId, tipoDoc) => await downloadFile(`/procesos/${procesoId}/documentos/${tipoDoc}`)
};

/* =========================================
   PROVEEDORES
========================================= */

const ProveedoresAPI = {
    listar: async () => await request(`/proveedores`),
    crear: async (payload) => await request(`/proveedores`, { method: "POST", body: JSON.stringify(payload) })
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

window.API = {
    procesos: ProcesosAPI,
    proveedores: ProveedoresAPI,
    proyectos: ProyectosAPI,
    documentos: DocumentosAPI,
    dashboard: DashboardAPI
};