// archivo: js/fases_tramite/paso2_solicitud_cp.js

let contadorGastosCP = 0;
let contadorItemsCP = 0;
let procesoActualCP = null;
let catalogoPOACP = [];

// ==========================================
// CARGA DEL CATÁLOGO POA
// ==========================================
async function cargarCatalogoPOACP() {
    if (catalogoPOACP.length > 0) return catalogoPOACP;
    try {
        catalogoPOACP = await window.API.catalogos.obtenerPoa();
    } catch (e) {
        console.error("Error de conexión al obtener catálogo POA:", e);
    }
    return catalogoPOACP;
}
// ==========================================
// SEÑALADOR Y VALIDACIÓN DE CUADRE EN TIEMPO REAL
// ==========================================
function validarCuadreCP() {
    const elTotalGastos = document.getElementById("cp-total-gastos");
    const elTotalItems = document.getElementById("cp-total-items");
    const statusContainer = document.getElementById("cp-status-cuadre");
    const btnWord = document.getElementById("btn-guardar-cp-word");
    const btnPdf = document.getElementById("btn-guardar-cp-pdf");
    const contBotones = document.getElementById("cp-contenedor-botones");

    if (!elTotalGastos || !elTotalItems || !statusContainer) return;

    const totalGastos = parseFloat(elTotalGastos.textContent) || 0;
    const totalItems = parseFloat(elTotalItems.textContent) || 0;
    const diferencia = Math.abs(totalGastos - totalItems);

    const hayFilasGastos = document.querySelectorAll("#cp-contenedor-gastos .card-gasto-cp").length > 0;
    const hayFilasItems = document.querySelectorAll("#cp-tbody-items tr").length > 0;

    if (!hayFilasGastos || !hayFilasItems || totalGastos === 0 || totalItems === 0) {
        statusContainer.innerHTML = `
            <span class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                <i data-lucide="info" class="w-4 h-4 text-slate-500"></i> Ingrese gastos e ítems para validar el cuadre
            </span>
        `;
        bloquearBotones(true);
    } else if (diferencia < 0.01) {
        statusContainer.innerHTML = `
            <span class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm">
                <i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-600"></i> Montos cuadrados correctamente (Bs. ${totalGastos.toFixed(2)})
            </span>
        `;
        bloquearBotones(false);
    } else {
        statusContainer.innerHTML = `
            <span class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 shadow-sm">
                <i data-lucide="alert-triangle" class="w-4 h-4 text-amber-600"></i> Los montos no coinciden (Diferencia: Bs. ${diferencia.toFixed(2)})
            </span>
        `;
        bloquearBotones(true);
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();

    function bloquearBotones(bloquear) {
        if (btnWord) btnWord.disabled = bloquear;
        if (btnPdf) btnPdf.disabled = bloquear;
        if (contBotones) {
            if (bloquear) {
                contBotones.classList.add("opacity-50", "pointer-events-none");
            } else {
                contBotones.classList.remove("opacity-50", "pointer-events-none");
            }
        }
    }
}

// ==========================================
// MÓDULO GASTOS POA
// ==========================================
function agregarGastoCP(data = null) {
    contadorGastosCP++;
    const contenedor = document.getElementById("cp-contenedor-gastos");
    if (!contenedor) return;

    const card = document.createElement("div");
    card.id = `cp-gasto-${contadorGastosCP}`;
    card.className = "card-gasto-cp bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3";

    const v_ff = data ? (data.ff || "") : "";
    const v_of = data ? (data.of || "") : "";
    const v_desc = data ? (data.descripcion || "") : "";
    const v_monto = data ? (data.monto || "0") : "0";

    card.innerHTML = `
        <div class="flex flex-wrap items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
            <span class="px-2.5 py-1 bg-indigo-100 text-indigo-800 font-bold text-xs rounded-lg num-gasto-cp">#${contadorGastosCP}</span>
            
            <div class="flex-1 min-w-[240px]">
                <label class="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Programa POA</label>
                <select class="sel-prog-cp w-full text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-lg p-2 outline-none focus:border-indigo-500" onchange="onProgramaChangeCP(${contadorGastosCP})">
                    <option value="">-- Seleccionar Programa --</option>
                </select>
            </div>

            <div class="flex-1 min-w-[260px]">
                <label class="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Proyecto / Actividad</label>
                <select class="sel-proy-cp w-full text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-lg p-2 outline-none focus:border-indigo-500" onchange="onProyectoChangeCP(${contadorGastosCP})">
                    <option value="">-- Seleccionar Proyecto --</option>
                </select>
            </div>

            <button type="button" onclick="eliminarGastoCP(${contadorGastosCP})" class="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition" title="Eliminar Gasto">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-12 gap-3 items-center px-1">
            <div class="md:col-span-5">
                <label class="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Partida Presupuestaria</label>
                <select class="sel-partida-cp w-full text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-lg p-2 outline-none focus:border-indigo-500" onchange="onPartidaChangeCP(${contadorGastosCP})" onfocus="restaurarNombresPartidasCP(${contadorGastosCP})">
                    <option value="">-- Seleccionar Partida --</option>
                </select>
            </div>

            <div class="md:col-span-2">
                <label class="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">FF / OF</label>
                <div class="flex items-center gap-1">
                    <input type="text" class="inp-ff-cp w-full text-xs text-center font-bold bg-slate-100 border border-slate-200 rounded-lg p-2 text-indigo-900" placeholder="FF" value="${v_ff}">
                    <span class="text-slate-400 font-bold">-</span>
                    <input type="text" class="inp-of-cp w-full text-xs text-center font-bold bg-slate-100 border border-slate-200 rounded-lg p-2 text-indigo-900" placeholder="OF" value="${v_of}">
                </div>
            </div>

            <div class="md:col-span-3">
                <label class="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Descripción Objeto</label>
                <input type="text" class="inp-desc-cp w-full text-xs text-slate-700 bg-white border border-slate-300 rounded-lg p-2 outline-none focus:border-indigo-500" placeholder="Ej. Papel de escritorio" value="${v_desc}">
            </div>

            <div class="md:col-span-2">
                <label class="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Monto (Bs.)</label>
                <input type="number" step="0.01" min="0" class="inp-monto-cp w-full text-xs font-black text-right text-emerald-600 bg-white border border-slate-300 rounded-lg p-2 outline-none focus:border-indigo-500" value="${v_monto}" oninput="calcularTotalGastosCP()">
            </div>
        </div>
    `;

    contenedor.appendChild(card);
    if (typeof lucide !== 'undefined') lucide.createIcons();

    poblarProgramasCP(contadorGastosCP, data);
    reindexarGastosCP();
    validarCuadreCP();
}

function poblarProgramasCP(id, data = null) {
    const card = document.getElementById(`cp-gasto-${id}`);
    if (!card) return;
    const selProg = card.querySelector(".sel-prog-cp");
    selProg.innerHTML = `<option value="">-- Seleccionar Programa --</option>`;

    catalogoPOACP.forEach(prog => {
        const codPad = String(prog.codigo).padStart(2, '0');
        const opt = document.createElement("option");
        opt.value = codPad; // Guardamos con padding
        opt.textContent = `${codPad} - ${prog.nombre}`;
        selProg.appendChild(opt);
    });

    if (data && data.prog) {
        selProg.value = String(data.prog).padStart(2, '0');
        onProgramaChangeCP(id, data);
    }
}

function onProgramaChangeCP(id, data = null) {
    const card = document.getElementById(`cp-gasto-${id}`);
    if (!card) return;

    const selProg = card.querySelector(".sel-prog-cp");
    const selProy = card.querySelector(".sel-proy-cp");
    const selPartida = card.querySelector(".sel-partida-cp");

    selProy.innerHTML = `<option value="">-- Seleccionar Proyecto --</option>`;
    selPartida.innerHTML = `<option value="">-- Seleccionar Partida --</option>`;

    const progSel = catalogoPOACP.find(p => String(p.codigo).padStart(2, '0') === selProg.value);
    if (progSel && progSel.proyectos) {
        progSel.proyectos.forEach(py => {
            const pProy = String(py.codigo_proy).padStart(4, '0');
            const pAct = String(py.actividad).padStart(2, '0');
            const opt = document.createElement("option");
            opt.value = `${pProy}|${pAct}`;
            opt.textContent = `${pProy} ${pAct} - ${py.nombre}`;
            selProy.appendChild(opt);
        });
    }

    if (data && data.proy) {
        const proyVal = String(data.proy).padStart(4, '0');
        const actVal = String(data.act || '01').padStart(2, '0');
        selProy.value = `${proyVal}|${actVal}`;
        onProyectoChangeCP(id, data);
    }
}

function onProyectoChangeCP(id, data = null) {
    const card = document.getElementById(`cp-gasto-${id}`);
    if (!card) return;

    const selProg = card.querySelector(".sel-prog-cp");
    const selProy = card.querySelector(".sel-proy-cp");
    const selPartida = card.querySelector(".sel-partida-cp");

    selPartida.innerHTML = `<option value="">-- Seleccionar Partida --</option>`;

    const progSel = catalogoPOACP.find(p => String(p.codigo).padStart(2, '0') === selProg.value);
    if (!progSel) return;

    const [codProy, act] = selProy.value.split('|');
    const proySel = progSel.proyectos.find(py => String(py.codigo_proy).padStart(4, '0') === codProy && String(py.actividad).padStart(2, '0') === act);

    if (proySel && proySel.partidas) {
        proySel.partidas.forEach(pt => {
            const opt = document.createElement("option");
            opt.value = pt.codigo;
            opt.dataset.fullText = `${pt.codigo} - ${pt.descripcion}`;
            opt.dataset.ff = pt.ff || "";
            opt.dataset.of = pt.of || "";
            opt.dataset.desc = pt.descripcion || "";
            opt.textContent = opt.dataset.fullText;
            selPartida.appendChild(opt);
        });
    }

    if (data && data.partida) {
        selPartida.value = data.partida;
        onPartidaChangeCP(id);
    }
}

function onPartidaChangeCP(id) {
    const card = document.getElementById(`cp-gasto-${id}`);
    if (!card) return;

    const selPartida = card.querySelector(".sel-partida-cp");
    restaurarNombresPartidasCP(id);

    const selectedOpt = selPartida.options[selPartida.selectedIndex];
    if (selectedOpt && selectedOpt.value !== "") {
        card.querySelector(".inp-ff-cp").value = selectedOpt.dataset.ff || "";
        card.querySelector(".inp-of-cp").value = selectedOpt.dataset.of || "";
        card.querySelector(".inp-desc-cp").value = selectedOpt.dataset.desc || "";
        
        selectedOpt.textContent = selectedOpt.value;
    }
}

function restaurarNombresPartidasCP(id) {
    const card = document.getElementById(`cp-gasto-${id}`);
    if (!card) return;

    const selPartida = card.querySelector(".sel-partida-cp");
    Array.from(selPartida.options).forEach(opt => {
        if (opt.dataset.fullText) {
            opt.textContent = opt.dataset.fullText;
        }
    });
}

function eliminarGastoCP(id) {
    const el = document.getElementById(`cp-gasto-${id}`);
    if (el) el.remove();
    reindexarGastosCP();
    calcularTotalGastosCP();
}

function reindexarGastosCP() {
    const cards = document.querySelectorAll("#cp-contenedor-gastos .card-gasto-cp");
    cards.forEach((card, index) => {
        const num = card.querySelector(".num-gasto-cp");
        if (num) num.textContent = `#${index + 1}`;
    });
}

function calcularTotalGastosCP() {
    let granTotal = 0;
    const cards = document.querySelectorAll("#cp-contenedor-gastos .card-gasto-cp");
    cards.forEach(card => {
        granTotal += parseFloat(card.querySelector(".inp-monto-cp")?.value) || 0;
    });
    const elTotal = document.getElementById("cp-total-gastos");
    if (elTotal) elTotal.textContent = granTotal.toFixed(2);
    validarCuadreCP();
}

// ==========================================
// MÓDULO ÍTEMS GENERALES
// ==========================================
function agregarItemCP(data = null) {
    contadorItemsCP++;
    const tbody = document.getElementById("cp-tbody-items");
    if (!tbody) return;

    const tr = document.createElement("tr");
    tr.id = `cp-item-${contadorItemsCP}`;

    // Blindaje de lectura
    const v_obj = data?.objeto ?? data?.objeto_corto ?? "";
    const v_uni = data?.tipuni ?? data?.unidad ?? "";
    const v_cant = data?.cant ?? data?.cantidad ?? "0";
    const v_prec = data?.precio_unitario ?? "0";
    const v_tot = data?.total_item ?? "0.00";

    // Inyectamos sin la columna de descripción larga
    tr.innerHTML = `
        <td class="p-2"><input type="number" class="w-12 p-2 bg-slate-50 border rounded text-center num-item-cp outline-none text-xs font-bold text-slate-500" value="${contadorItemsCP}" readonly></td>
        <td class="p-2"><input type="text" placeholder="Ej. MATERIAL DE ESCRITORIO..." class="w-full p-2 bg-slate-50 border rounded obj-corto-cp outline-none text-xs focus:border-indigo-500" value="${v_obj}"></td>
        <td class="p-2"><input type="text" placeholder="PZA" class="w-24 p-2 bg-slate-50 border rounded unidad-cp outline-none text-xs text-center uppercase focus:border-indigo-500" value="${v_uni}"></td>
        <td class="p-2"><input type="number" step="0.01" min="0" class="w-24 p-2 bg-slate-50 border rounded cantidad-cp outline-none text-xs text-center focus:border-indigo-500" value="${v_cant}" oninput="calcularTotalItemsCP()"></td>
        <td class="p-2"><input type="number" step="0.01" min="0" class="w-32 p-2 bg-slate-50 border rounded precio-cp outline-none text-xs text-right focus:border-indigo-500" value="${v_prec}" oninput="calcularTotalItemsCP()"></td>
        <td class="p-2"><input type="text" class="w-32 p-2 bg-transparent border rounded total-cp text-emerald-700 font-bold outline-none text-xs text-right" value="${v_tot}" readonly></td>
        <td class="p-2 text-center"><button type="button" onclick="eliminarItemCP(${contadorItemsCP})" class="text-red-400 hover:text-red-600 transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button></td>
    `;
    tbody.appendChild(tr);
    if (typeof lucide !== 'undefined') lucide.createIcons();
    reindexarItemsCP();
    validarCuadreCP();
}

function eliminarItemCP(id) {
    const el = document.getElementById(`cp-item-${id}`);
    if (el) el.remove();
    reindexarItemsCP();
    calcularTotalItemsCP();
}

function reindexarItemsCP() {
    const tbody = document.getElementById("cp-tbody-items");
    if (!tbody) return;
    const filas = tbody.querySelectorAll("tr");
    filas.forEach((fila, index) => {
        const input = fila.querySelector(".num-item-cp");
        if (input) input.value = index + 1;
    });
}

function calcularTotalItemsCP() {
    let granTotal = 0;
    const tbody = document.getElementById("cp-tbody-items");
    if (!tbody) return;

    const filas = tbody.querySelectorAll("tr");
    filas.forEach(fila => {
        const cant = parseFloat(fila.querySelector(".cantidad-cp")?.value) || 0;
        const prec = parseFloat(fila.querySelector(".precio-cp")?.value) || 0;
        const total = cant * prec;
        const elTotalFila = fila.querySelector(".total-cp");
        if (elTotalFila) elTotalFila.value = total.toFixed(2);
        granTotal += total;
    });
    const elTotal = document.getElementById("cp-total-items");
    if (elTotal) elTotal.textContent = granTotal.toFixed(2);
    validarCuadreCP();
}

// ==========================================
// ABRIR, CERRAR Y GUARDAR
// ==========================================
async function abrirEditorSolicitudCP(proceso) {
    procesoActualCP = proceso;

    await cargarCatalogoPOACP();

    document.getElementById("cp-fecha").value = proceso.fecha_solicitud || new Date().toISOString().split('T')[0];
    document.getElementById("cp-distrito").value = proceso.distrito_comunidad || "";
    document.getElementById("cp-nombre").value = proceso.tecnico_solicitante || localStorage.getItem("user_nombre") || "SOLICITANTE";
    document.getElementById("cp-cargo").value = proceso.cargo_tecnico_solicitante || localStorage.getItem("user_cargo") || "ÁREA SOLICITANTE";

    const contGastos = document.getElementById("cp-contenedor-gastos");
    if (contGastos) contGastos.innerHTML = "";
    contadorGastosCP = 0;

    if (proceso.gastos && proceso.gastos.length > 0) {
        proceso.gastos.forEach(g => agregarGastoCP(g));
    } else {
        agregarGastoCP();
    }
    calcularTotalGastosCP();

    const docCP = proceso.documentos?.find(d => d.clave_documento === "solicitud_cp");
    const datosGuardados = docCP?.datos_formulario || {};

    // 2. Extraemos los ítems generales (el JSON)
    let itemsParaCargar = [];
    if (datosGuardados.items_generales && datosGuardados.items_generales.length > 0) {
        itemsParaCargar = datosGuardados.items_generales;
    }

    // 3. Limpiamos y repoblamos la tabla visual
    const tbodyItems = document.getElementById("cp-tbody-items");
    if (tbodyItems) tbodyItems.innerHTML = "";
    contadorItemsCP = 0;

    if (itemsParaCargar.length > 0) {
        itemsParaCargar.forEach(i => agregarItemCP(i));
    } else {
        agregarItemCP(); // Fila en blanco si es trámite nuevo
    }
    calcularTotalItemsCP();

    const vista = document.getElementById("vista-solicitud-cp");
    if (vista) {
        vista.classList.remove("hidden");
        vista.classList.add("flex");
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();

    validarCuadreCP();
}

function cerrarEditorSolicitudCP() {
    const vista = document.getElementById("vista-solicitud-cp");
    if (vista) {
        vista.classList.add("hidden");
        vista.classList.remove("flex");
    }
}

async function guardarSolicitudCP(formato) {
    const urlParams = new URLSearchParams(window.location.search);
    const PROCESO_ID = urlParams.get('id');
    const botones = document.querySelectorAll(".btn-guardar-cp");

    try {
        const cardsGastos = document.querySelectorAll("#cp-contenedor-gastos .card-gasto-cp");
        const tbodyItems = document.getElementById("cp-tbody-items");
        const filasItems = tbodyItems ? tbodyItems.querySelectorAll("tr") : [];

        botones.forEach(b => {
            b.disabled = true;
            b.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Procesando...`;
        });

        const gastosPayload = Array.from(cardsGastos).map(card => {
            const selProg = card.querySelector(".sel-prog-cp").value;
            const selProyVal = card.querySelector(".sel-proy-cp").value;
            const [proy, act] = selProyVal.includes('|') ? selProyVal.split('|') : ["0000", "01"];

            return {
                partida: card.querySelector(".sel-partida-cp").value.trim(),
                prog: selProg.trim(),
                proy: proy.trim(),
                act: act.trim(),
                ff: card.querySelector(".inp-ff-cp").value.trim(),
                of: card.querySelector(".inp-of-cp").value.trim(),
                descripcion: card.querySelector(".inp-desc-cp").value.trim(),
                monto: parseFloat(card.querySelector(".inp-monto-cp").value) || 0
            };
        });

        const itemsPayload = Array.from(filasItems).map(fila => ({
            nro: parseInt(fila.querySelector(".num-item-cp").value),
            objeto: fila.querySelector(".obj-corto-cp").value.trim(),
            tipuni: fila.querySelector(".unidad-cp").value.trim(),
            cant: parseFloat(fila.querySelector(".cantidad-cp").value) || 0,
            precio_unitario: parseFloat(fila.querySelector(".precio-cp").value) || 0,
            total_item: parseFloat(fila.querySelector(".total-cp").value) || 0
        }));

        // MAGIA: Inyectamos todo en el documento sin usar el peligroso PUT global
        const payloadDoc = {
            clave_documento: "solicitud_cp",
            estado: "FINALIZADO",
            datos_formulario: {
                fecha_documento: document.getElementById("cp-fecha").value,
                distrito_comunidad: document.getElementById("cp-distrito").value.trim(),
                gastos: gastosPayload,
                items_generales: itemsPayload
            }
        };

        await window.API.procesos.guardarDocumento(PROCESO_ID, payloadDoc);

        cerrarEditorSolicitudCP();
        await cargarDatosProceso();
        await window.API.procesos.descargarDocumento(PROCESO_ID, "solicitud_cp", formato);

    } catch (error) {
        alert("Error: " + error.message);
    } finally {
        botones.forEach((b, index) => {
            b.disabled = false;
            b.innerHTML = index === 0 ? `<i data-lucide="file-text" class="w-5 h-5"></i> Emitir Word` : `<i data-lucide="printer" class="w-5 h-5"></i> Imprimir PDF`;
        });
        validarCuadreCP();
        if(typeof lucide !== 'undefined') lucide.createIcons();
    }
}

// Mapeos globales para Window
window.agregarGastoCP = agregarGastoCP;
window.eliminarGastoCP = eliminarGastoCP;
window.onProgramaChangeCP = onProgramaChangeCP;
window.onProyectoChangeCP = onProyectoChangeCP;
window.onPartidaChangeCP = onPartidaChangeCP;
window.restaurarNombresPartidasCP = restaurarNombresPartidasCP;
window.calcularTotalGastosCP = calcularTotalGastosCP;
window.agregarItemCP = agregarItemCP;
window.eliminarItemCP = eliminarItemCP;
window.calcularTotalItemsCP = calcularTotalItemsCP;
window.abrirEditorSolicitudCP = abrirEditorSolicitudCP;
window.cerrarEditorSolicitudCP = cerrarEditorSolicitudCP;
window.guardarSolicitudCP = guardarSolicitudCP;