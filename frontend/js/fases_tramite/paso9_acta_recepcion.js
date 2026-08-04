// archivo: js/fases_tramite/paso9_acta_recepcion.js

let lotesActasGlobal = [];
let itemsBaseGlobal = [];

function abrirEditorActaRecepcion(proceso) {
    document.getElementById("acta-info-objeto").textContent = proceso.objeto_contratacion || "S/N";
    document.getElementById("acta-info-responsable").textContent = proceso.tecnico_solicitante || "S/N";
    document.getElementById("acta-info-unidad").textContent = proceso.cargo_tecnico_solicitante || "S/N";

    let itemsCrudos = [];
    const docAlm = proceso.documentos?.find(d => d.clave_documento === "almacenes");
    const docOC = proceso.documentos?.find(d => d.clave_documento === "orden_compra");
    const docInicio = proceso.documentos?.find(d => d.clave_documento === "solicitud_inicio");

    if (docAlm && docAlm.datos_formulario?.items_almacen?.length > 0) {
        itemsCrudos = docAlm.datos_formulario.items_almacen;
    } else if (docOC && docOC.datos_formulario?.items_orden?.length > 0) {
        itemsCrudos = docOC.datos_formulario.items_orden;
    } else if (docInicio && docInicio.datos_formulario?.items_tecnicos?.length > 0) {
        itemsCrudos = docInicio.datos_formulario.items_tecnicos;
    } else {
        itemsCrudos = proceso.items || [];
    }

    itemsBaseGlobal = itemsCrudos.map(i => ({
        nro: i.nro || i.nro_item || "",
        objeto: i.objeto || i.objeto_corto || "",
        descripcion: i.descripcion || i.descripcion_larga || "",
        tipuni: i.tipuni || i.unidad || "",
        cant: parseFloat(i.cant || i.cantidad || 0)
    }));
    
    const docActaGuardada = proceso.documentos?.find(d => d.clave_documento === "acta_recepcion");
    
    const hoy = new Date().toISOString().split('T')[0];
    document.getElementById("acta-fecha-entrega").value = (docActaGuardada && docActaGuardada.datos_formulario?.fecha_entrega) 
        ? docActaGuardada.datos_formulario.fecha_entrega 
        : hoy;

    if (docActaGuardada && docActaGuardada.datos_formulario?.lotes_actas?.length > 0) {
        lotesActasGlobal = docActaGuardada.datos_formulario.lotes_actas;
    } else {
        lotesActasGlobal = [{ id: Date.now(), items: JSON.parse(JSON.stringify(itemsBaseGlobal)) }];
    }
    
    renderizarLotesActas();
    
    const vista = document.getElementById("vista-acta-recepcion");
    vista.classList.remove("hidden");
    vista.classList.add("flex");
}

function cerrarEditorActaRecepcion() {
    const vista = document.getElementById("vista-acta-recepcion");
    vista.classList.add("hidden");
    vista.classList.remove("flex");
}

function renderizarLotesActas() {
    const contenedor = document.getElementById("contenedor-actas");
    contenedor.innerHTML = "";
    
    lotesActasGlobal.forEach((lote, index) => {
        let filas = lote.items.map((item, iIndex) => `
            <tr class="border-b border-slate-100 hover:bg-slate-50 transition">
                <td class="py-3 px-2 text-sm text-slate-500 font-medium">${item.nro}</td>
                <td class="py-3 px-2 text-sm font-bold text-slate-800">${item.objeto}</td>
                <td class="py-3 px-2 text-sm text-slate-600"><span class="bg-slate-100 px-2 py-1 rounded text-xs">${item.tipuni}</span></td>
                <td class="py-3 px-2 w-32">
                    <input type="number" min="0" step="0.01" 
                        class="w-full border border-slate-300 focus:border-indigo-500 rounded p-1.5 text-center font-bold text-indigo-700" 
                        value="${item.cant}" 
                        onchange="actualizarCantLote(${index}, ${iIndex}, this.value)">
                </td>
            </tr>
        `).join("");

        contenedor.innerHTML += `
            <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative">
                ${index > 0 ? `<button onclick="eliminarLoteActa(${index})" class="absolute top-5 right-5 text-red-500 hover:text-red-700 text-sm font-bold p-2 bg-red-50 rounded-lg transition" title="Borrar Acta"><i data-lucide="trash-2" class="w-4 h-4"></i></button>` : ''}
                <div class="flex items-center gap-3 mb-4">
                    <div class="w-8 h-8 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold">${index + 1}</div>
                    <div>
                        <h4 class="font-bold text-slate-800 text-lg">Acta de Entrega</h4>
                        <p class="text-xs text-slate-500">Ajusta las cantidades. (Si pones 0, el ítem no saldrá en esta hoja).</p>
                    </div>
                </div>
                <table class="w-full text-left">
                    <thead>
                        <tr class="text-xs text-slate-500 border-b border-slate-200">
                            <th class="pb-2 px-2">Nº</th>
                            <th class="pb-2 px-2">Ítem a Entregar</th>
                            <th class="pb-2 px-2">Unidad</th>
                            <th class="pb-2 px-2 text-center">Cantidad Final</th>
                        </tr>
                    </thead>
                    <tbody>${filas}</tbody>
                </table>
            </div>
        `;
    });
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

function actualizarCantLote(loteIndex, itemIndex, val) {
    lotesActasGlobal[loteIndex].items[itemIndex].cant = parseFloat(val) || 0;
}

function agregarLoteActa() {
    const itemsCero = JSON.parse(JSON.stringify(itemsBaseGlobal)).map(i => {
        i.cant = 0;
        return i;
    });
    lotesActasGlobal.push({ id: Date.now(), items: itemsCero });
    renderizarLotesActas();
}

function eliminarLoteActa(index) {
    lotesActasGlobal.splice(index, 1);
    renderizarLotesActas();
}

async function guardarActaRecepcion(formato) {
    const urlParams = new URLSearchParams(window.location.search);
    const PROCESO_ID = urlParams.get('id');
    const botones = document.querySelectorAll(".btn-guardar-acta");

    try {
        botones.forEach(b => {
            b.disabled = true;
            b.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Generando...`;
        });

        const payload = {
            clave_documento: "acta_recepcion",
            estado: "FINALIZADO",
            datos_formulario: { 
                fecha_entrega: document.getElementById("acta-fecha-entrega").value,
                lotes_actas: lotesActasGlobal 
            }
        };

        await window.API.procesos.guardarDocumento(PROCESO_ID, payload);
        cerrarEditorActaRecepcion();
        await cargarDatosProceso(); 
        await window.API.procesos.descargarDocumento(PROCESO_ID, "acta_recepcion", formato);

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