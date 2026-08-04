// archivo: js/fases_tramite/paso6_notificacion.js

// Ahora extrae el tipo del atributo data almacenado en el DOM, no de la global
function toggleRetencion() {
    const chk = document.getElementById("chk-retencion");
    const input = document.getElementById("notif-retencion");
    const tipo = chk.dataset.tipo || "BIENES"; 
    
    if (chk.checked) {
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

function abrirEditorNotificacion(proceso) {
    const docNotif = proceso.documentos?.find(d => d.clave_documento === "notificacion_adjudicacion");
    const datosGuardados = docNotif?.datos_formulario || {};

    const docInfo = proceso.documentos?.find(d => d.clave_documento === "informe_cotizacion");
    document.getElementById("notif-proveedor").value = docInfo?.datos_formulario?.proveedor_ganador || "No definido (Paso 5 incompleto)";
    
    const montoFinal = parseFloat(proceso.monto_adjudicado) || parseFloat(proceso.monto_total) || 0;
    document.getElementById("notif-monto-adj").value = montoFinal.toFixed(2);
    
    document.getElementById("notif-fecha").value = datosGuardados.fecha_notificacion || new Date().toISOString().split('T')[0];
    document.getElementById("notif-plazo").value = datosGuardados.plazo_entrega || proceso.plazo_entrega || 0;

    const tipo = proceso.tipo_contratacion || "BIENES";
    // Almacenamos el tipo en el HTML para que toggleRetencion pueda leerlo
    document.getElementById("chk-retencion").dataset.tipo = tipo;
    
    const porcentajeTexto = tipo === "SERVICIOS" ? "16%" : "8%";
    document.getElementById("lbl-tipo-retencion").textContent = `Aplica Retención (${porcentajeTexto} por ${tipo})`;
    document.getElementById("lbl-monto-base").textContent = montoFinal.toFixed(2);

    const retencionBD = parseFloat(proceso.retencion_monto) || 0;
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

async function guardarNotificacion(formato) {
    const urlParams = new URLSearchParams(window.location.search);
    const PROCESO_ID = urlParams.get('id');
    const botones = document.querySelectorAll(".btn-guardar-notif");

    try {
        botones.forEach(b => {
            b.disabled = true;
            b.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Procesando...`;
        });

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
        await window.API.procesos.descargarDocumento(PROCESO_ID, "notificacion_adjudicacion", formato);

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