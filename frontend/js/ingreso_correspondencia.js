// JS para Ingreso de Correspondencia de Ventanilla Única
document.addEventListener("DOMContentLoaded", async () => {
    verificarTokenYPagina();

    const form = document.getElementById("form-ingreso-correspondencia");
    if (form) {
        form.addEventListener("submit", guardarCorrespondenciaVentanilla);
    }

    const fechaEl = document.getElementById("fecha_doc_origen");
    if (fechaEl && !fechaEl.value) {
        fechaEl.valueAsDate = new Date();
    }

    const selectArea = document.getElementById("area_solicitante");
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
    }

    // Configuración Dropzone PDF
    const pdfInput = document.getElementById("pdf_solicitud");
    const dropzone = document.getElementById("pdf-dropzone");
    const dropzonePrompt = document.getElementById("dropzone-prompt");
    const dropzoneSelected = document.getElementById("dropzone-selected");
    const fileNamePreview = document.getElementById("file-name-preview");
    const fileSizePreview = document.getElementById("file-size-preview");
    const btnRemovePdf = document.getElementById("btn-remove-pdf");

    if (pdfInput) {
        pdfInput.addEventListener("change", () => {
            if (pdfInput.files.length > 0) {
                const file = pdfInput.files[0];
                if (file.type !== "application/pdf") {
                    window.mostrarToast("Por favor adjunte un archivo en formato PDF.", "error");
                    pdfInput.value = "";
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
            }
        });

        if (btnRemovePdf) {
            btnRemovePdf.addEventListener("click", (e) => {
                e.stopPropagation();
                pdfInput.value = "";
                if (dropzonePrompt) dropzonePrompt.classList.remove("hidden");
                if (dropzoneSelected) {
                    dropzoneSelected.classList.add("hidden");
                    dropzoneSelected.classList.remove("flex");
                }
            });
        }
    }
});

async function guardarCorrespondenciaVentanilla(e) {
    e.preventDefault();

    const selectArea = document.getElementById("area_solicitante");
    if (!selectArea || !selectArea.value) {
        window.mostrarToast("Debe seleccionar una unidad de derivación válida", "error");
        return;
    }

    const btnGuardar = document.getElementById("btn-guardar");
    if (btnGuardar) {
        btnGuardar.disabled = true;
        btnGuardar.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Registrando...`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    const formData = new FormData();
    formData.append("tipo_remitente", document.getElementById("tipo_remitente")?.value || "OTB / Comunidad / Entidad Pública");
    formData.append("nombre_remitente", document.getElementById("nombre_remitente")?.value.trim() || "");
    formData.append("cargo_remitente", document.getElementById("cargo_remitente")?.value.trim() || "");
    formData.append("telefono_remitente", document.getElementById("telefono_remitente")?.value.trim() || "");
    formData.append("cite_origen", document.getElementById("cite_origen")?.value.trim() || "");
    formData.append("fecha_doc_origen", document.getElementById("fecha_doc_origen")?.value || "");
    formData.append("tipo_documento", document.getElementById("tipo_documento")?.value || "Carta / Oficio");
    formData.append("asunto", document.getElementById("objeto")?.value.trim() || "");
    formData.append("nro_fojas", parseInt(document.getElementById("fojas")?.value || 1));
    formData.append("unidad_destino_id", parseInt(selectArea.value));
    formData.append("instruccion_proveido", "Para su atención y trámite correspondiente");

    const pdfInput = document.getElementById("pdf_solicitud");
    if (pdfInput && pdfInput.files.length > 0) {
        formData.append("pdf_solicitud", pdfInput.files[0]);
    }

    try {
        const token = localStorage.getItem("token") || localStorage.getItem("access_token");
        const resp = await fetch("/api/correspondencia/ingreso-form", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`
            },
            body: formData
        });

        const data = await resp.json();
        if (resp.ok && data.success) {
            window.mostrarToast(data.message || "Correspondencia ingresada exitosamente", "success");
            setTimeout(() => {
                window.location.href = "correspondencia.html";
            }, 1000);
        } else {
            throw new Error(data.detail || data.message || "Error al registrar correspondencia");
        }
    } catch (err) {
        window.mostrarToast(`Error al ingresar trámite: ${err.message}`, "error");
        if (btnGuardar) {
            btnGuardar.disabled = false;
            btnGuardar.innerHTML = `<i data-lucide="send" class="w-4 h-4"></i> Ingresar Trámite y Generar HR`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }
}
