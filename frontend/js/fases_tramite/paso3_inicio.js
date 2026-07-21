// archivo: js/fases_tramite/paso3_inicio.js

let contadorEspecificaciones = 0;

function agregarItemEspecificacion(data = null) {
    contadorEspecificaciones++;
    const tr = document.createElement("tr");
    tr.id = `esp-item-${contadorEspecificaciones}`;
    
    const v_obj = data ? data.objeto : "";
    const v_desc = data ? data.descripcion : "";
    const v_uni = data ? data.tipuni : "";
    const v_cant = data ? data.cant : "0";
    const v_prec = data ? data.precio_unitario : "0";
    const v_tot = data ? data.total_item : "0.00";

    tr.innerHTML = `
        <td class="p-2 align-top"><input type="number" class="w-full bg-transparent text-center esp-num outline-none text-sm font-medium text-slate-500 mt-2" value="${contadorEspecificaciones}" readonly></td>
        <td class="p-2 align-top"><textarea rows="2" class="w-full p-2 bg-slate-50 border border-slate-200 rounded esp-obj outline-none text-sm focus:border-indigo-500" placeholder="Ej. ANTICONGELANTE">${v_obj}</textarea></td>
        <td class="p-2 align-top"><textarea rows="3" class="w-full p-2 bg-slate-50 border border-slate-200 rounded esp-desc outline-none text-sm focus:border-indigo-500" placeholder="- De 200 Litros\n- Marca específica">${v_desc}</textarea></td>
        <td class="p-2 align-top"><input type="text" class="w-full p-2 bg-slate-50 border border-slate-200 rounded text-center esp-uni outline-none text-sm focus:border-indigo-500 mt-1" value="${v_uni}"></td>
        <td class="p-2 align-top"><input type="number" step="0.01" min="0" class="w-full p-2 bg-slate-50 border border-slate-200 rounded text-center esp-cant outline-none text-sm focus:border-indigo-500 mt-1" value="${v_cant}" oninput="calcularTotalEspecificaciones()"></td>
        <td class="p-2 align-top"><input type="number" step="0.01" min="0" class="w-full p-2 bg-slate-50 border border-slate-200 rounded text-right esp-prec outline-none text-sm focus:border-indigo-500 mt-1" value="${v_prec}" oninput="calcularTotalEspecificaciones()"></td>
        <td class="p-2 align-top"><input type="text" class="w-full p-2 bg-transparent text-right font-bold text-slate-700 esp-tot outline-none text-sm mt-1" value="${v_tot}" readonly></td>
        <td class="p-2 text-center align-top pt-4">
            <button type="button" onclick="eliminarItemEspecificacion(${contadorEspecificaciones})" class="text-red-400 hover:text-red-600 transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
        </td>
    `;
    document.getElementById("sol-tabla-items-edit").appendChild(tr);
    if(typeof lucide !== 'undefined') lucide.createIcons();
    reindexarEspecificaciones();
}

function eliminarItemEspecificacion(id) {
    document.getElementById(`esp-item-${id}`).remove();
    reindexarEspecificaciones();
    calcularTotalEspecificaciones();
}

function reindexarEspecificaciones() {
    const filas = document.getElementById("sol-tabla-items-edit").querySelectorAll("tr");
    filas.forEach((fila, index) => {
        fila.querySelector(".esp-num").value = index + 1;
    });
}

function calcularTotalEspecificaciones() {
    let granTotal = 0;
    const filas = document.getElementById("sol-tabla-items-edit").querySelectorAll("tr");
    filas.forEach(fila => {
        const cant = parseFloat(fila.querySelector(".esp-cant").value) || 0;
        const prec = parseFloat(fila.querySelector(".esp-prec").value) || 0;
        const total = cant * prec;
        fila.querySelector(".esp-tot").value = total.toFixed(2);
        granTotal += total;
    });
    document.getElementById("sol-total-items").textContent = granTotal.toFixed(2);
}

