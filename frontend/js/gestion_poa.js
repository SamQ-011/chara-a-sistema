let adminCatalogoPOA = [];

async function initAdminPOA() {
    await cargarDatosInicialesPOA();
}

async function cargarDatosInicialesPOA() {
    try {
        const selProgProy = document.getElementById("admin-proy-prog");
        const selProgPart = document.getElementById("admin-part-prog");
        
        // EL BLINDAJE: Si no estamos en la pantalla que tiene estos selectores, abortamos la función silenciosamente.
        if (!selProgProy || !selProgPart) return;

        adminCatalogoPOA = await window.API.catalogos.obtenerPoa();
        
        selProgProy.innerHTML = '<option value="">-- Seleccionar --</option>';
        selProgPart.innerHTML = '<option value="">-- Seleccionar --</option>';

        adminCatalogoPOA.forEach(prog => {
            const opt = `<option value="${prog.id}">${prog.codigo} - ${prog.nombre}</option>`;
            selProgProy.innerHTML += opt;
            selProgPart.innerHTML += opt;
        });
    } catch (e) {
        console.error("Error al cargar POA:", e);
    }
}

function cargarSelectProyectos() {
    const progId = document.getElementById("admin-part-prog").value;
    const selProy = document.getElementById("admin-part-proy");
    selProy.innerHTML = '<option value="">-- Seleccionar --</option>';

    if (!progId) return;

    const prog = adminCatalogoPOA.find(p => p.id == progId);
    if (prog && prog.proyectos) {
        prog.proyectos.forEach(py => {
            selProy.innerHTML += `<option value="${py.id}">${py.codigo_proy} ${py.actividad} - ${py.nombre}</option>`;
        });
    }
}

async function guardarAdminPrograma() {
    const cod = document.getElementById("admin-prog-cod").value.trim();
    const nom = document.getElementById("admin-prog-nom").value.trim();
    if (!cod || !nom) return alert("Llena todos los campos del programa.");

    try {
        await window.API.catalogos.crearProgramaPOA({ codigo: cod, nombre: nom });
        alert("Programa guardado correctamente.");
        document.getElementById("admin-prog-cod").value = "";
        document.getElementById("admin-prog-nom").value = "";
        await cargarDatosInicialesPOA(); // Refresca los selectores
    } catch (e) {
        alert("Error: " + e.message);
    }
}

async function guardarAdminProyecto() {
    const progId = document.getElementById("admin-proy-prog").value;
    const cod = document.getElementById("admin-proy-cod").value.trim();
    const act = document.getElementById("admin-proy-act").value.trim();
    const nom = document.getElementById("admin-proy-nom").value.trim();
    
    if (!progId || !cod || !act || !nom) return alert("Llena todos los campos del proyecto.");

    try {
        await window.API.catalogos.crearProyectoPOA({
            programa_id: parseInt(progId),
            codigo_proy: cod,
            actividad: act,
            nombre: nom
        });
        alert("Proyecto guardado correctamente.");
        document.getElementById("admin-proy-cod").value = "";
        document.getElementById("admin-proy-act").value = "";
        document.getElementById("admin-proy-nom").value = "";
        await cargarDatosInicialesPOA();
    } catch (e) {
        alert("Error: " + e.message);
    }
}

async function guardarAdminPartida() {
    const proyId = document.getElementById("admin-part-proy").value;
    const cod = document.getElementById("admin-part-cod").value.trim();
    const desc = document.getElementById("admin-part-desc").value.trim();
    const ff = document.getElementById("admin-part-ff").value.trim();
    const of = document.getElementById("admin-part-of").value.trim();
    
    if (!proyId || !cod || !desc || !ff || !of) return alert("Llena todos los campos de la partida.");

    try {
        await window.API.catalogos.crearPartidaPOA({
            proyecto_id: parseInt(proyId),
            codigo: cod,
            descripcion: desc,
            ff: ff,
            of: of
        });
        alert("Partida guardada correctamente.");
        document.getElementById("admin-part-cod").value = "";
        document.getElementById("admin-part-desc").value = "";
        document.getElementById("admin-part-ff").value = "";
        document.getElementById("admin-part-of").value = "";
        await cargarDatosInicialesPOA();
    } catch (e) {
        alert("Error: " + e.message);
    }
}

// Inicializar al cargar el script
document.addEventListener("DOMContentLoaded", initAdminPOA);