// frontend/js/auth.js

window.GAMCH = window.GAMCH || {};

window.GAMCH.Auth = {
    verificarTokenYPagina: function () {
        const token = localStorage.getItem("access_token");
        if (!token && !window.location.pathname.includes("login.html")) {
            window.location.href = "login.html";
        }
    },
    getEffectiveRole: function () {
        return localStorage.getItem("user_rol_efectivo") || localStorage.getItem("user_rol") || "SOLICITANTE";
    },
    cerrarSesion: function () {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_rol");
        localStorage.removeItem("user_rol_efectivo");
        localStorage.removeItem("user_nombre");
        localStorage.removeItem("user_cargo");
        localStorage.removeItem("unidad_id");
        window.location.href = "login.html";
    }
};

// Aliases globales para mantener 100% de compatibilidad
window.verificarTokenYPagina = window.GAMCH.Auth.verificarTokenYPagina;
window.getEffectiveRole = window.GAMCH.Auth.getEffectiveRole;
window.cerrarSesion = window.GAMCH.Auth.cerrarSesion;

verificarTokenYPagina();

document.addEventListener("DOMContentLoaded", () => {
    const elNombre = document.getElementById("ui-user-name");
    const elCargo = document.getElementById("ui-user-rol");
    
    if (elNombre) {
        elNombre.textContent = localStorage.getItem("user_nombre") || "Usuario";
    }
    if (elCargo) {
        elCargo.textContent = localStorage.getItem("user_cargo") || localStorage.getItem("user_rol") || "Servidor Público";
    }
});