function abrirEditorSolicitudInicio() {
    document.getElementById("sol-obj").textContent = procesoActual.objeto_contratacion;
    document.getElementById("sol-monto").textContent = `Bs. ${parseFloat(procesoActual.monto_total).toFixed(2)}`;
    document.getElementById("sol-fecha").value = new Date().toISOString().split('T')[0];

    const docExistente = procesoActual.documentos?.find(d => d.clave_documento === "solicitud_inicio");
    const datosGuardados = docExistente?.datos_formulario || {};

    document.getElementById("sol-alcalde").value = datosGuardados.alcalde || "H. "; 
    document.getElementById("sol-objetivo").value = datosGuardados.objetivo || "";
    document.getElementById("sol-lugar").value = datosGuardados.lugar_entrega || procesoActual.distrito_comunidad || "";
    document.getElementById("sol-condiciones").value = datosGuardados.otras_condiciones || "Ninguna.";
    if(datosGuardados.fecha_documento) document.getElementById("sol-fecha").value = datosGuardados.fecha_documento;

    document.getElementById("sol-tabla-items-edit").innerHTML = "";
    contadorEspecificaciones = 0;
    
    if (datosGuardados.items_tecnicos && datosGuardados.items_tecnicos.length > 0) {
        datosGuardados.items_tecnicos.forEach(item => agregarItemEspecificacion(item));
    } else {
        agregarItemEspecificacion(); 
    }
    calcularTotalEspecificaciones();

    const vista = document.getElementById("vista-solicitud-inicio");
    vista.classList.remove("hidden");
    vista.classList.add("flex");
}

function cerrarEditorSolicitudInicio() {
    const vista = document.getElementById("vista-solicitud-inicio");
    vista.classList.add("hidden");
    vista.classList.remove("flex");
}

async function guardarSolicitudInicio() {
    try {
        const btn = document.querySelector('button[onclick="guardarSolicitudInicio()"]');
        btn.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Procesando...`;
        btn.disabled = true;

        const itemsTecnicos = [];
        const filas = document.getElementById("sol-tabla-items-edit").querySelectorAll("tr");
        filas.forEach(fila => {
            itemsTecnicos.push({
                nro: parseInt(fila.querySelector(".esp-num").value),
                objeto: fila.querySelector(".esp-obj").value.trim(),
                descripcion: fila.querySelector(".esp-desc").value.trim(),
                tipuni: fila.querySelector(".esp-uni").value.trim(),
                cant: parseFloat(fila.querySelector(".esp-cant").value) || 0,
                precio_unitario: parseFloat(fila.querySelector(".esp-prec").value) || 0,
                total_item: parseFloat(fila.querySelector(".esp-tot").value) || 0
            });
        });

        const payload = {
            clave_documento: "solicitud_inicio",
            estado: "FINALIZADO",
            datos_formulario: {
                alcalde: document.getElementById("sol-alcalde").value.trim(),
                objetivo: document.getElementById("sol-objetivo").value.trim(),
                lugar_entrega: document.getElementById("sol-lugar").value.trim(),
                otras_condiciones: document.getElementById("sol-condiciones").value.trim(),
                fecha_documento: document.getElementById("sol-fecha").value,
                items_tecnicos: itemsTecnicos
            }
        };

        await window.API.procesos.guardarDocumento(PROCESO_ID, payload);
        cerrarEditorSolicitudInicio();
        
        await cargarDatosProceso(); 
        await window.API.procesos.descargarDocumento(PROCESO_ID, "solicitud_inicio");

    } catch (error) {
        alert("Error: " + error.message);
    } finally {
        const btn = document.querySelector('button[onclick="guardarSolicitudInicio()"]');
        btn.innerHTML = `<i data-lucide="check-circle" class="w-5 h-5"></i> Emitir Documento`;
        btn.disabled = false;
        if(typeof lucide !== 'undefined') lucide.createIcons();
    }
}