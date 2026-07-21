function abrirEditorInformeConformidad() {
    // 1. Mostrar las variables fijas del proceso
    document.getElementById("infoconf-objeto").textContent = procesoActual.objeto_contratacion || "S/N";
    document.getElementById("infoconf-responsable").textContent = procesoActual.tecnico_solicitante || "S/N";
    document.getElementById("infoconf-cargo").textContent = procesoActual.cargo_tecnico_solicitante || "S/N";
    
    // 2. CAZADOR DE PROVEEDOR (Buscamos en el Paso 5, que es el oficial)
    let razonSocial = "S/N";
    const docInfoCot = procesoActual.documentos?.find(d => d.clave_documento === "informe_cotizacion");
    
    if (docInfoCot && docInfoCot.datos_formulario?.proveedor_ganador) {
        razonSocial = docInfoCot.datos_formulario.proveedor_ganador;
    } else if (procesoActual.proveedor && procesoActual.proveedor.razon_social) {
        razonSocial = procesoActual.proveedor.razon_social;
    }
    document.getElementById("infoconf-proveedor").textContent = razonSocial.replace(/Proveedor \/ Razón Social:/ig, "").trim();

    // 3. Rastrear fechas de pasos anteriores
    const docInicio = procesoActual.documentos?.find(d => d.clave_documento === "solicitud_inicio");
    document.getElementById("infoconf-fecha-inicio").textContent = docInicio?.datos_formulario?.fecha_documento || "No registrada";

    const docActa = procesoActual.documentos?.find(d => d.clave_documento === "acta_recepcion");
    document.getElementById("infoconf-fecha-entrega").textContent = docActa?.datos_formulario?.fecha_entrega || "No registrada";

    // 4. Establecer la fecha actual del informe
    const docInfo = procesoActual.documentos?.find(d => d.clave_documento === "informe_conformidad");
    const hoy = new Date().toISOString().split('T')[0];
    document.getElementById("info-conf-fecha").value = (docInfo && docInfo.datos_formulario?.fecha_informe) 
        ? docInfo.datos_formulario.fecha_informe 
        : hoy;

    // 5. Extraer los Ítems reales desde la ORDEN DE COMPRA (Paso 7)
    const docOC = procesoActual.documentos?.find(d => d.clave_documento === "orden_compra");
    const itemsOficiales = docOC?.datos_formulario?.items_orden || procesoActual.items || [];
    
    const tbody = document.getElementById("infoconf-tabla-items");
    tbody.innerHTML = "";
    
    itemsOficiales.forEach(item => {
        const nro = item.nro || item.nro_item || "";
        const obj = item.objeto || item.objeto_corto || "";
        const desc = item.descripcion || item.descripcion_larga || "";
        const textoUnido = desc ? `${obj} - ${desc}` : obj;
        const uni = item.tipuni || item.unidad || "";
        const cant = item.cant || item.cantidad || 0;
        const total = parseFloat(item.total_item || 0).toLocaleString('es-BO', { minimumFractionDigits: 2 });

        tbody.innerHTML += `
            <tr class="border-b border-slate-50 hover:bg-slate-50 transition">
                <td class="py-3 px-2 text-slate-500 font-medium">${nro}</td>
                <td class="py-3 px-2 font-bold text-slate-800">${textoUnido}</td>
                <td class="py-3 px-2 text-center text-slate-600"><span class="bg-slate-100 px-2 py-1 rounded text-xs">${uni}</span></td>
                <td class="py-3 px-2 text-center font-bold text-indigo-700">${cant}</td>
                <td class="py-3 px-2 text-right font-bold text-slate-700">${total}</td>
            </tr>
        `;
    });

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

async function guardarInformeConformidad() {
    try {
        const btn = document.getElementById("btn-guardar-infoconf");
        btn.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Procesando...`;
        btn.disabled = true;

        const payload = {
            clave_documento: "informe_conformidad",
            estado: "FINALIZADO",
            datos_formulario: { 
                fecha_informe: document.getElementById("info-conf-fecha").value 
            }
        };

        await window.API.procesos.guardarDocumento(PROCESO_ID, payload);
        cerrarEditorInformeConformidad();
        await cargarDatosProceso(); 
        await window.API.procesos.descargarDocumento(PROCESO_ID, "informe_conformidad");

    } catch (error) {
        alert("Error: " + error.message);
    } finally {
        const btn = document.getElementById("btn-guardar-infoconf");
        btn.innerHTML = `<i data-lucide="printer" class="w-5 h-5"></i> Imprimir Informe`;
        btn.disabled = false;
        if(typeof lucide !== 'undefined') lucide.createIcons();
    }
}