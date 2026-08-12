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
    const form = document.getElementById("form-proceso");
    if (form) {
        form.addEventListener("submit", guardarCorrespondenciaPagina);
    }

    const rolUsuario = getEffectiveRole();

    const contenedorDerivacion = document.getElementById("contenedor_derivacion");
    const selectArea = document.getElementById("area_solicitante");

    const fechaEl = document.getElementById('fecha_solicitud');
    if (fechaEl && !fechaEl.value) {
        fechaEl.valueAsDate = new Date();
    }

    try {
        const unidades = await window.API.unidades.listar();
        const userUnidadId = localStorage.getItem("user_unidad_id");
        if (selectArea) {
            selectArea.innerHTML = '<option value="">Seleccione el Área Solicitante...</option>';
            unidades.forEach(unidad => {
                const option = document.createElement("option");
                option.value = unidad.id;
                option.textContent = unidad.nombre;
                if (userUnidadId && String(unidad.id) === String(userUnidadId)) {
                    option.selected = true;
                }
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
            if (typeof toast !== 'undefined') toast.warning("Por favor adjunte un archivo en formato PDF.");
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

async function guardarCorrespondenciaPagina(e) {
    e.preventDefault();

    const selectArea = document.getElementById("area_solicitante");
    const objetoEl = document.getElementById("objeto");
    const fechaEl = document.getElementById("fecha_solicitud");
    const pdfInput = document.getElementById("pdf_solicitud");

    if (!selectArea || !selectArea.value) {
        window.mostrarToast("Debe seleccionar el Área Solicitante", "error");
        return;
    }
    if (!objetoEl || !objetoEl.value.trim()) {
        window.mostrarToast("Debe ingresar el Objeto o Nombre de la Solicitud", "error");
        return;
    }
    if (!pdfInput || pdfInput.files.length === 0) {
        window.mostrarToast("Debe adjuntar la Solicitud Escaneada en formato PDF", "error");
        return;
    }

    const btnGuardar = document.getElementById("btn-guardar");
    if (btnGuardar) {
        btnGuardar.disabled = true;
        btnGuardar.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Registrando Proceso...`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    const formData = new FormData();
    formData.append("unidad_solicitante_id", parseInt(selectArea.value));
    formData.append("objeto", objetoEl.value.trim());
    formData.append("fecha_solicitud", fechaEl?.value || new Date().toISOString().split('T')[0]);
    formData.append("pdf_solicitud", pdfInput.files[0]);

    try {
        const token = localStorage.getItem("token") || localStorage.getItem("access_token");
        const resp = await fetch("/api/procesos/crear-solicitud-form", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`
            },
            body: formData
        });

        const data = await resp.json();
        if (resp.ok && data.success) {
            window.mostrarToast(data.message || "Proceso de contratación iniciado exitosamente", "success");
            setTimeout(() => {
                window.location.href = "index.html";
            }, 1000);
        } else {
            throw new Error(data.detail || data.message || "Error al registrar el proceso");
        }
    } catch (err) {
        window.mostrarToast(`Error al crear el proceso: ${err.message}`, "error");
        if (btnGuardar) {
            btnGuardar.disabled = false;
            btnGuardar.innerHTML = `<i data-lucide="send" class="w-4 h-4"></i> Crear Solicitud de Trámite`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }
}