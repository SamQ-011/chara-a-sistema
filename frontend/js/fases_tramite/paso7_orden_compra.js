// archivo: js/fases_tramite/paso7_orden_compra.js

let montoAdjudicadoObjetivo = 0; // Esta variable vive solo para el modal, está bien aquí.

function agregarItemOrdenCompra(data) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
        <td class="p-4 align-middle text-center font-medium text-slate-500">${data.nro}</td>
        <td class="p-4 align-middle">
            <p class="font-bold text-slate-800">${data.objeto}</p>
            <input type="hidden" class="oc-desc" value="${data.descripcion || ''}">
        </td>
        <td class="p-4 align-middle font-medium text-slate-600">${data.tipuni}</td>
        <td class="p-2 align-middle">
            <input type="number" step="0.01" min="0" class="w-full p-2 bg-white border border-slate-300 rounded text-center oc-cant outline-none focus:border-indigo-500" value="${data.cant}" oninput="calcularTotalOrdenCompra()">
        </td>
        <td class="p-2 align-middle">
            <input type="number" step="0.01" min="0" class="w-full p-2 bg-white border border-slate-300 rounded text-right oc-prec outline-none focus:border-indigo-500 font-bold text-slate-700" value="${data.precio_unitario}" oninput="calcularTotalOrdenCompra()">
        </td>
        <td class="p-4 align-middle text-right font-bold text-emerald-600 oc-tot">
            ${parseFloat(data.total_item).toFixed(2)}
        </td>
        <input type="hidden" class="oc-nro" value="${data.nro}">
        <input type="hidden" class="oc-obj" value="${data.objeto}">
        <input type="hidden" class="oc-uni" value="${data.tipuni}">
    `;
    document.getElementById("oc-tabla-items").appendChild(tr);
}

function calcularTotalOrdenCompra() {
    let granTotal = 0;
    const filas = document.getElementById("oc-tabla-items").querySelectorAll("tr");
    
    filas.forEach(fila => {
        const cant = parseFloat(fila.querySelector(".oc-cant").value) || 0;
        const prec = parseFloat(fila.querySelector(".oc-prec").value) || 0;
        const total = cant * prec;
        fila.querySelector(".oc-tot").textContent = total.toFixed(2);
        granTotal += total;
    });

    document.getElementById("oc-monto-actual").textContent = granTotal.toFixed(2);
    
    // Validación para habilitar los dos botones
    const botonesGuardar = document.querySelectorAll(".btn-guardar-oc");
    const alerta = document.getElementById("oc-alerta-validacion");
    
    if (Math.abs(granTotal - montoAdjudicadoObjetivo) < 0.02) {
        botonesGuardar.forEach(b => b.disabled = false);
        alerta.classList.remove("bg-amber-100", "text-amber-800", "border-amber-200");
        alerta.classList.add("bg-emerald-100", "text-emerald-800", "border-emerald-200");
        alerta.innerHTML = `<i data-lucide="check-circle" class="w-4 h-4"></i> Cuadre perfecto`;
    } else {
        botonesGuardar.forEach(b => b.disabled = true);
        alerta.classList.add("bg-amber-100", "text-amber-800", "border-amber-200");
        alerta.classList.remove("bg-emerald-100", "text-emerald-800", "border-emerald-200");
        alerta.innerHTML = `<i data-lucide="alert-triangle" class="w-4 h-4"></i> Los montos no coinciden`;
    }
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

async function abrirEditorOrdenCompra(proceso) {
    const docOC = proceso.documentos?.find(d => d.clave_documento === "orden_compra");
    const datosGuardados = docOC?.datos_formulario || {};

    document.getElementById("oc-nro-orden").value = datosGuardados.nro_orden || proceso.nro_orden || "";
    document.getElementById("oc-fecha").value = datosGuardados.fecha_documento || new Date().toISOString().split('T')[0];
    
    montoAdjudicadoObjetivo = parseFloat(proceso.monto_adjudicado) || parseFloat(proceso.monto_total) || 0;
    document.getElementById("oc-monto-objetivo").textContent = montoAdjudicadoObjetivo.toFixed(2);

    document.getElementById("oc-proveedor").value = "Buscando...";
    document.getElementById("oc-nit").value = "Buscando...";
    
    const docInfo = proceso.documentos?.find(d => d.clave_documento === "informe_cotizacion");
    const provGanadorJSON = docInfo?.datos_formulario?.proveedor_ganador || "";

    if (proceso.proveedor_id) {
        try {
            const res = await fetch(`/api/catalogos/proveedores`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
            });
            const proveedores = await res.json();
            const proveedorData = proveedores.find(p => p.id === proceso.proveedor_id);
            
            if (proveedorData) {
                document.getElementById("oc-proveedor").value = proveedorData.razon_social;
                document.getElementById("oc-nit").value = datosGuardados.nit || proveedorData.nit_ci || "S/N";
                document.getElementById("oc-direccion").value = datosGuardados.direccion || proveedorData.direccion || "";
                document.getElementById("oc-telefono").value = datosGuardados.telefono || proveedorData.telefono || "";
            } else {
                throw new Error("No encontrado en catálogo BD");
            }
        } catch (e) { 
            console.warn("Fallo al buscar en BD, usando respaldo JSON");
            aplicarRespaldoProveedor(provGanadorJSON, datosGuardados); 
        }
    } else if (provGanadorJSON) {
        aplicarRespaldoProveedor(provGanadorJSON, datosGuardados);
    } else {
        document.getElementById("oc-proveedor").value = "Sin proveedor asignado (Complete Paso 5)";
        document.getElementById("oc-nit").value = "";
    }

    document.getElementById("oc-tabla-items").innerHTML = "";
    
    let itemsCarga = [];
    if (datosGuardados.items_orden && datosGuardados.items_orden.length > 0) {
        itemsCarga = datosGuardados.items_orden;
    } else {
        const docAuth = proceso.documentos?.find(d => d.clave_documento === "autorizacion_inicio");
        if (docAuth?.datos_formulario?.items_tecnicos) {
            itemsCarga = docAuth.datos_formulario.items_tecnicos;
        } else {
            itemsCarga = proceso.items.map(i => ({
                nro: i.nro_item, objeto: i.objeto_corto, descripcion: i.descripcion_larga,
                tipuni: i.unidad, cant: i.cantidad, precio_unitario: i.precio_unitario, total_item: i.total_item
            }));
        }
    }

    itemsCarga.forEach(item => agregarItemOrdenCompra(item));
    calcularTotalOrdenCompra();

    const vista = document.getElementById("vista-orden-compra");
    vista.classList.remove("hidden");
    vista.classList.add("flex");
}

function aplicarRespaldoProveedor(nombre, datosGuardados) {
    document.getElementById("oc-proveedor").value = nombre;
    document.getElementById("oc-nit").value = datosGuardados.nit || "S/N";
    document.getElementById("oc-direccion").value = datosGuardados.direccion || "";
    document.getElementById("oc-telefono").value = datosGuardados.telefono || "";
}

function cerrarEditorOrdenCompra() {
    const vista = document.getElementById("vista-orden-compra");
    vista.classList.add("hidden");
    vista.classList.remove("flex");
}

async function guardarOrdenCompra(formato) {
    const urlParams = new URLSearchParams(window.location.search);
    const PROCESO_ID = urlParams.get('id');
    const botones = document.querySelectorAll(".btn-guardar-oc");

    try {
        botones.forEach(b => {
            b.disabled = true;
            b.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Procesando...`;
        });

        const itemsFinales = [];
        document.getElementById("oc-tabla-items").querySelectorAll("tr").forEach(fila => {
            itemsFinales.push({
                nro: parseInt(fila.querySelector(".oc-nro").value),
                objeto: fila.querySelector(".oc-obj").value,
                descripcion: fila.querySelector(".oc-desc").value,
                tipuni: fila.querySelector(".oc-uni").value,
                cant: parseFloat(fila.querySelector(".oc-cant").value) || 0,
                precio_unitario: parseFloat(fila.querySelector(".oc-prec").value) || 0,
                total_item: parseFloat(fila.querySelector(".oc-tot").textContent) || 0
            });
        });

        const payload = {
            clave_documento: "orden_compra",
            estado: "FINALIZADO",
            datos_formulario: {
                fecha_documento: document.getElementById("oc-fecha").value,
                nro_orden: document.getElementById("oc-nro-orden").value.trim(),
                direccion: document.getElementById("oc-direccion").value.trim(),
                telefono: document.getElementById("oc-telefono").value.trim(),
                nit: document.getElementById("oc-nit").value.trim(),
                items_orden: itemsFinales
            }
        };

        await window.API.procesos.guardarDocumento(PROCESO_ID, payload);
        cerrarEditorOrdenCompra();
        await cargarDatosProceso(); 
        await window.API.procesos.descargarDocumento(PROCESO_ID, "orden_compra", formato);

    } catch (error) {
        alert("Error: " + error.message);
    } finally {
        botones.forEach((b, index) => {
            b.disabled = false;
            b.innerHTML = index === 0 ? `<i data-lucide="file-spreadsheet" class="w-5 h-5"></i> Emitir Excel` : `<i data-lucide="printer" class="w-5 h-5"></i> Imprimir PDF`;
        });
        if(typeof lucide !== 'undefined') lucide.createIcons();
    }
}