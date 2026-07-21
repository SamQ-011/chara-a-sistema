// archivo: js/fases_tramite/paso4_autorizacion.js

let contadorAutorizacion = 0;

function agregarItemAutorizacion(data = null) {
    contadorAutorizacion++;
    const tr = document.createElement("tr");
    tr.id = `aut-item-${contadorAutorizacion}`;
    
    const v_obj = data ? data.objeto : "";
    const v_desc = data ? data.descripcion : "";
    const v_uni = data ? data.tipuni : "";
    const v_cant = data ? data.cant : "0";
    const v_prec = data ? data.precio_unitario : "0";
    const v_tot = data ? data.total_item : "0.00";

    tr.innerHTML = `
        <td class="p-2 align-top"><input type="number" class="w-full bg-transparent text-center aut-num outline-none text-sm font-medium text-slate-500 mt-2" value="${contadorAutorizacion}" readonly></td>
        <td class="p-2 align-top"><textarea rows="2" class="w-full p-2 bg-slate-50 border border-slate-200 rounded aut-obj outline-none text-sm focus:border-indigo-500">${v_obj}</textarea></td>
        <td class="p-2 align-top"><textarea rows="3" class="w-full p-2 bg-slate-50 border border-slate-200 rounded aut-desc outline-none text-sm focus:border-indigo-500">${v_desc}</textarea></td>
        <td class="p-2 align-top"><input type="text" class="w-full p-2 bg-slate-50 border border-slate-200 rounded text-center aut-uni outline-none text-sm focus:border-indigo-500 mt-1" value="${v_uni}"></td>
        <td class="p-2 align-top"><input type="number" step="0.01" min="0" class="w-full p-2 bg-slate-50 border border-slate-200 rounded text-center aut-cant outline-none text-sm focus:border-indigo-500 mt-1" value="${v_cant}" oninput="calcularTotalAutorizacion()"></td>
        <td class="p-2 align-top"><input type="number" step="0.01" min="0" class="w-full p-2 bg-slate-50 border border-slate-200 rounded text-right aut-prec outline-none text-sm focus:border-indigo-500 mt-1" value="${v_prec}" oninput="calcularTotalAutorizacion()"></td>
        <td class="p-2 align-top"><input type="text" class="w-full p-2 bg-transparent text-right font-bold text-slate-700 aut-tot outline-none text-sm mt-1" value="${v_tot}" readonly></td>
        <td class="p-2 text-center align-top pt-4">
            <button type="button" onclick="eliminarItemAutorizacion(${contadorAutorizacion})" class="text-red-400 hover:text-red-600 transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
        </td>
    `;
    document.getElementById("aut-tabla-items-edit").appendChild(tr);
    if(typeof lucide !== 'undefined') lucide.createIcons();
    reindexarAutorizacion();
}

function eliminarItemAutorizacion(id) {
    document.getElementById(`aut-item-${id}`).remove();
    reindexarAutorizacion();
    calcularTotalAutorizacion();
}

function reindexarAutorizacion() {
    const filas = document.getElementById("aut-tabla-items-edit").querySelectorAll("tr");
    filas.forEach((fila, index) => {
        fila.querySelector(".aut-num").value = index + 1;
    });
}

function calcularTotalAutorizacion() {
    let granTotal = 0;
    const filas = document.getElementById("aut-tabla-items-edit").querySelectorAll("tr");
    filas.forEach(fila => {
        const cant = parseFloat(fila.querySelector(".aut-cant").value) || 0;
        const prec = parseFloat(fila.querySelector(".aut-prec").value) || 0;
        const total = cant * prec;
        fila.querySelector(".aut-tot").value = total.toFixed(2);
        granTotal += total;
    });
    document.getElementById("aut-total-items").textContent = granTotal.toFixed(2);
}

