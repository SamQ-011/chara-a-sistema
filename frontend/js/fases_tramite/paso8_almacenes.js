// archivo: js/fases_tramite/paso8_almacenes.js

let contadorAlmacenes = 0;

function agregarItemAlmacen(raw = null) {
    const data = window.normalizarItem(raw);
    contadorAlmacenes++;
    const tbody = document.getElementById("alm-tabla-items");
    const tr = document.createElement("tr");
    tr.id = `alm-item-${contadorAlmacenes}`;
    tr.className = "hover:bg-slate-50 transition";

    tr.innerHTML = `
        <td class="p-2 align-top"><input type="number" class="w-full bg-transparent text-center alm-nro outline-none text-xs font-medium text-slate-500 mt-2" value="${contadorAlmacenes}" readonly></td>
        <td class="p-2 align-top"><textarea rows="2" class="w-full p-2 bg-slate-50 border border-slate-200 rounded alm-obj outline-none text-xs focus:border-indigo-500 font-semibold text-slate-800">${data.objeto}</textarea></td>
        <td class="p-2 align-top"><textarea rows="2" class="w-full p-2 bg-slate-50 border border-slate-200 rounded alm-desc outline-none text-xs focus:border-indigo-500 text-slate-600" placeholder="Especificación técnica de almacén, marca, modelo...">${data.descripcion}</textarea></td>
        <td class="p-2 align-top"><input type="text" class="w-full p-2 bg-slate-50 border border-slate-200 rounded text-center alm-uni outline-none text-xs focus:border-indigo-500 mt-1" value="${data.tipuni}"></td>
        <td class="p-2 align-top"><input type="number" step="0.01" min="0" class="w-full p-2 bg-slate-50 border border-slate-200 rounded text-center alm-cant outline-none text-xs focus:border-indigo-500 font-bold text-indigo-700 mt-1" value="${data.cant}"></td>
        <td class="p-2 text-center align-top pt-3">
            <button type="button" onclick="eliminarItemAlmacen(${contadorAlmacenes})" class="text-rose-400 hover:text-rose-600 transition p-1"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
        </td>
    `;
    tbody.appendChild(tr);
    if (typeof lucide !== 'undefined') lucide.createIcons();
    reindexarAlmacenes();
}

function eliminarItemAlmacen(id) {
    const el = document.getElementById(`alm-item-${id}`);
    if (el) el.remove();
    reindexarAlmacenes();
}

function reindexarAlmacenes() {
    const filas = document.getElementById("alm-tabla-items").querySelectorAll("tr");
    filas.forEach((fila, index) => {
        const numInput = fila.querySelector(".alm-nro");
        if (numInput) numInput.value = index + 1;
    });
}

function renderizarItemsAlmacen(items) {
    const tbody = document.getElementById("alm-tabla-items");
    tbody.innerHTML = "";
    contadorAlmacenes = 0;
    items.forEach(data => agregarItemAlmacen(data));
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
    const docAuth = proceso.documentos?.find(d => d.clave_documento === "autorizacion_inicio");
    
    if (datosGuardados.items_almacen && datosGuardados.items_almacen.length > 0) {
        itemsCarga = datosGuardados.items_almacen;
    } else if (docOC?.datos_formulario?.items_orden && docOC.datos_formulario.items_orden.length > 0) {
        itemsCarga = docOC.datos_formulario.items_orden;
    } else if (docAuth?.datos_formulario?.items_tecnicos && docAuth.datos_formulario.items_tecnicos.length > 0) {
        itemsCarga = docAuth.datos_formulario.items_tecnicos;
    } else if (proceso.items && proceso.items.length > 0) {
        itemsCarga = proceso.items;
    }

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

        const itemsFinales = [];
        document.getElementById("alm-tabla-items").querySelectorAll("tr").forEach(fila => {
            const numVal = parseInt(fila.querySelector(".alm-nro")?.value) || itemsFinales.length + 1;
            const objVal = fila.querySelector(".alm-obj")?.value.trim() || "";
            const descVal = fila.querySelector(".alm-desc")?.value.trim() || "";
            const uniVal = fila.querySelector(".alm-uni")?.value.trim() || "";
            const cantVal = parseFloat(fila.querySelector(".alm-cant")?.value) || 0;

            itemsFinales.push({
                nro: numVal,
                objeto: objVal,
                objeto_corto: objVal,
                descripcion: descVal,
                descripcion_larga: descVal,
                tipuni: uniVal,
                unidad: uniVal,
                cant: cantVal,
                cantidad: cantVal
            });
        });

        const payload = {
            clave_documento: "almacenes",
            estado: "FINALIZADO",
            datos_formulario: {
                fecha_ingreso: document.getElementById("alm-fecha-ingreso").value,
                fecha_salida: document.getElementById("alm-fecha-salida").value,
                proyecto_corto: document.getElementById("alm-proyecto-corto").value.trim(),
                items_almacen: itemsFinales
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
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}