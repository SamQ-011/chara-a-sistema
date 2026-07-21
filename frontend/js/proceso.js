// Referencias Gastos
const tbodyGastos = document.getElementById("tbody-gastos");
const totalGastosEl = document.getElementById("total-gastos");
let contadorGastos = 0;

// Referencias Items
const tbodyItems = document.getElementById("tbody-items");
const totalItemsEl = document.getElementById("total-items");
let contadorItems = 0;

// Formulario General
const form = document.getElementById("form-proceso");
const btnGuardar = document.getElementById("btn-guardar");

// ==========================================
// MODO EDICIÓN (DETECTAR URL)
// ==========================================
const urlParams = new URLSearchParams(window.location.search);
const isEditMode = urlParams.get('edit') === 'true';
const procesoIdEdit = urlParams.get('id');
let codigoProcesoOriginal = ""; 

document.addEventListener("DOMContentLoaded", async () => {
    // NUEVO: Extraer cargo del usuario y asignarlo como Área Solicitante
    const cargoActual = localStorage.getItem("user_cargo") || "ÁREA NO DEFINIDA";
    document.getElementById("area_solicitante").value = cargoActual.toUpperCase();

    if (isEditMode && procesoIdEdit) {
        document.getElementById("header-title").textContent = "Edición de Trámite";
        document.getElementById("header-desc").textContent = "Modificación global de ítems y afectación presupuestaria.";
        btnGuardar.innerHTML = `<i data-lucide="save" class="w-5 h-5"></i> Guardar Cambios`;
        document.getElementById("txt-pdf-hint").textContent = "Opcional. Suba un nuevo PDF solo si desea reemplazar el documento original.";
        
        await cargarDatosEdicion(procesoIdEdit);
    } else {
        document.getElementById('fecha_solicitud').valueAsDate = new Date();
        agregarGasto();
        agregarItem();
    }
    lucide.createIcons();
});

async function cargarDatosEdicion(id) {
    try {
        const proceso = await window.API.procesos.obtener(id);
        
        // Guardar el código para no generar uno nuevo al hacer PUT
        codigoProcesoOriginal = proceso.codigo_proceso;

        // 1. Llenar Datos Generales
        // Nota: Como no guardabas 'fecha_solicitud' limpia en la BD (o estaba en ui), asumo que está. Si no, pon un fallback.
        if(proceso.fecha_solicitud) document.getElementById("fecha_solicitud").value = proceso.fecha_solicitud;
        document.getElementById("objeto").value = proceso.objeto_contratacion || "";
        document.getElementById("distrito_comunidad").value = proceso.distrito_comunidad || "";
        
        // 2. Llenar Gastos
        if (proceso.gastos && proceso.gastos.length > 0) {
            proceso.gastos.forEach(g => agregarGasto(g));
        } else {
            agregarGasto(); 
        }

        // 3. Llenar Ítems
        if (proceso.items && proceso.items.length > 0) {
            proceso.items.forEach(i => agregarItem(i));
        } else {
            agregarItem();
        }

        calcularTotalGastos();
        calcularTotalItems();

    } catch (error) {
        alert("Error al cargar datos para edición: " + error.message);
        window.location.href = "index.html";
    }
}


// ==========================================
// MÓDULO GASTOS
// ==========================================
// Modificado para aceptar un objeto data para pre-llenado
function agregarGasto(data = null) {
    contadorGastos++;
    const tr = document.createElement("tr");
    tr.id = `gasto-${contadorGastos}`;
    
    const v_partida = data ? data.partida : "";
    const v_prog = data ? data.prog : "";
    const v_proy = data ? data.proy : "";
    const v_act = data ? data.act : "";
    const v_ff = data ? data.ff : "";
    const v_of = data ? data.of : "";
    const v_desc = data ? data.descripcion : "";
    const v_monto = data ? data.monto : "0";

    tr.innerHTML = `
        <td class="p-2"><input type="number" class="w-12 p-2 bg-slate-50 border rounded text-center num-gasto outline-none text-sm" value="${contadorGastos}" readonly></td>
        <td class="p-2"><input type="text" placeholder="Ej. 32100" class="w-24 p-2 bg-slate-50 border rounded partida outline-none text-sm" value="${v_partida}" required></td>
        <td class="p-2"><input type="text" placeholder="10" class="w-16 p-2 bg-slate-50 border rounded prog outline-none text-sm" value="${v_prog}" required></td>
        <td class="p-2"><input type="text" placeholder="0000" class="w-16 p-2 bg-slate-50 border rounded proy outline-none text-sm" value="${v_proy}" required></td>
        <td class="p-2"><input type="text" placeholder="01" class="w-16 p-2 bg-slate-50 border rounded act outline-none text-sm" value="${v_act}" required></td>
        <td class="p-2"><input type="text" placeholder="41" class="w-16 p-2 bg-slate-50 border rounded ff outline-none text-sm" value="${v_ff}" required></td>
        <td class="p-2"><input type="text" placeholder="113" class="w-16 p-2 bg-slate-50 border rounded of outline-none text-sm" value="${v_of}" required></td>
        <td class="p-2"><input type="text" placeholder="Papel" class="w-48 p-2 bg-slate-50 border rounded desc outline-none text-sm" value="${v_desc}" required></td>
        <td class="p-2"><input type="number" step="0.01" min="0" class="w-32 p-2 bg-slate-50 border rounded monto outline-none text-sm font-bold" value="${v_monto}" required oninput="calcularTotalGastos()"></td>
        <td class="p-2 text-center">
            <button type="button" onclick="eliminarGasto(${contadorGastos})" class="text-red-500 hover:text-red-700 bg-red-50 p-2 rounded-lg transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
        </td>
    `;
    tbodyGastos.appendChild(tr);
    if(typeof lucide !== 'undefined') lucide.createIcons();
    reindexar(tbodyGastos, ".num-gasto");
}