function abrirEditorAutorizacion() {
    const docAuth = procesoActual.documentos?.find(d => d.clave_documento === "autorizacion_inicio");
    const datosGuardadosAuth = docAuth?.datos_formulario || {};

    const docInicio = procesoActual.documentos?.find(d => d.clave_documento === "solicitud_inicio");
    const datosGuardadosInicio = docInicio?.datos_formulario || {};

    const cargoSol = procesoActual.cargo_tecnico_solicitante || "Área solicitante";
    document.getElementById("aut-solicitante").value = datosGuardadosAuth.unidad_solicitante || cargoSol;
    document.getElementById("aut-codigo").value = datosGuardadosAuth.codigo_proyecto || "S/N";
    document.getElementById("aut-objeto").value = datosGuardadosAuth.objeto_contratacion || procesoActual.objeto_contratacion;
    document.getElementById("aut-fecha").value = datosGuardadosAuth.fecha_documento || new Date().toISOString().split('T')[0];

    document.getElementById("aut-tabla-items-edit").innerHTML = "";
    contadorAutorizacion = 0;

    let itemsCarga = [];
    
    if (datosGuardadosAuth.items_tecnicos && datosGuardadosAuth.items_tecnicos.length > 0) {
        itemsCarga = datosGuardadosAuth.items_tecnicos;
    } 
    else if (datosGuardadosInicio.items_tecnicos && datosGuardadosInicio.items_tecnicos.length > 0) {
        itemsCarga = datosGuardadosInicio.items_tecnicos;
    } 
    else if (procesoActual.items && procesoActual.items.length > 0) {
        itemsCarga = procesoActual.items.map(i => ({
            nro: i.nro_item,
            objeto: i.objeto_corto,
            descripcion: i.descripcion_larga,
            tipuni: i.unidad,
            cant: i.cantidad,
            precio_unitario: i.precio_unitario,
            total_item: i.total_item
        }));
    }

    if (itemsCarga.length > 0) {
        itemsCarga.forEach(item => agregarItemAutorizacion(item));
    } else {
        agregarItemAutorizacion();
    }
    calcularTotalAutorizacion();

    const vista = document.getElementById("vista-autorizacion");
    vista.classList.remove("hidden");
    vista.classList.add("flex");
}

function cerrarEditorAutorizacion() {
    const vista = document.getElementById("vista-autorizacion");
    vista.classList.add("hidden");
    vista.classList.remove("flex");
}

async function guardarAutorizacion() {
    try {
        const btn = document.querySelector('button[onclick="guardarAutorizacion()"]');
        btn.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Procesando...`;
        btn.disabled = true;

        const itemsAutorizados = [];
        const filas = document.getElementById("aut-tabla-items-edit").querySelectorAll("tr");
        filas.forEach(fila => {
            itemsAutorizados.push({
                nro: parseInt(fila.querySelector(".aut-num").value),
                objeto: fila.querySelector(".aut-obj").value.trim(),
                descripcion: fila.querySelector(".aut-desc").value.trim(),
                tipuni: fila.querySelector(".aut-uni").value.trim(),
                cant: parseFloat(fila.querySelector(".aut-cant").value) || 0,
                precio_unitario: parseFloat(fila.querySelector(".aut-prec").value) || 0,
                total_item: parseFloat(fila.querySelector(".aut-tot").value) || 0
            });
        });

        const payload = {
            clave_documento: "autorizacion_inicio",
            estado: "FINALIZADO",
            datos_formulario: {
                fecha_documento: document.getElementById("aut-fecha").value,
                unidad_solicitante: document.getElementById("aut-solicitante").value.trim(),
                codigo_proyecto: document.getElementById("aut-codigo").value.trim(),
                objeto_contratacion: document.getElementById("aut-objeto").value.trim(),
                items_tecnicos: itemsAutorizados
            }
        };

        await window.API.procesos.guardarDocumento(PROCESO_ID, payload);
        cerrarEditorAutorizacion();
        
        await cargarDatosProceso(); 
        await window.API.procesos.descargarDocumento(PROCESO_ID, "autorizacion_inicio");

    } catch (error) {
        alert("Error: " + error.message);
    } finally {
        const btn = document.querySelector('button[onclick="guardarAutorizacion()"]');
        btn.innerHTML = `<i data-lucide="check-circle" class="w-5 h-5"></i> Emitir Autorización`;
        btn.disabled = false;
        if(typeof lucide !== 'undefined') lucide.createIcons();
    }
}