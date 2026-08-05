const form = document.getElementById("form-proceso");
const btnGuardar = document.getElementById("btn-guardar");
const selectArea = document.getElementById("area_solicitante");
const pdfInput = document.getElementById("pdf_solicitud");
const dropzone = document.getElementById("pdf-dropzone");
const dropzonePrompt = document.getElementById("dropzone-prompt");
const dropzoneSelected = document.getElementById("dropzone-selected");
const fileNamePreview = document.getElementById("file-name-preview");
const fileSizePreview = document.getElementById("file-size-preview");
const btnRemovePdf = document.getElementById("btn-remove-pdf");

document.addEventListener("DOMContentLoaded", async () => {
    const rolUsuario = localStorage.getItem("user_rol"); 
    
    const contenedorDerivacion = document.getElementById("contenedor_derivacion");
    const selectArea = document.getElementById("area_solicitante");

    if (rolUsuario === "SOLICITANTE") {
        if (contenedorDerivacion) contenedorDerivacion.style.display = "none";
        if (selectArea) selectArea.removeAttribute("required");
    }

    if (!["ADMIN", "RPC", "PRESUPUESTO"].includes(rolUsuario)) {
        const btnCatalogos = document.getElementById("menu-catalogos");
        if (btnCatalogos) btnCatalogos.style.display = "none";
    }

    if (!["SOLICITANTE", "SECRETARIA"].includes(rolUsuario)) {
        const btnSidebar = document.getElementById("btn-nuevo-proceso-sidebar");
        if (btnSidebar) btnSidebar.style.display = "none";
    }

    const fechaEl = document.getElementById('fecha_solicitud');
    if (fechaEl && !fechaEl.value) {
        fechaEl.valueAsDate = new Date();
    }

    try {
        const unidades = await window.API.unidades.listar();
        if (selectArea) {
            selectArea.innerHTML = '<option value="">Seleccione el Área a derivar...</option>';
            unidades.forEach(unidad => {
                const option = document.createElement("option");
                option.value = unidad.id; 
                option.textContent = unidad.nombre; 
                selectArea.appendChild(option);
            });
        }
    } catch (error) {
        console.error("Error al cargar unidades:", error);
        if (selectArea) selectArea.innerHTML = '<option value="">Error al cargar áreas desde el servidor</option>';
    }

    // Lógica del Dropzone PDF
    if (pdfInput) {
        pdfInput.addEventListener("change", manejarSeleccionArchivo);

        if (dropzone) {
            ["dragenter", "dragover"].forEach(eventName => {
                dropzone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    dropzone.classList.add("border-indigo-500", "bg-indigo-50/80");
                }, false);
            });

            ["dragleave", "drop"].forEach(eventName => {
                dropzone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    dropzone.classList.remove("border-indigo-500", "bg-indigo-50/80");
                }, false);
            });
        }

        if (btnRemovePdf) {
            btnRemovePdf.addEventListener("click", (e) => {
                e.stopPropagation();
                pdfInput.value = "";
                resetearDropzone();
            });
        }
    }
});

function manejarSeleccionArchivo() {
    if (pdfInput && pdfInput.files.length > 0) {
        const file = pdfInput.files[0];
        if (file.type !== "application/pdf") {
            toast.warning("Por favor adjunte un archivo en formato PDF.");
            pdfInput.value = "";
            resetearDropzone();
            return;
        }

        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
        if (fileNamePreview) fileNamePreview.textContent = file.name;
        if (fileSizePreview) fileSizePreview.textContent = `${sizeMB} MB`;

        if (dropzonePrompt) dropzonePrompt.classList.add("hidden");
        if (dropzoneSelected) {
            dropzoneSelected.classList.remove("hidden");
            dropzoneSelected.classList.add("flex");
        }
        if (typeof lucide !== 'undefined') lucide.createIcons();
    } else {
        resetearDropzone();
    }
}

function resetearDropzone() {
    if (dropzonePrompt) dropzonePrompt.classList.remove("hidden");
    if (dropzoneSelected) {
        dropzoneSelected.classList.add("hidden");
        dropzoneSelected.classList.remove("flex");
    }
}

if (form) {
    form.addEventListener("submit", async (e) => {
        e.preventDefault(); 
        
        if (!pdfInput || !pdfInput.files.length) {
            toast.warning("Debe adjuntar la solicitud escaneada en formato PDF.");
            return;
        }

        const rolUsuario = localStorage.getItem("user_rol");

        if (rolUsuario !== "SOLICITANTE" && (!selectArea || !selectArea.value)) {
            toast.warning("Debe seleccionar un área de derivación válida.");
            return;
        }

        btnGuardar.disabled = true;
        btnGuardar.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Procesando...`;
        if (typeof lucide !== 'undefined') lucide.createIcons();

        const variables_ui = {
            hoja_ruta: document.getElementById("hoja_ruta").value.trim(),
            objeto: document.getElementById("objeto").value.trim(),
            fecha_corta: document.getElementById("fecha_solicitud").value,
            uni_solic: selectArea ? (selectArea.value || "") : "",
            codigo: "HR-" + Date.now(),
            proveedor: "POR DEFINIR",
            nit: "0",
            desca: "Ventanilla Única",
            cod_proy: "S/A",
            tipo_contratacion: "PENDIENTE",
            monto_total: 0,
Retencion_val: 0,
        };

        try {
            const payload = { variables_ui, items: [], gastos: [] };
            const dataJSON = await window.API.procesos.crear(payload);
            const proceso_id_final = dataJSON.data.proceso_id;

            const formData = new FormData();
            formData.append("file", pdfInput.files[0]);
            await window.API.procesos.subirSolicitud(proceso_id_final, formData);

            toast.success("Trámite ingresado y derivado exitosamente.");

            setTimeout(() => {
                window.location.href = `index.html`;
            }, 1000);

        } catch (error) {
            toast.error("Error al ingresar trámite: " + error.message);
            btnGuardar.disabled = false;
            btnGuardar.innerHTML = `<i data-lucide="send" class="w-5 h-5"></i> Ingresar Trámite y Derivar`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    });
}