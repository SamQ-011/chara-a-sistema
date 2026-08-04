/* =================================================================
   MÓDULO DE GESTIÓN DE USUARIOS (EXCLUSIVO ROL RPC)
   GAMCH - Sistema de Seguimiento de Hojas de Ruta
================================================================= */

let usuariosGlobal = [];
let unidadesGlobal = [];
let usuarioEditandoId = null;
let usuarioResetId = null;

document.addEventListener("DOMContentLoaded", () => {
    const rolActual = localStorage.getItem("user_rol");
    
    // Si es RPC, inicializamos la pestaña de usuarios
    if (rolActual === "RPC") {
        inicializarModuloUsuarios();
    }
});

async function inicializarModuloUsuarios() {
    try {
        await cargarUnidadesParaSelect();
        await cargarListaUsuarios();
    } catch (error) {
        console.error("Error al inicializar módulo de usuarios:", error);
    }
}

async function cargarUnidadesParaSelect() {
    try {
        unidadesGlobal = await request("/unidades");
        const selectModal = document.getElementById("modal-user-unidad");
        if (selectModal) {
            selectModal.innerHTML = `<option value="">-- Sin Unidad Asignada / General --</option>` +
                unidadesGlobal.map(u => `<option value="${u.id}">${u.nombre}</option>`).join("");
        }
    } catch (err) {
        console.error("Error al cargar unidades:", err);
    }
}

async function cargarListaUsuarios() {
    mostrarCarga("Cargando lista de usuarios...");
    try {
        usuariosGlobal = await request("/usuarios?incluir_inactivos=true");
        renderizarTablaUsuarios(usuariosGlobal);
    } catch (err) {
        alert("Error al obtener la lista de usuarios: " + (err.message || err));
    } finally {
        ocultarCarga();
    }
}

