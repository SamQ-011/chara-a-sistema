// archivo: js/fases_tramite/paso8_almacenes.js

function renderizarItemsAlmacen(items) {
    const tbody = document.getElementById("alm-tabla-items");
    tbody.innerHTML = "";

    items.forEach(data => {
        const tr = document.createElement("tr");
        tr.className = "hover:bg-slate-50 transition";
        tr.innerHTML = `
            <td class="px-6 py-4 align-middle text-center font-medium text-slate-500">${data.nro}</td>
            <td class="px-6 py-4 align-middle">
                <p class="font-bold text-slate-800">${data.objeto}</p>
                <p class="text-xs text-slate-500 mt-1 line-clamp-1">${data.descripcion || ''}</p>
            </td>
            <td class="px-6 py-4 align-middle font-medium text-slate-600">
                <span class="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs">${data.tipuni}</span>
            </td>
            <td class="px-6 py-4 align-middle text-center font-bold text-indigo-700 text-lg">
                ${data.cant}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function abrirEditorAlmacenes(proceso) {
    const docAlm = proceso.documentos?.find(d => d.clave_documento === "almacenes");
    const datosGuardados = docAlm?.datos_formulario || {};

    document.getElementById("alm-fecha-ingreso").value = datosGuardados.fecha_ingreso || new Date().toISOString().split('T')[0];
    document.getElementById("alm-fecha-salida").value = datosGuardados.fecha_salida || new Date().toISOString().split('T')[0];
    document.getElementById("alm-proyecto-corto").value = datosGuardados.proyecto_corto || "";

    const docInfo = proceso.documentos?.find(d => d.clave_documento === "informe_cotizacion");
    document.getElementById("alm-proveedor").value = docInfo?.datos_formulario?.proveedor_ganador || "Buscando...";

    if (proceso.proveedor_id) {
        try {
            const res = await fetch(`/api/catalogos/proveedores`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
            });
            const proveedores = await res.json();
            const proveedorData = proveedores.find(p => p.id === proceso.proveedor_id);
            if (proveedorData) {
                document.getElementById("alm-proveedor").value = proveedorData.razon_social;
            }
        } catch (e) { console.warn("Usando proveedor de respaldo."); }
    }

    let itemsCarga = [];
    const docOC = proceso.documentos?.find(d => d.clave_documento === "orden_compra");
    
    if (datosGuardados.items_almacen && datosGuardados.items_almacen.length > 0) {
        itemsCarga = datosGuardados.items_almacen;
    } else if (docOC?.datos_formulario?.items_orden && docOC.datos_formulario.items_orden.length > 0) {
        itemsCarga = docOC.datos_formulario.items_orden;
    } else {
        itemsCarga = proceso.items.map(i => ({
            nro: i.nro_item, objeto: i.objeto_corto, descripcion: i.descripcion_larga,
            tipuni: i.unidad, cant: i.cantidad
        }));
    }

    window.itemsAlmacenTemp = itemsCarga;
    renderizarItemsAlmacen(itemsCarga);

    const vista = document.getElementById("vista-almacenes");
    vista.classList.remove("hidden");
    vista.classList.add("flex");
}

function cerrarEditorAlmacenes() {
    const vista = document.getElementById("vista-almacenes");
    vista.classList.add("hidden");
    vista.classList.remove("flex");
}

async function guardarAlmacenes(formato) {
    const urlParams = new URLSearchParams(window.location.search);
    const PROCESO_ID = urlParams.get('id');
    const botones = document.querySelectorAll(".btn-guardar-alm");

    try {
        botones.forEach(b => {
            b.disabled = true;
            b.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Procesando...`;
        });

        const payload = {
            clave_documento: "almacenes",
            estado: "FINALIZADO",
            datos_formulario: {
                fecha_ingreso: document.getElementById("alm-fecha-ingreso").value,
                fecha_salida: document.getElementById("alm-fecha-salida").value,
                proyecto_corto: document.getElementById("alm-proyecto-corto").value.trim(),
                items_almacen: window.itemsAlmacenTemp || []
            }
        };

        await window.API.procesos.guardarDocumento(PROCESO_ID, payload);
        cerrarEditorAlmacenes();
        await cargarDatosProceso(); 
        
        await window.API.procesos.descargarDocumento(PROCESO_ID, "ingreso_almacenes", formato);
        
        setTimeout(async () => {
            await window.API.procesos.descargarDocumento(PROCESO_ID, "salida_almacenes", formato);
        }, 1500);

    } catch (error) {
        alert("Error: " + error.message);
    } finally {
        botones.forEach((b, index) => {
            b.disabled = false;
            b.innerHTML = index === 0 ? `<i data-lucide="file-spreadsheet" class="w-5 h-5"></i> Emitir Word` : `<i data-lucide="printer" class="w-5 h-5"></i> Imprimir PDF`;
        });
        if(typeof lucide !== 'undefined') lucide.createIcons();
    }
}