// archivo: js/fases_tramite/paso3_inicio.js

function abrirEditorSolicitudInicio(proceso) {
    document.getElementById("sol-obj").textContent = proceso.objeto_contratacion || "No definido";
    document.getElementById("sol-monto").textContent = `Bs. ${parseFloat(proceso.monto_total).toFixed(2)}`;
    document.getElementById("sol-fecha").value = new Date().toISOString().split('T')[0];

    const docExistente = proceso.documentos?.find(d => d.clave_documento === "solicitud_inicio");
    const datosGuardados = docExistente?.datos_formulario || {};

    document.getElementById("sol-alcalde").value = datosGuardados.alcalde || "H. "; 
    document.getElementById("sol-objetivo").value = datosGuardados.objetivo || "";
    
    if(datosGuardados.fecha_documento) {
        document.getElementById("sol-fecha").value = datosGuardados.fecha_documento;
    }

    const vista = document.getElementById("vista-solicitud-inicio");
    vista.classList.remove("hidden");
    vista.classList.add("flex");
}

function cerrarEditorSolicitudInicio() {
    const vista = document.getElementById("vista-solicitud-inicio");
    vista.classList.add("hidden");
    vista.classList.remove("flex");
}

async function guardarSolicitudInicio(formato) {
    const urlParams = new URLSearchParams(window.location.search);
    const PROCESO_ID = urlParams.get('id');
    const botones = document.querySelectorAll(".btn-guardar-sol");

    try {
        botones.forEach(b => {
            b.disabled = true;
            b.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Procesando...`;
        });

        const payload = {
            clave_documento: "solicitud_inicio",
            estado: "FINALIZADO",
            datos_formulario: {
                alcalde: document.getElementById("sol-alcalde").value.trim(),
                objetivo: document.getElementById("sol-objetivo").value.trim(),
                fecha_documento: document.getElementById("sol-fecha").value,
                
                // Mantenemos estas llaves vacías por si el backend de Python las busca para evitar errores KeyError
                lugar_entrega: "",
                puntos_extra: [],
                condiciones: [],
                items_tecnicos: []
            }
        };

        await window.API.procesos.guardarDocumento(PROCESO_ID, payload);
        cerrarEditorSolicitudInicio();
        
        await cargarDatosProceso(); 
        await window.API.procesos.descargarDocumento(PROCESO_ID, "solicitud_inicio", formato);

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