function eliminarGasto(id) {
    document.getElementById(`gasto-${id}`).remove();
    reindexar(tbodyGastos, ".num-gasto");
    calcularTotalGastos();
}

function calcularTotalGastos() {
    let granTotal = 0;
    const filas = tbodyGastos.querySelectorAll("tr");
    filas.forEach(fila => {
        granTotal += parseFloat(fila.querySelector(".monto").value) || 0;
    });
    totalGastosEl.textContent = granTotal.toFixed(2);
}

// ==========================================
// MÓDULO ÍTEMS
// ==========================================
function agregarItem(data = null) {
    contadorItems++;
    const tr = document.createElement("tr");
    tr.id = `item-${contadorItems}`;
    
    const v_obj = data ? data.objeto_corto : "";
    const v_desc = data ? data.descripcion_larga : "";
    const v_uni = data ? data.unidad : "";
    const v_cant = data ? data.cantidad : "0";
    const v_prec = data ? data.precio_unitario : "0";
    const v_tot = data ? data.total_item : "0.00";

    tr.innerHTML = `
        <td class="p-2"><input type="number" class="w-12 p-2 bg-slate-50 border rounded text-center num-item outline-none text-sm" value="${contadorItems}" readonly></td>
        <td class="p-2"><input type="text" class="w-full p-2 bg-slate-50 border rounded obj-corto outline-none text-sm" value="${v_obj}" required></td>
        <td class="p-2"><input type="text" class="w-full p-2 bg-slate-50 border rounded desc-larga outline-none text-sm" value="${v_desc}"></td>
        <td class="p-2"><input type="text" class="w-24 p-2 bg-slate-50 border rounded unidad outline-none text-sm" value="${v_uni}" required></td>
        <td class="p-2"><input type="number" step="0.01" min="0" class="w-24 p-2 bg-slate-50 border rounded cantidad outline-none text-sm" value="${v_cant}" required oninput="calcularTotalItems()"></td>
        <td class="p-2"><input type="number" step="0.01" min="0" class="w-32 p-2 bg-slate-50 border rounded precio outline-none text-sm" value="${v_prec}" required oninput="calcularTotalItems()"></td>
        <td class="p-2"><input type="text" class="w-32 p-2 bg-slate-100 border rounded total text-emerald-700 font-bold outline-none text-sm" value="${v_tot}" readonly></td>
        <td class="p-2 text-center">
            <button type="button" onclick="eliminarItem(${contadorItems})" class="text-red-500 hover:text-red-700 bg-red-50 p-2 rounded-lg transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
        </td>
    `;
    tbodyItems.appendChild(tr);
    if(typeof lucide !== 'undefined') lucide.createIcons();
    reindexar(tbodyItems, ".num-item");
}

function eliminarItem(id) {
    document.getElementById(`item-${id}`).remove();
    reindexar(tbodyItems, ".num-item");
    calcularTotalItems();
}

function calcularTotalItems() {
    let granTotal = 0;
    const filas = tbodyItems.querySelectorAll("tr");
    filas.forEach(fila => {
        const cant = parseFloat(fila.querySelector(".cantidad").value) || 0;
        const prec = parseFloat(fila.querySelector(".precio").value) || 0;
        const total = cant * prec;
        fila.querySelector(".total").value = total.toFixed(2);
        granTotal += total;
    });
    totalItemsEl.textContent = granTotal.toFixed(2);
}

// Utilidad Compartida
function reindexar(tbodyObj, selectorClase) {
    const filas = tbodyObj.querySelectorAll("tr");
    filas.forEach((fila, index) => {
        fila.querySelector(selectorClase).value = index + 1;
    });
}