function renderizarTablaUsuarios(usuarios) {
    const tbody = document.getElementById("tabla-usuarios-body");
    const countBadge = document.getElementById("contador-usuarios");
    if (!tbody) return;

    if (countBadge) countBadge.textContent = `${usuarios.length} usuario(s)`;

    if (usuarios.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-10 text-slate-400">
                    <i data-lucide="user-x" class="w-10 h-10 mx-auto mb-2 opacity-50"></i>
                    No se encontraron usuarios registrados.
                </td>
            </tr>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    tbody.innerHTML = usuarios.map(u => {
        const tituloStr = u.titulo ? `${u.titulo} ` : '';
        const nombreCompleto = `${tituloStr}${u.nombre_completo}`;
        const unidadNombre = u.unidad ? u.unidad.nombre : '<span class="text-slate-400 italic">Sin Asignar</span>';
        
        let badgeRolClass = "bg-slate-100 text-slate-700";
        if (u.rol === "RPC") badgeRolClass = "bg-purple-100 text-purple-800 border-purple-300 font-bold";
        else if (u.rol === "ADMIN") badgeRolClass = "bg-rose-100 text-rose-800 border-rose-300";
        else if (u.rol === "PRESUPUESTO") badgeRolClass = "bg-blue-100 text-blue-800 border-blue-300";
        else if (u.rol === "SOLICITANTE") badgeRolClass = "bg-emerald-100 text-emerald-800 border-emerald-300";
        else if (u.rol === "SECRETARIA") badgeRolClass = "bg-amber-100 text-amber-800 border-amber-300";

        const estadoBadge = u.activo
            ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Activo
               </span>`
            : `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-300">
                <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Inactivo
               </span>`;

        return `
            <tr class="hover:bg-slate-50/80 transition-colors border-b border-slate-100 text-sm">
                <td class="px-6 py-4 font-mono font-bold text-indigo-950">
                    <div class="flex items-center gap-3">
                        <div class="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs shadow-xs border border-indigo-100">
                            ${u.username.substring(0, 2).toUpperCase()}
                        </div>
                        <span>@${u.username}</span>
                    </div>
                </td>
                <td class="px-6 py-4 font-medium text-slate-800">${nombreCompleto}</td>
                <td class="px-6 py-4 text-slate-600">${u.cargo || '<span class="text-slate-400 italic">No especificado</span>'}</td>
                <td class="px-6 py-4">
                    <span class="px-3 py-1 text-xs rounded-lg border ${badgeRolClass}">
                        ${u.rol}
                    </span>
                </td>
                <td class="px-6 py-4 text-slate-600">${unidadNombre}</td>
                <td class="px-6 py-4">${estadoBadge}</td>
                <td class="px-6 py-4 text-right">
                    <div class="flex items-center justify-end gap-1.5">
                        <button onclick="abrirModalEditarUsuario(${u.id})" class="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition" title="Editar Usuario">
                            <i data-lucide="edit-3" class="w-4 h-4"></i>
                        </button>
                        <button onclick="abrirModalResetPassword(${u.id}, '${u.username}')" class="p-2 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition" title="Resetear Contraseña">
                            <i data-lucide="key-round" class="w-4 h-4"></i>
                        </button>
                        <button onclick="toggleEstadoUsuario(${u.id}, ${u.activo})" class="p-2 ${u.activo ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50' : 'text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50'} rounded-lg transition" title="${u.activo ? 'Desactivar Usuario' : 'Reactivar Usuario'}">
                            <i data-lucide="${u.activo ? 'user-x' : 'user-check'}" class="w-4 h-4"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function filtrarUsuarios() {
    const query = document.getElementById("search-usuarios")?.value.toLowerCase().trim() || "";
    const rolFiltro = document.getElementById("filter-rol-usuario")?.value || "";

    const filtrados = usuariosGlobal.filter(u => {
        const matchText = (u.username + " " + u.nombre_completo + " " + (u.cargo || "")).toLowerCase().includes(query);
        const matchRol = rolFiltro === "" || u.rol === rolFiltro;
        return matchText && matchRol;
    });

    renderizarTablaUsuarios(filtrados);
}

/* =========================================
   MODAL DE CREACIÓN / EDICIÓN
========================================= */

function abrirModalCrearUsuario() {
    usuarioEditandoId = null;
    document.getElementById("modal-usuario-titulo").textContent = "Crear Nuevo Usuario";
    document.getElementById("form-usuario").reset();
    
    const campoUsername = document.getElementById("modal-user-username");
    const contenedorPass = document.getElementById("contenedor-modal-user-pass");
    
    campoUsername.disabled = false;
    contenedorPass.style.display = "block";
    document.getElementById("modal-user-pass").required = true;

    const modal = document.getElementById("modal-usuario");
    if (modal) {
        modal.classList.remove("hidden");
        modal.classList.add("flex");
    }
}

function abrirModalEditarUsuario(id) {
    const u = usuariosGlobal.find(user => user.id === id);
    if (!u) return;

    usuarioEditandoId = id;
    document.getElementById("modal-usuario-titulo").textContent = `Editar Usuario (@${u.username})`;
    
    document.getElementById("modal-user-username").value = u.username;
    document.getElementById("modal-user-username").disabled = true; // Inmutable
    
    document.getElementById("modal-user-titulo").value = u.titulo || "";
    document.getElementById("modal-user-nombre").value = u.nombre_completo;
    document.getElementById("modal-user-cargo").value = u.cargo || "";
    document.getElementById("modal-user-rol").value = u.rol;
    document.getElementById("modal-user-unidad").value = u.unidad_id || "";
    
    // Ocultar campo de password en edición
    const contenedorPass = document.getElementById("contenedor-modal-user-pass");
    contenedorPass.style.display = "none";
    document.getElementById("modal-user-pass").required = false;

    const modal = document.getElementById("modal-usuario");
    if (modal) {
        modal.classList.remove("hidden");
        modal.classList.add("flex");
    }
}

function cerrarModalUsuario() {
    const modal = document.getElementById("modal-usuario");
    if (modal) {
        modal.classList.add("hidden");
        modal.classList.remove("flex");
    }
    usuarioEditandoId = null;
}

async function guardarUsuario(e) {
    if (e) e.preventDefault();

    const username = document.getElementById("modal-user-username").value.trim();
    const titulo = document.getElementById("modal-user-titulo").value.trim();
    const nombreCompleto = document.getElementById("modal-user-nombre").value.trim();
    const cargo = document.getElementById("modal-user-cargo").value.trim();
    const rol = document.getElementById("modal-user-rol").value;
    const unidadIdVal = document.getElementById("modal-user-unidad").value;

    if (!nombreCompleto || !rol) {
        return alert("Por favor complete los campos obligatorios.");
    }

    const payload = {
        nombre_completo: nombreCompleto,
        titulo: titulo || null,
        cargo: cargo || null,
        rol: rol,
        unidad_id: unidadIdVal ? parseInt(unidadIdVal) : null
    };

    mostrarCarga(usuarioEditandoId ? "Actualizando usuario..." : "Registrando usuario...");

    try {
        if (usuarioEditandoId) {
            // Edición
            await request(`/usuarios/${usuarioEditandoId}`, {
                method: "PUT",
                body: JSON.stringify(payload)
            });
            alert("Usuario actualizado correctamente.");
        } else {
            // Creación
            const pass = document.getElementById("modal-user-pass").value;
            if (!username || !pass) {
                ocultarCarga();
                return alert("Debe ingresar username y contraseña para el nuevo usuario.");
            }
            if (pass.length < 6) {
                ocultarCarga();
                return alert("La contraseña debe tener al menos 6 caracteres.");
            }

            payload.username = username;
            payload.password = pass;

            await request("/usuarios/", {
                method: "POST",
                body: JSON.stringify(payload)
            });
            alert("Usuario registrado correctamente.");
        }

        cerrarModalUsuario();
        await cargarListaUsuarios();

    } catch (err) {
        alert("Error al guardar usuario: " + (err.message || err));
    } finally {
        ocultarCarga();
    }
}

/* =========================================
   MODAL RESET DE CONTRASEÑA
========================================= */

function abrirModalResetPassword(id, username) {
    usuarioResetId = id;
    document.getElementById("reset-pass-user-title").textContent = `@${username}`;
    document.getElementById("modal-reset-new-pass").value = "";
    
    const modal = document.getElementById("modal-reset-pass");
    if (modal) {
        modal.classList.remove("hidden");
        modal.classList.add("flex");
    }
}

function cerrarModalResetPassword() {
    const modal = document.getElementById("modal-reset-pass");
    if (modal) {
        modal.classList.add("hidden");
        modal.classList.remove("flex");
    }
    usuarioResetId = null;
}

async function guardarResetPassword(e) {
    if (e) e.preventDefault();
    const nuevaPass = document.getElementById("modal-reset-new-pass").value;
    
    if (!nuevaPass || nuevaPass.length < 6) {
        return alert("La contraseña debe tener al menos 6 caracteres.");
    }

    mostrarCarga("Reseteando contraseña...");
    try {
        await request(`/usuarios/${usuarioResetId}/reset-password`, {
            method: "PUT",
            body: JSON.stringify({ nueva_password: nuevaPass })
        });
        alert("Contraseña reseteada exitosamente.");
        cerrarModalResetPassword();
    } catch (err) {
        alert("Error al resetear contraseña: " + (err.message || err));
    } finally {
        ocultarCarga();
    }
}

/* =========================================
   ACTIVACIÓN / DESACTIVACIÓN
========================================= */

async function toggleEstadoUsuario(id, estadoActual) {
    const u = usuariosGlobal.find(user => user.id === id);
    if (!u) return;

    const accion = estadoActual ? "desactivar" : "reactivar";
    if (!confirm(`¿Está seguro de que desea ${accion} al usuario @${u.username}?`)) {
        return;
    }

    mostrarCarga(`Procesando cambio de estado...`);
    try {
        if (estadoActual) {
            // Desactivación
            await request(`/usuarios/${id}`, { method: "DELETE" });
        } else {
            // Reactivación
            await request(`/usuarios/${id}`, {
                method: "PUT",
                body: JSON.stringify({ activo: true })
            });
        }
        await cargarListaUsuarios();
    } catch (err) {
        alert("Error al cambiar estado del usuario: " + (err.message || err));
    } finally {
        ocultarCarga();
    }
}
