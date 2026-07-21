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
    window.location.href = "login.html";
}