// ==========================================
// ENVÍO DE FORMULARIO (CREAR O EDITAR)
// ==========================================
form.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const pdfInput = document.getElementById("pdf_solicitud");
    
    // Validacion inteligente de PDF: Obligatorio si crea, Opcional si edita
    if (!isEditMode && !pdfInput.files.length) {
        alert("Debe adjuntar la solicitud del beneficiario en formato PDF.");
        return;
    }

    const filasGastos = tbodyGastos.querySelectorAll("tr");
    if (filasGastos.length === 0) {
        alert("Debe ingresar al menos un gasto en el Detalle Presupuestario.");
        return;
    }

    const filasItems = tbodyItems.querySelectorAll("tr");
    if (filasItems.length === 0) {
        alert("Debe ingresar al menos un ítem físico en la grilla.");
        return;
    }

    btnGuardar.disabled = true;
    btnGuardar.innerHTML = `<div class="w-5 h-5 border-4 border-white border-t-transparent rounded-full animate-spin"></div> Procesando...`;

    const nombreActual = localStorage.getItem("user_nombre") || "";
    const cargoActual = localStorage.getItem("user_cargo") || "";

    // 1. Armar Payload de Interfaz
    const variables_ui = {
        proveedor: "POR DEFINIR", 
        nit: "0",
        direccion: "",
        telefono: "",
        codigo: isEditMode ? codigoProcesoOriginal : "TEMP-" + Date.now(),
        n_orden: "",
        objeto: document.getElementById("objeto").value.trim(),
        desca: document.getElementById("objeto").value.substring(0, 50),
        cod_proy: "N/A",
        uni_solic: document.getElementById("area_solicitante").value,
        distrito_comunidad: document.getElementById("distrito_comunidad").value.trim() || "S/N", 
        tipo_pago: "TRANSFERENCIA BANCARIA",
        tipo_contratacion: document.getElementById("tipo_proceso").value,
        plazo: 0,
        monto_total: parseFloat(totalItemsEl.textContent), 
        retencion_val: 0.00,
        fecha_corta: document.getElementById("fecha_solicitud").value,
        fecha_larga: "",
        fecha_info: "",
        enc_finanzas: document.getElementById("enc_finanzas").value.trim(),
        nom_tecnico: nombreActual,
        cargo_tecnico: cargoActual,
        seleccionados: []
    };

    // 2. Extraer Gastos
    const gastos = Array.from(filasGastos).map(fila => ({
        partida: fila.querySelector(".partida").value.trim(),
        prog: fila.querySelector(".prog").value.trim(),
        proy: fila.querySelector(".proy").value.trim(),
        act: fila.querySelector(".act").value.trim(),
        ff: fila.querySelector(".ff").value.trim(),
        of: fila.querySelector(".of").value.trim(),
        descripcion: fila.querySelector(".desc").value.trim(),
        monto: parseFloat(fila.querySelector(".monto").value) || 0
    }));

    // 3. Extraer Ítems
    const items = Array.from(filasItems).map(fila => ({
        nro_item: parseInt(fila.querySelector(".num-item").value),
        objeto_corto: fila.querySelector(".obj-corto").value.trim(),
        descripcion_larga: fila.querySelector(".desc-larga").value.trim() || "",
        unidad: fila.querySelector(".unidad").value.trim(),
        cantidad: parseFloat(fila.querySelector(".cantidad").value) || 0,
        precio_unitario: parseFloat(fila.querySelector(".precio").value) || 0,
        total_item: parseFloat(fila.querySelector(".total").value) || 0
    }));

    try {
        const payload = { variables_ui, items, gastos };
        let proceso_id_final;

        if (isEditMode) {
            // Flujo Actualizar
            await window.API.procesos.actualizar(procesoIdEdit, payload);
            proceso_id_final = procesoIdEdit;
            
            // Subir PDF solo si adjuntaron uno nuevo
            if (pdfInput.files.length) {
                const formData = new FormData();
                formData.append("file", pdfInput.files[0]);
                await window.API.procesos.subirSolicitud(proceso_id_final, formData);
            }
            
            alert("Trámite actualizado correctamente.");
        } else {
            // Flujo Crear
            const dataJSON = await window.API.procesos.crear(payload);
            proceso_id_final = dataJSON.data.proceso_id;

            const formData = new FormData();
            formData.append("file", pdfInput.files[0]);
            await window.API.procesos.subirSolicitud(proceso_id_final, formData);

            alert("¡Proceso iniciado exitosamente! Descargando Solicitud...");
            await window.API.procesos.descargarDocumento(proceso_id_final, "solicitud_cp");
        }

        setTimeout(() => {
            window.location.href = `detalle_proceso.html?id=${proceso_id_final}`;
        }, 1500);

    } catch (error) {
        alert(error.message);
        btnGuardar.disabled = false;
        btnGuardar.innerHTML = isEditMode ? `<i data-lucide="save" class="w-5 h-5"></i> Guardar Cambios` : `<i data-lucide="save" class="w-5 h-5"></i> Iniciar Proceso`;
        lucide.createIcons();
    }
});