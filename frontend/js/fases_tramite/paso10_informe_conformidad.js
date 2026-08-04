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

    const docOC = proceso.documentos?.find(d => d.clave_documento === "orden_compra");
    const docAlm = proceso.documentos?.find(d => d.clave_documento === "almacenes");
    const docSpecs = proceso.documentos?.find(d => d.clave_documento === "especificaciones_tecnicas");
    const docCP = proceso.documentos?.find(d => d.clave_documento === "solicitud_cp");

    let itemsOficiales = [];
    if (docOC && docOC.datos_formulario?.items_orden?.length > 0) {
        itemsOficiales = docOC.datos_formulario.items_orden;
    } else if (docAlm && docAlm.datos_formulario?.items_almacen?.length > 0) {
        itemsOficiales = docAlm.datos_formulario.items_almacen;
    } else if (docInicio && docInicio.datos_formulario?.items_tecnicos?.length > 0) {
        itemsOficiales = docInicio.datos_formulario.items_tecnicos;
    } else if (docSpecs && docSpecs.datos_formulario?.items_tecnicos?.length > 0) {
        itemsOficiales = docSpecs.datos_formulario.items_tecnicos;
    } else if (docCP && docCP.datos_formulario?.items_generales?.length > 0) {
        itemsOficiales = docCP.datos_formulario.items_generales;
    } else {
        itemsOficiales = proceso.items || [];
    }
    
    const tbody = document.getElementById("infoconf-tabla-items");
    tbody.innerHTML = "";
    
    itemsOficiales.forEach(item => {
        const nro = item.nro ?? item.nro_item ?? "";
        const obj = item.objeto ?? item.objeto_corto ?? "";
        const desc = item.descripcion ?? item.descripcion_larga ?? "";
        const textoUnido = desc ? `${obj} - ${desc}` : obj;
        const uni = item.tipuni ?? item.unidad ?? "";
        const cant = item.cant ?? item.cantidad ?? 0;
        const total = parseFloat(item.total_item || (cant * (item.precio_unitario || 0))).toLocaleString('es-BO', { minimumFractionDigits: 2 });

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