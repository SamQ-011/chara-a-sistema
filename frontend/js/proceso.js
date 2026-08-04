const form = document.getElementById("form-proceso");
const btnGuardar = document.getElementById("btn-guardar");
const selectArea = document.getElementById("area_solicitante");

document.addEventListener("DOMContentLoaded", async () => {
    // CORRECCIÓN AQUÍ: Usamos la llave exacta de tu auth.js
    const rolUsuario = localStorage.getItem("user_rol"); 
    
    const contenedorDerivacion = document.getElementById("contenedor_derivacion");
    const selectArea = document.getElementById("area_solicitante");

    if (rolUsuario === "SOLICITANTE") {
            if (contenedorDerivacion) contenedorDerivacion.style.display = "none";
            if (selectArea) selectArea.removeAttribute("required");
    }

    document.getElementById('fecha_solicitud').valueAsDate = new Date();
    try {
        const unidades = await window.API.unidades.listar();
        selectArea.innerHTML = '<option value="">Seleccione el Área a derivar...</option>';
        
        unidades.forEach(unidad => {
            const option = document.createElement("option");
            option.value = unidad.id; 
            option.textContent = unidad.nombre; 
            selectArea.appendChild(option);
        });
    } catch (error) {
        console.error("Error al cargar unidades:", error);
        selectArea.innerHTML = '<option value="">Error al cargar áreas desde el servidor</option>';
    }
});

form.addEventListener("submit", async (e) => {
    e.preventDefault(); 
    
    const pdfInput = document.getElementById("pdf_solicitud");
    if (!pdfInput.files.length) {
        alert("Debe adjuntar la solicitud escaneada en formato PDF.");
        return;
    }

    if (!selectArea.value) {
        alert("Debe seleccionar un área de derivación válida.");
        return;
    }

    btnGuardar.disabled = true;
    btnGuardar.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Procesando...`;
    lucide.createIcons();

    const unidadId = parseInt(selectArea.value, 10);
    const unidadNombre = selectArea.options[selectArea.selectedIndex].text;

    // Payload simplificado para Ventanilla Única
    const variables_ui = {
        hoja_ruta: document.getElementById("hoja_ruta").value.trim(),
        objeto: document.getElementById("objeto").value.trim(),
        fecha_corta: document.getElementById("fecha_solicitud").value,

        uni_solic: selectArea.value,
        
        // --- Defaults técnicos que se llenarán después ---
        codigo: "HR-" + Date.now(),
        proveedor: "POR DEFINIR",
        nit: "0",
        desca: "Ventanilla Única",
        cod_proy: "S/A",
        tipo_contratacion: "PENDIENTE", // Lo definirá el técnico
        monto_total: 0,
        retencion_val: 0,
        
    };

    try {
        // 1. Crear el cascarón del proceso en la BD (Enviamos arrays vacíos de ítems y gastos)
        const payload = { variables_ui, items: [], gastos: [] };
        const dataJSON = await window.API.procesos.crear(payload);
        const proceso_id_final = dataJSON.data.proceso_id;

        // 2. Subir el PDF adjunto
        const formData = new FormData();
        formData.append("file", pdfInput.files[0]);
        await window.API.procesos.subirSolicitud(proceso_id_final, formData);

        // 3. Redirigir a la bandeja o al detalle
        setTimeout(() => {
            window.location.href = `index.html`; // La secretaria vuelve a la bandeja tras derivar
        }, 1000);

    } catch (error) {
        alert("Error al ingresar trámite: " + error.message);
        btnGuardar.disabled = false;
        btnGuardar.innerHTML = `<i data-lucide="send" class="w-5 h-5"></i> Ingresar Trámite y Derivar`;
        if (window.lucide) lucide.createIcons();
    }
});