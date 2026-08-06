// archivo: js/fases_tramite/paso10_informe_conformidad.js

function abrirEditorInformeConformidad(proceso) {
    document.getElementById("infoconf-objeto").textContent = proceso.objeto_contratacion || "S/N";
    document.getElementById("infoconf-responsable").textContent = proceso.tecnico_solicitante || "S/N";
    document.getElementById("infoconf-cargo").textContent = proceso.cargo_tecnico_solicitante || "S/N";
    
    let razonSocial = "S/N";
    const docInfoCot = proceso.documentos?.find(d => d.clave_documento === "informe_cotizacion");
    
    if (docInfoCot && docInfoCot.datos_formulario?.proveedor_ganador) {
        razonSocial = docInfoCot.datos_formulario.proveedor_ganador;
    } else if (proceso.proveedor && proceso.proveedor.razon_social) {
        razonSocial = proceso.proveedor.razon_social;
    }
    document.getElementById("infoconf-proveedor").textContent = razonSocial.replace(/Proveedor \/ Razón Social:/ig, "").trim();

    const docInicio = proceso.documentos?.find(d => d.clave_documento === "solicitud_inicio");
    document.getElementById("infoconf-fecha-inicio").textContent = docInicio?.datos_formulario?.fecha_documento || "No registrada";

    const docActa = proceso.documentos?.find(d => d.clave_documento === "acta_recepcion");
    document.getElementById("infoconf-fecha-entrega").textContent = docActa?.datos_formulario?.fecha_entrega || "No registrada";

    const docInfo = proceso.documentos?.find(d => d.clave_documento === "informe_conformidad");
    const hoy = new Date().toISOString().split('T')[0];
    document.getElementById("info-conf-fecha").value = (docInfo && docInfo.datos_formulario?.fecha_informe) 
        ? docInfo.datos_formulario.fecha_informe 
        : hoy;

    const elResumen = document.getElementById("info-conf-items-resumen");
    if (elResumen) {
        elResumen.value = (docInfo && docInfo.datos_formulario?.resumen_items)
            ? docInfo.datos_formulario.resumen_items
            : (proceso.desca_contextual || "bienes solicitados");
    }

    const vista = document.getElementById("vista-informe-conformidad");
    vista.classList.remove("hidden");
    vista.classList.add("flex");
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

function cerrarEditorInformeConformidad() {
    const vista = document.getElementById("vista-informe-conformidad");
    vista.classList.add("hidden");
    vista.classList.remove("flex");
}

async function guardarInformeConformidad(formato) {
    const urlParams = new URLSearchParams(window.location.search);
    const PROCESO_ID = urlParams.get('id');
    const botones = document.querySelectorAll(".btn-guardar-infoconf");

    try {
        botones.forEach(b => {
            b.disabled = true;
            b.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Procesando...`;
        });

        const elResumen = document.getElementById("info-conf-items-resumen");
        const resumenVal = elResumen ? elResumen.value.trim() : "";

        const payload = {
            clave_documento: "informe_conformidad",
            estado: "FINALIZADO",
            datos_formulario: { 
                fecha_informe: document.getElementById("info-conf-fecha").value,
                resumen_items: resumenVal
            }
        };

        await window.API.procesos.guardarDocumento(PROCESO_ID, payload);
        cerrarEditorInformeConformidad();
        await cargarDatosProceso(); 
        await window.API.procesos.descargarDocumento(PROCESO_ID, "informe_conformidad", formato);

    } catch (error) {
        alert("Error: " + error.message);
    } finally {
        botones.forEach((b, index) => {
            b.disabled = false;
            b.innerHTML = index === 0 ? `<i data-lucide="file-text" class="w-5 h-5"></i> Emitir Word` : `<i data-lucide="printer" class="w-5 h-5"></i> Imprimir PDF`;
        });
        if(typeof lucide !== 'undefined') lucide.createIcons();
    }
}