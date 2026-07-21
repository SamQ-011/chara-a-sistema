// Uso de rutas relativas (Estándar de despliegue)
const API_PROCESOS = "/api/procesos/";
const API_DASHBOARD = "/api/procesos/dashboard";

const tabla = document.getElementById("tabla-procesos");
const buscador = document.getElementById("buscador");

let procesosCache = [];

/*=========================================
    ESTADOS (Diccionario visual)
=========================================*/
const estados = {
    BORRADOR: { color: "bg-gray-100 text-gray-700", icono: "📝" },
    "EN CURSO": { color: "bg-blue-100 text-blue-700", icono: "🔄" },
    "CON PENDIENTES": { color: "bg-yellow-100 text-yellow-700", icono: "⚠️" },
    FINALIZADO: { color: "bg-green-100 text-green-700", icono: "✔" },
    ANULADO: { color: "bg-red-100 text-red-700", icono: "❌" }
};

/*=========================================
    INICIALIZACIÓN ASÍNCRONA PARALELA
=========================================*/
async function inicializarDashboard() {
    // 1. Cargar datos del usuario en la cabecera
    const rolActual = localStorage.getItem("user_rol");
    const nombreActual = localStorage.getItem("user_nombre");
    const cargoActual = localStorage.getItem("user_cargo");
    
    document.getElementById("ui-user-name").textContent = nombreActual || "Usuario";
    document.getElementById("ui-user-rol").textContent = cargoActual || "Funcionario"; 
    
    // 2. Control de accesos (Solo SOLICITANTES pueden crear trámites)
    if (rolActual !== "SOLICITANTE") {
        const btnSidebar = document.getElementById("btn-nuevo-proceso-sidebar");
        const btnMain = document.getElementById("btn-nuevo-proceso-main");
        if (btnSidebar) btnSidebar.style.display = "none";
        if (btnMain) btnMain.style.display = "none";
    }

    mostrarCarga();
    
    try {
        // 3. Peticiones concurrentes usando el API wrapper seguro
        const [procesosData, statsData] = await Promise.all([
            window.API.procesos.listar(),
            window.API.procesos.dashboard()
        ]);

        procesosCache = procesosData;

        pintarTabla(procesosCache);
        pintarEstadisticas(statsData.data);

    } catch (error) {
        tabla.innerHTML = `<tr><td colspan="4" class="text-center py-10 text-red-500 font-medium">❌ Error: ${error.message}</td></tr>`;
    }
}

/*=========================================
    SPINNER
=========================================*/
function mostrarCarga() {
    tabla.innerHTML = `
        <tr>
            <td colspan="4" class="text-center py-12">
                <div class="flex justify-center items-center gap-3">
                    <div class="w-6 h-6 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <span class="text-gray-500">Cargando información...</span>
                </div>
            </td>
        </tr>
    `;
}

/*=========================================
    RENDERIZADO DE TABLA
=========================================*/
function pintarTabla(datos) {
    if (!datos.length) {
        tabla.innerHTML = `<tr><td colspan="4" class="py-12 text-center text-gray-400">No existen procesos registrados activos.</td></tr>`;
        return;
    }

    tabla.innerHTML = datos.map(p => {
        const estadoObj = estados[p.estado] || estados.BORRADOR;
        return `
        <tr class="hover:bg-slate-50 transition duration-200">
            <td class="px-8 py-5 font-semibold text-indigo-700">${p.codigo_proceso}</td>
            <td class="px-8 py-5 text-gray-700">${p.objeto_contratacion || 'Sin objeto definido'}</td>
            <td class="px-8 py-5">
                <span class="px-3 py-1 rounded-full text-xs font-semibold ${estadoObj.color}">
                    ${estadoObj.icono} ${p.estado}
                </span>
            </td>
            <td class="px-8 py-5 text-center">
                <button onclick="gestionarProceso(${p.id})" class="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl transition shadow text-sm">
                    Gestionar
                </button>
            </td>
        </tr>
        `;
    }).join("");
}

/*=========================================
    RENDERIZADO DE ESTADÍSTICAS
=========================================*/
function pintarEstadisticas(stats) {
    document.getElementById("totalProcesos").textContent = stats.total || 0;
    document.getElementById("enCurso").textContent = stats["EN CURSO"] || 0;
    document.getElementById("pendientes").textContent = stats["CON PENDIENTES"] || 0;
    document.getElementById("finalizados").textContent = stats["FINALIZADO"] || 0;
}

/*=========================================
    BUSCADOR (Filtrado en memoria)
=========================================*/

if (buscador) {
    buscador.addEventListener("keyup", (e) => {
        const texto = e.target.value.toLowerCase();
        const filtrados = procesosCache.filter(p =>
            (p.codigo_proceso || "").toLowerCase().includes(texto) ||
            (p.objeto_contratacion || "").toLowerCase().includes(texto) ||
            (p.estado || "").toLowerCase().includes(texto)
        );
        pintarTabla(filtrados);
    });
}

function gestionarProceso(id) {
    window.location.href = `detalle_proceso.html?id=${id}`;
}

function filtrarPorEstado(estadoFiltro) {
    // Si hacen clic en "Total" (el primer card), mostramos todo
    if (estadoFiltro === "TODOS") {
        pintarTabla(procesosCache);
        return;
    }
    
    const filtrados = procesosCache.filter(p => p.estado === estadoFiltro);
    pintarTabla(filtrados);
}

// Actualiza pintarEstadisticas para hacer las tarjetas clickeables
function pintarEstadisticas(stats) {
    const cards = [
        { id: "totalProcesos", val: stats.total || 0, estado: "TODOS" },
        { id: "enCurso", val: stats["EN CURSO"] || 0, estado: "EN CURSO" },
        { id: "pendientes", val: stats["CON PENDIENTES"] || 0, estado: "CON PENDIENTES" },
        { id: "finalizados", val: stats["FINALIZADO"] || 0, estado: "FINALIZADO" }
    ];

    cards.forEach(c => {
        const el = document.getElementById(c.id);
        el.textContent = c.val;
        // Hacemos que el contenedor padre de cada card sea clickeable
        el.parentElement.parentElement.parentElement.classList.add("cursor-pointer", "hover:ring-2", "ring-indigo-300");
        el.parentElement.parentElement.parentElement.onclick = () => filtrarPorEstado(c.estado);
    });
}


// Arranque
document.addEventListener("DOMContentLoaded", inicializarDashboard);