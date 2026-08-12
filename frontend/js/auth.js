// frontend/js/auth.js

function verificarTokenYPagina() {
    const token = localStorage.getItem("access_token");
    if (!token && !window.location.pathname.includes("login.html")) {
        window.location.href = "login.html";
    }
}

verificarTokenYPagina();

// Función global para obtener el rol efectivo (Heredado de la Unidad para Pasantes y Auxiliares)
function getEffectiveRole() {
    return localStorage.getItem("user_rol_efectivo") || localStorage.getItem("user_rol") || "SOLICITANTE";
}

// Función global para cerrar sesión
function cerrarSesion() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_rol");
    localStorage.removeItem("user_rol_efectivo");
    localStorage.removeItem("user_nombre");
    localStorage.removeItem("user_cargo");
    window.location.href = "login.html";
}

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