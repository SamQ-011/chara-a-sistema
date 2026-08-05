// frontend/js/auth.js

const token = localStorage.getItem("access_token");

// Si no hay token y no estamos en la página de login, expulsar.
if (!token && !window.location.pathname.includes("login.html")) {
    window.location.href = "login.html";
}

// Función global para cerrar sesión
function cerrarSesion() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_rol");
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