// archivo: js/fases_tramite/paso4_autorizacion.js

let contadorAutorizacion = 0;

function agregarItemAutorizacion(data = null) {
    contadorAutorizacion++;
    const tr = document.createElement("tr");
    tr.id = `aut-item-${contadorAutorizacion}`;
    
    const v_obj = data ? (data.objeto || data.objeto_corto || "") : "";
    const v_desc = data ? (data.descripcion || data.descripcion_larga || "") : "";
    const v_uni = data ? (data.tipuni || data.unidad || "") : "";
    const v_cant = data ? (data.cant || data.cantidad || "0") : "0";
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

let procesoActualAutorizacion = null;

function actualizarCodigoProyectoAutorizacion() {
    const inputNum = document.getElementById("aut-codigo-num");
    const elPrefijo = document.getElementById("aut-codigo-prefijo");
    const elAnio = document.getElementById("aut-codigo-anio");
    const elPreview = document.getElementById("aut-codigo-preview");
    const inputHidden = document.getElementById("aut-codigo");

    if (!inputNum || !elPrefijo || !elAnio || !inputHidden) return;

    const tipo = (procesoActualAutorizacion && procesoActualAutorizacion.tipo_contratacion) || "BIENES";
    const esServicio = tipo.toUpperCase().includes("SERVICIO");
    const letraTipo = esServicio ? "S" : "B";
    const prefijo = `GAMCH/CM-${letraTipo}-`;
    elPrefijo.textContent = prefijo;

    const fechaVal = document.getElementById("aut-fecha").value;
    let anio = new Date().getFullYear();
    if (fechaVal) {
        const partes = fechaVal.split("-");
        if (partes.length === 3 && partes[0].length === 4) {
            anio = partes[0];
        }
    }
    const sufijo = `/${anio}`;
    elAnio.textContent = sufijo;

    let numRaw = inputNum.value.trim();
    let numFormatted = (numRaw && !isNaN(numRaw)) ? numRaw.padStart(3, '0') : numRaw;
    let codigoCompleto = numFormatted ? `${prefijo}${numFormatted}${sufijo}` : `${prefijo}___${sufijo}`;

    inputHidden.value = numFormatted ? `${prefijo}${numFormatted}${sufijo}` : "";
    if (elPreview) {
        elPreview.textContent = codigoCompleto;
    }
}

function formatearNumeroAutorizacion() {
    const inputNum = document.getElementById("aut-codigo-num");
    if (!inputNum) return;
    let val = inputNum.value.trim();
    if (val && !isNaN(val)) {
        inputNum.value = val.padStart(3, '0');
    }
    actualizarCodigoProyectoAutorizacion();
}

// NUEVA ARQUITECTURA: Recibe "proceso" inyectado
function abrirEditorAutorizacion(proceso) {
    procesoActualAutorizacion = proceso;

    const docAuth = proceso.documentos?.find(d => d.clave_documento === "autorizacion_inicio");
    const datosGuardadosAuth = docAuth?.datos_formulario || {};

    const docInicio = proceso.documentos?.find(d => d.clave_documento === "especificaciones_tecnicas");
    const datosGuardadosInicio = docInicio?.datos_formulario || {};

    const cargoSol = proceso.cargo_tecnico_solicitante || "Área solicitante";
    document.getElementById("aut-solicitante").value = datosGuardadosAuth.unidad_solicitante || cargoSol;
    document.getElementById("aut-objeto").value = proceso.objeto_contratacion;
    document.getElementById("aut-fecha").value = datosGuardadosAuth.fecha_documento || new Date().toISOString().split('T')[0];

    // Parsear código guardado si existe (ej: GAMCH/CM-B-064/2026)
    const codigoGuardado = datosGuardadosAuth.codigo_proyecto || "";
    let numExtraido = "";
    if (codigoGuardado) {
        const match = codigoGuardado.match(/GAMCH\/CM-[BS]-([^\/]+)\/\d{4}/);
        if (match) {
            numExtraido = match[1];
        } else {
            numExtraido = codigoGuardado;
        }
    }
    const inputNum = document.getElementById("aut-codigo-num");
    if (inputNum) inputNum.value = numExtraido;

    actualizarCodigoProyectoAutorizacion();

    document.getElementById("aut-tabla-items-edit").innerHTML = "";
    contadorAutorizacion = 0;

    let itemsCarga = [];
    
    if (datosGuardadosAuth.items_tecnicos && datosGuardadosAuth.items_tecnicos.length > 0) {
        itemsCarga = datosGuardadosAuth.items_tecnicos;
    } 
    else if (datosGuardadosInicio.items_tecnicos && datosGuardadosInicio.items_tecnicos.length > 0) {
        itemsCarga = datosGuardadosInicio.items_tecnicos;
    } 
    else if (proceso.items && proceso.items.length > 0) {
        itemsCarga = proceso.items.map(i => ({
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

async function guardarAutorizacion(formato) {
    formatearNumeroAutorizacion();
    // NUEVA ARQUITECTURA: Extrae ID de la URL
    const urlParams = new URLSearchParams(window.location.search);
    const PROCESO_ID = urlParams.get('id');
    
    const botones = document.querySelectorAll(".btn-guardar-aut");

    try {
        botones.forEach(b => {
            b.disabled = true;
            b.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Procesando...`;
        });

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
        await window.API.procesos.descargarDocumento(PROCESO_ID, "autorizacion_inicio", formato);

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

window.abrirEditorAutorizacion = abrirEditorAutorizacion;
window.abrirEditorAutorizacionInicio = abrirEditorAutorizacion;
window.cerrarEditorAutorizacion = cerrarEditorAutorizacion;
window.guardarAutorizacion = guardarAutorizacion;
window.actualizarCodigoProyectoAutorizacion = actualizarCodigoProyectoAutorizacion;
window.formatearNumeroAutorizacion = formatearNumeroAutorizacion;