// archivo: js/fases_tramite/paso6_notificacion.js

function toggleRetencion() {
    const chk = document.getElementById("chk-retencion");
    const input = document.getElementById("notif-retencion");
    
    if (chk.checked) {
        const tipo = procesoActual.tipo_contratacion || "BIENES";
        const porcentaje = tipo === "SERVICIOS" ? 0.16 : 0.08;
        const montoBase = parseFloat(document.getElementById("notif-monto-adj").value) || 0;
        
        const calculo = montoBase * porcentaje;
        
        input.value = calculo.toFixed(2);
        input.classList.remove("bg-slate-100", "text-slate-500");
        input.classList.add("bg-indigo-50", "text-indigo-700", "font-bold", "border-indigo-300");
    } else {
        input.value = "0.00";
        input.classList.add("bg-slate-100", "text-slate-500");
        input.classList.remove("bg-indigo-50", "text-indigo-700", "font-bold", "border-indigo-300");
    }
}

function abrirEditorNotificacion() {
    const docNotif = procesoActual.documentos?.find(d => d.clave_documento === "notificacion_adjudicacion");
    const datosGuardados = docNotif?.datos_formulario || {};

    const docInfo = procesoActual.documentos?.find(d => d.clave_documento === "informe_cotizacion");
    document.getElementById("notif-proveedor").value = docInfo?.datos_formulario?.proveedor_ganador || "No definido (Paso 5 incompleto)";
    
    const montoFinal = parseFloat(procesoActual.monto_adjudicado) || parseFloat(procesoActual.monto_total) || 0;
    document.getElementById("notif-monto-adj").value = montoFinal.toFixed(2);
    
    document.getElementById("notif-fecha").value = datosGuardados.fecha_notificacion || new Date().toISOString().split('T')[0];
    document.getElementById("notif-plazo").value = datosGuardados.plazo_entrega || procesoActual.plazo_entrega || 0;

    const tipo = procesoActual.tipo_contratacion || "BIENES";
    const porcentajeTexto = tipo === "SERVICIOS" ? "16%" : "8%";
    document.getElementById("lbl-tipo-retencion").textContent = `Aplica Retención (${porcentajeTexto} por ${tipo})`;
    document.getElementById("lbl-monto-base").textContent = montoFinal.toFixed(2);

    const retencionBD = parseFloat(procesoActual.retencion_monto) || 0;
    const retencionActual = datosGuardados.monto_retencion !== undefined ? datosGuardados.monto_retencion : retencionBD;
    
    document.getElementById("chk-retencion").checked = retencionActual > 0;
    toggleRetencion();

    const docsGuardados = datosGuardados.documentos_requeridos || [
        "Fotocopia de C.I.", "Fotocopia de NIT.", "RUPE.", "Fotocopia Matrícula SEPREC", "Fotocopia de certificado de no adeudo a la GESTORA", "Fotocopia Simple SIGEP"
    ];

    document.querySelectorAll(".chk-doc").forEach(checkbox => {
        checkbox.checked = docsGuardados.includes(checkbox.value);
    });

    const vista = document.getElementById("vista-notificacion");
    vista.classList.remove("hidden");
    vista.classList.add("flex");
}

function cerrarEditorNotificacion() {
    const vista = document.getElementById("vista-notificacion");
    vista.classList.add("hidden");
    vista.classList.remove("flex");
}

async function guardarNotificacion() {
    try {
        const btn = document.querySelector('button[onclick="guardarNotificacion()"]');
        btn.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Procesando...`;
        btn.disabled = true;

        const documentosSeleccionados = Array.from(document.querySelectorAll(".chk-doc:checked")).map(chk => chk.value);
        const retencion = document.getElementById("chk-retencion").checked ? parseFloat(document.getElementById("notif-retencion").value) || 0 : 0;
        const plazo = parseInt(document.getElementById("notif-plazo").value) || 0;

        const payload = {
            clave_documento: "notificacion_adjudicacion",
            estado: "FINALIZADO",
            datos_formulario: {
                fecha_notificacion: document.getElementById("notif-fecha").value,
                monto_retencion: retencion,
                plazo_entrega: plazo,
                documentos_requeridos: documentosSeleccionados
            }
        };

        await window.API.procesos.guardarDocumento(PROCESO_ID, payload);
        cerrarEditorNotificacion();
        await cargarDatosProceso(); 
        await window.API.procesos.descargarDocumento(PROCESO_ID, "notificacion_adjudicacion");

    } catch (error) {
        alert("Error: " + error.message);
    } finally {
        const btn = document.querySelector('button[onclick="guardarNotificacion()"]');
        btn.innerHTML = `<i data-lucide="check-circle" class="w-5 h-5"></i> Emitir Notificación`;
        btn.disabled = false;
        if(typeof lucide !== 'undefined') lucide.createIcons();
    }
}