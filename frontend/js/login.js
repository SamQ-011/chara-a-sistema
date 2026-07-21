// ======================================================
// Referencias del DOM
// ======================================================

const formLogin = document.getElementById("form-login");
const btnLogin = document.getElementById("btn-login");
const mensajeError = document.getElementById("mensaje-error");

// ======================================================
// Evento principal
// ======================================================

formLogin.addEventListener("submit", async (e) => {
    e.preventDefault();

    // ----------------------------------
    // Reiniciar estado
    // ----------------------------------

    mensajeError.classList.add("hidden");
    mensajeError.textContent = "";

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    // ----------------------------------
    // Estado de carga
    // ----------------------------------

    const contenidoOriginalBoton = btnLogin.innerHTML;

    btnLogin.disabled = true;
    btnLogin.innerHTML = `
        <div class="w-5 h-5 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
        Validando...
    `;

    try {


        const payload = new URLSearchParams();
        payload.append("username", username);
        payload.append("password", password);

        const response = await fetch("/api/auth/login", {
            method: "POST",
            body: payload
        });

        if (!response.ok) {
            throw new Error("Usuario o contraseña incorrectos");
        }

        const data = await response.json();

        localStorage.setItem("access_token", data.access_token);
        localStorage.setItem("user_rol", data.rol);
        localStorage.setItem("user_nombre", data.nombre);
        localStorage.setItem("user_cargo", data.cargo);

        console.log("Login exitoso. Redirigiendo...");
        window.location.href = "index.html";

    } catch (error) {

        // Mostrar mensaje
        mensajeError.textContent = error.message;
        mensajeError.classList.remove("hidden");

        // Restaurar botón
        btnLogin.disabled = false;
        btnLogin.innerHTML = contenidoOriginalBoton;

        lucide.createIcons();
    }
});