/**
 * Layout.js - Componente global estandarizado para Sidebar y Header (GAMCH 2026)
 * Diseño Basado 100% en index.html con matriz de roles y permisos estricta.
 */

window.inicializarLayout = function (configHeader = {}) {
    renderizarSidebar();
    renderizarHeader(configHeader);
};

function renderizarSidebar() {
    const sidebarEl = document.getElementById("app-sidebar");
    if (!sidebarEl) return;

    const currentPath = window.location.pathname.split("/").pop() || "index.html";

    // Obtener el rol de forma segura
    let rolActual = "SOLICITANTE";
    if (typeof getEffectiveRole === "function") {
        rolActual = getEffectiveRole();
    } else {
        rolActual = localStorage.getItem("user_rol_efectivo") || localStorage.getItem("user_rol") || "SOLICITANTE";
    }

    // Definición estricta de permisos por rol
    const items = [
        {
            label: "Ingreso Correspondencia",
            icon: "plus-circle",
            href: "ingreso_correspondencia.html",
            isButton: true,
            roles: ["ADMIN", "SECRETARIA"]
        },
        {
            label: "Bandeja Correspondencia",
            icon: "inbox",
            href: "correspondencia.html",
            roles: ["ADMIN", "RPC", "PRESUPUESTO", "SECRETARIA", "SOLICITANTE", "PASANTE", "AUXILIAR"]
        },
        {
            label: "Bandeja Contrataciones",
            icon: "shopping-bag",
            href: "index.html",
            roles: ["ADMIN", "RPC", "PRESUPUESTO", "SECRETARIA", "SOLICITANTE", "PASANTE", "AUXILIAR"]
        },
        {
            label: "Catálogos & Usuarios",
            icon: "database",
            href: "catalogos.html",
            roles: ["ADMIN", "RPC", "PRESUPUESTO"]
        },
        {
            label: "Métricas & Reportes",
            icon: "bar-chart-3",
            href: "reportes.html",
            roles: ["ADMIN", "RPC", "PRESUPUESTO"]
        }
    ];

    let htmlNav = '';

    items.forEach(item => {
        // Verificar si el rol actual tiene permiso para ver este item
        if (!item.roles.includes(rolActual)) return;

        const esActivo = currentPath === item.href;

        if (item.isButton) {
            htmlNav += `
                <a href="${item.href}"
                    class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-3 rounded-xl transition shadow-md flex items-center gap-3 text-xs mb-3">
                    <i data-lucide="${item.icon}" class="w-4 h-4"></i>
                    <span>${item.label}</span>
                </a>
            `;
        } else {
            const estiloClass = esActivo
                ? "flex items-center gap-3 bg-blue-950/80 text-blue-200 border-l-4 border-blue-500 rounded-r-xl px-4 py-3 text-sm font-semibold transition"
                : "flex items-center gap-3 text-slate-300 hover:text-white hover:bg-slate-800/60 rounded-xl px-4 py-3 text-sm font-medium transition";

            const iconoColor = esActivo ? "text-blue-400" : "text-slate-400";

            htmlNav += `
                <a href="${item.href}" class="${estiloClass}">
                    <i data-lucide="${item.icon}" class="w-4 h-4 ${iconoColor}"></i>
                    <span>${item.label}</span>
                </a>
            `;
        }
    });

    sidebarEl.className = "w-64 bg-slate-900 text-white flex flex-col shrink-0 border-r border-slate-800 h-screen sticky top-0 z-30 shadow-xl";
    sidebarEl.innerHTML = `
        <div class="p-6 border-b border-slate-800 flex items-center gap-3">
            <div class="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center font-bold text-white shadow-lg">
                <i data-lucide="landmark" class="w-5 h-5"></i>
            </div>
            <div>
                <h1 class="font-extrabold text-sm tracking-tight text-white">GAMCH</h1>
                <p class="text-[11px] text-slate-400 font-medium">Gobierno Municipal</p>
            </div>
        </div>

        <nav class="flex-1 p-4 space-y-1 overflow-y-auto">
            ${htmlNav}
        </nav>

        <div class="p-4 border-t border-slate-800">
            <div class="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
                <p class="text-xs font-semibold text-slate-200">Sistema de Seguimiento</p>
                <p class="text-[11px] text-slate-400 mt-0.5">Gestión Documental GAMCH 2026</p>
            </div>
        </div>
    `;

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderizarHeader(config = {}) {
    const headerEl = document.getElementById("app-header");
    if (!headerEl) return;

    const nombreUsuario = localStorage.getItem("user_nombre") || "Usuario GAMCH";
    const cargoUsuario = localStorage.getItem("user_cargo") || localStorage.getItem("user_rol") || "Servidor Público";

    const titulo = config.titulo || "Bandeja de Procesos";
    const subtitulo = config.subtitulo || "Gestión y seguimiento continuo de Hojas de Ruta";
    const badge = config.badge ? `<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200 uppercase tracking-wider">${config.badge}</span>` : "";

    const botonRegreso = config.backUrl ? `
        <a href="${config.backUrl}" class="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition flex items-center gap-2">
            <i data-lucide="arrow-left" class="w-4 h-4"></i> ${config.backText || 'Volver'}
        </a>
    ` : "";

    headerEl.className = "bg-white border-b border-slate-200 px-8 py-5 flex justify-between items-center shrink-0 sticky top-0 z-20 shadow-xs";
    headerEl.innerHTML = `
        <div class="flex items-center gap-3">
            <div>
                <div class="flex items-center gap-2">
                    <h1 class="text-2xl font-bold text-slate-900 tracking-tight">${titulo}</h1>
                    ${badge}
                </div>
                <p class="text-xs text-slate-500 mt-0.5">${subtitulo}</p>
            </div>
        </div>

        <div class="flex items-center gap-4">
            ${botonRegreso}
            <div class="flex items-center gap-3 ${config.backUrl ? 'border-l border-slate-200 pl-4' : ''}">
                <div class="w-8 h-8 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-700 font-bold text-xs">
                    <i data-lucide="user" class="w-4 h-4 text-slate-600"></i>
                </div>
                <div class="text-right">
                    <p id="ui-user-name" class="font-semibold text-xs text-slate-900">${nombreUsuario}</p>
                    <p id="ui-user-rol" class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">${cargoUsuario}</p>
                </div>
                <button onclick="cerrarSesion()" class="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition" title="Cerrar Sesión">
                    <i data-lucide="log-out" class="w-4 h-4"></i>
                </button>
            </div>
        </div>
    `;

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Auto-inicialización al cargar el DOM si no se llama explícitamente
document.addEventListener("DOMContentLoaded", () => {
    // Si no estamos en la página de login, inicializar layout
    if (!window.location.pathname.includes("login.html")) {
        window.inicializarLayout(window.LAYOUT_CONFIG || {});
    }
});
