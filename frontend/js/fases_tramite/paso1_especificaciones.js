// archivo: js/fases_tramite/paso1_especificaciones.js

let contadorItemsSpec = 0;
let procesoActualSpecs = null;

function agregarItemSpec(data = null) {
    contadorItemsSpec++;
    const tr = document.createElement("tr");
    tr.id = `esp-item-${contadorItemsSpec}`;
    
    // BLINDAJE 2026: Evita el texto "undefined" buscando ambas llaves o forzando texto vacío
    const v_obj = data?.objeto ?? data?.objeto_corto ?? "";
    const v_desc = data?.descripcion ?? data?.descripcion_larga ?? "";
    const v_uni = data?.tipuni ?? data?.unidad ?? "";
    const v_cant = data?.cant ?? data?.cantidad ?? "";
    const v_prec = data?.precio_unitario ?? "0";
    const v_tot = data?.total_item ?? "0.00";

    tr.innerHTML = `
        <td class="p-2 align-top"><input type="number" class="w-full bg-transparent text-center esp-num outline-none text-sm font-medium text-slate-500 mt-2" value="${contadorItemsSpec}" readonly></td>
        <td class="p-2 align-top"><textarea rows="2" class="w-full p-2 bg-slate-50 border border-slate-200 rounded esp-obj outline-none text-sm focus:border-indigo-500" placeholder="Ej. ANTICONGELANTE">${v_obj}</textarea></td>
        <td class="p-2 align-top"><textarea rows="3" class="w-full p-2 bg-slate-50 border border-slate-200 rounded esp-desc outline-none text-sm focus:border-indigo-500" placeholder="- De 200 Litros\n- Marca específica">${v_desc}</textarea></td>
        <td class="p-2 align-top"><input type="text" class="w-full p-2 bg-slate-50 border border-slate-200 rounded text-center esp-uni outline-none text-sm focus:border-indigo-500 mt-1" value="${v_uni}"></td>
        <td class="p-2 align-top"><input type="number" step="0.01" min="0" class="w-full p-2 bg-slate-50 border border-slate-200 rounded text-center esp-cant outline-none text-sm focus:border-indigo-500 mt-1" value="${v_cant}" oninput="calcularTotalSpecs()"></td>
        <td class="p-2 align-top"><input type="number" step="0.01" min="0" class="w-full p-2 bg-slate-50 border border-slate-200 rounded text-right esp-prec outline-none text-sm focus:border-indigo-500 mt-1" value="${v_prec}" oninput="calcularTotalSpecs()"></td>
        <td class="p-2 align-top"><input type="text" class="w-full p-2 bg-transparent text-right font-bold text-slate-700 esp-tot outline-none text-sm mt-1" value="${v_tot}" readonly></td>
        <td class="p-2 text-center align-top pt-4">
            <button type="button" onclick="eliminarItemSpec(${contadorItemsSpec})" class="text-red-400 hover:text-red-600 transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
        </td>
    `;
    document.getElementById("spec-tbody-items").appendChild(tr);
    if(typeof lucide !== 'undefined') lucide.createIcons();
    reindexarSpecs();
}

function eliminarItemSpec(id) {
    const el = document.getElementById(`esp-item-${id}`);
    if (el) el.remove();
    reindexarSpecs();
    calcularTotalSpecs();
}

function reindexarSpecs() {
    const filas = document.getElementById("spec-tbody-items").querySelectorAll("tr");
    filas.forEach((fila, index) => {
        fila.querySelector(".esp-num").value = index + 1;
    });
}

function calcularTotalSpecs() {
    let granTotal = 0;
    const filas = document.getElementById("spec-tbody-items").querySelectorAll("tr");
    filas.forEach(fila => {
        const cant = parseFloat(fila.querySelector(".esp-cant").value) || 0;
        const prec = parseFloat(fila.querySelector(".esp-prec").value) || 0;
        const total = cant * prec;
        fila.querySelector(".esp-tot").value = total.toFixed(2);
        granTotal += total;
    });
    document.getElementById("spec-total-items").textContent = granTotal.toFixed(2);
}

function agregarPuntoExtraSpec(titulo = "", descripcion = "") {
    const contenedor = document.getElementById("spec-puntos-extra") || document.getElementById("contenedor-puntos-extra");
    if (!contenedor) {
        console.error("No se encontró el contenedor de puntos extra (#spec-puntos-extra).");
        return;
    }
    const div = document.createElement("div");
    div.className = "punto-extra-item flex gap-3 items-start bg-white p-3 border border-slate-200 rounded-xl shadow-sm";
    div.innerHTML = `
        <div class="flex-1 space-y-2">
            <input type="text" class="pe-titulo w-full border border-slate-300 rounded p-2 text-sm font-bold text-slate-800 focus:border-indigo-500 outline-none" placeholder="Título del Punto (Ej. Garantía)" value="${titulo}">
            <textarea rows="1" class="pe-desc w-full border border-slate-300 rounded p-2 text-sm text-slate-600 focus:border-indigo-500 outline-none" placeholder="Descripción...">${descripcion}</textarea>
        </div>
        <button type="button" onclick="this.parentElement.remove()" class="text-red-400 hover:text-red-600 p-2 bg-slate-50 rounded-lg transition mt-1"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
    `;
    contenedor.appendChild(div);
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

function agregarCondicionSpec(texto = "") {
    const contenedor = document.getElementById("spec-condiciones") || document.getElementById("contenedor-condiciones");
    if (!contenedor) {
        console.error("No se encontró el contenedor de condiciones (#spec-condiciones).");
        return;
    }
    const div = document.createElement("div");
    div.className = "condicion-item flex gap-3 items-center";
    div.innerHTML = `
        <div class="w-2 h-2 rounded-full bg-slate-400 shrink-0"></div>
        <input type="text" class="cond-texto flex-1 border border-slate-300 rounded-lg p-2.5 text-sm text-slate-700 focus:border-indigo-500 outline-none bg-white shadow-sm" placeholder="Ej. El proveedor debe entregar certificados de calidad..." value="${texto}">
        <button type="button" onclick="this.parentElement.remove()" class="text-red-400 hover:text-red-600 p-2 bg-white border border-slate-200 rounded-lg shadow-sm transition"><i data-lucide="x" class="w-4 h-4"></i></button>
    `;
    contenedor.appendChild(div);
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

// Mapeo global para llamadas desde el HTML
window.agregarItemSpec = agregarItemSpec;
window.eliminarItemSpec = eliminarItemSpec;
window.calcularTotalSpecs = calcularTotalSpecs;
window.agregarPuntoExtraSpec = agregarPuntoExtraSpec;
window.agregarCondicionSpec = agregarCondicionSpec;

function abrirEditorEspecificaciones(proceso) {
    procesoActualSpecs = proceso;
    
    const docExistente = proceso.documentos?.find(d => d.clave_documento === "especificaciones_tecnicas");
    const datosGuardados = docExistente?.datos_formulario || {};

    // Cargar el nombre del proceso y lugar de entrega
    const inputObjeto = document.getElementById("spec-objeto");
    if (inputObjeto) inputObjeto.value = proceso.objeto_contratacion || "";

    const inputTipo = document.getElementById("spec-tipo");
    if (inputTipo) inputTipo.value = proceso.tipo_contratacion !== "PENDIENTE" ? proceso.tipo_contratacion : "BIENES";

    const inputLugar = document.getElementById("spec-lugar");
    if (inputLugar) inputLugar.value = datosGuardados.lugar_entrega || proceso.distrito_comunidad || "";

    // Cargar Puntos Extra
    const contPuntos = document.getElementById("spec-puntos-extra") || document.getElementById("contenedor-puntos-extra");
    if (contPuntos) {
        contPuntos.innerHTML = "";
        if (datosGuardados.puntos_extra && datosGuardados.puntos_extra.length > 0) {
            datosGuardados.puntos_extra.forEach(pe => agregarPuntoExtraSpec(pe.titulo, pe.descripcion));
        }
    }

    // Cargar Condiciones
    const contCond = document.getElementById("spec-condiciones") || document.getElementById("contenedor-condiciones");
    if (contCond) {
        contCond.innerHTML = "";
        if (datosGuardados.condiciones && datosGuardados.condiciones.length > 0) {
            datosGuardados.condiciones.forEach(c => agregarCondicionSpec(c));
        } else if (!docExistente) {
            agregarCondicionSpec("Ninguna.");
        }
    }

    // Cargar Tabla de Ítems
    document.getElementById("spec-tbody-items").innerHTML = "";
    contadorItemsSpec = 0;
    
    if (datosGuardados.items_tecnicos && datosGuardados.items_tecnicos.length > 0) {
        datosGuardados.items_tecnicos.forEach(item => agregarItemSpec(item));
    } else {
        agregarItemSpec(); 
    }
    calcularTotalSpecs();

    const vista = document.getElementById("vista-especificaciones");
    vista.classList.remove("hidden");
    vista.classList.add("flex");
}

function cerrarEditorEspecificaciones() {
    const vista = document.getElementById("vista-especificaciones");
    vista.classList.add("hidden");
    vista.classList.remove("flex");
}

async function guardarEspecificaciones(formato) {
    const urlParams = new URLSearchParams(window.location.search);
    const PROCESO_ID = urlParams.get('id');
    const botones = document.querySelectorAll(".btn-guardar-specs");

    try {
        botones.forEach(b => {
            b.disabled = true;
            b.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Procesando...`;
        });

        const nuevoObjeto = document.getElementById("spec-objeto") ? document.getElementById("spec-objeto").value.trim() : procesoActualSpecs.objeto_contratacion;
        const nuevoTipo = document.getElementById("spec-tipo") ? document.getElementById("spec-tipo").value : "BIENES";

        // 1. Mapeo estricto a las variables que exige FastAPI (ItemProcesoBase)
        const itemsTecnicos = [];
        const filas = document.getElementById("spec-tbody-items").querySelectorAll("tr");
        filas.forEach(fila => {
            itemsTecnicos.push({
                nro_item: parseInt(fila.querySelector(".esp-num").value),
                objeto_corto: fila.querySelector(".esp-obj").value.trim(),
                descripcion_larga: fila.querySelector(".esp-desc").value.trim(),
                unidad: fila.querySelector(".esp-uni").value.trim(),
                cantidad: parseFloat(fila.querySelector(".esp-cant").value) || 0,
                precio_unitario: parseFloat(fila.querySelector(".esp-prec").value) || 0,
                total_item: parseFloat(fila.querySelector(".esp-tot").value) || 0
            });
        });

        const contPuntos = document.getElementById("spec-puntos-extra") || document.getElementById("contenedor-puntos-extra");
        const contCond = document.getElementById("spec-condiciones") || document.getElementById("contenedor-condiciones");

        const puntosExtra = contPuntos ? Array.from(contPuntos.querySelectorAll(".punto-extra-item")).map(div => ({
            titulo: div.querySelector(".pe-titulo").value.trim(),
            descripcion: div.querySelector(".pe-desc").value.trim()
        })).filter(p => p.titulo !== "" || p.descripcion !== "") : [];

        const condiciones = contCond ? Array.from(contCond.querySelectorAll(".condicion-item input")).map(input => input.value.trim()).filter(c => c !== "") : [];

        // 2. PUT MAESTRO: Actualiza el nombre oficial y graba los ítems en la tabla principal
        const uiData = {
            proveedor: "POR DEFINIR",
            nit: "0",
            direccion: "",
            telefono: "",
            codigo: procesoActualSpecs.codigo_proceso || "TEMP",
            n_orden: procesoActualSpecs.nro_orden || "",
            objeto: nuevoObjeto, // El nombre final
            desca: nuevoObjeto.substring(0, 50), // Substring obligatorio para el esquema
            cod_proy: procesoActualSpecs.proyecto ? procesoActualSpecs.proyecto.codigo_proyecto : "N/A",
            uni_solic: procesoActualSpecs.unidad_solicitante ? procesoActualSpecs.unidad_solicitante.nombre : "N/A",
            distrito_comunidad: procesoActualSpecs.distrito_comunidad || "S/N",
            tipo_pago: procesoActualSpecs.tipo_pago || "TRANSFERENCIA BANCARIA",
            tipo_contratacion: nuevoTipo,
            plazo: procesoActualSpecs.plazo_entrega || 0,
            monto_total: procesoActualSpecs.monto_total || 0,
            retencion_val: procesoActualSpecs.retencion_monto || 0,
            fecha_corta: procesoActualSpecs.fecha_solicitud || "",
            fecha_larga: "",
            fecha_info: "",
            enc_finanzas: procesoActualSpecs.responsable_presupuesto || "",
            nom_tecnico: procesoActualSpecs.tecnico_solicitante || "",
            cargo_tecnico: procesoActualSpecs.cargo_tecnico_solicitante || "",
            seleccionados: []
        };

        // 3. POST DOCUMENTO: Guarda la data exclusiva de esta fase
        const payloadDoc = {
            clave_documento: "especificaciones_tecnicas",
            estado: "FINALIZADO",
            datos_formulario: {
                nuevo_objeto_contratacion: nuevoObjeto, // <-- ENVIAMOS EL NOMBRE AQUÍ
                lugar_entrega: document.getElementById("spec-lugar") ? document.getElementById("spec-lugar").value.trim() : "",
                puntos_extra: puntosExtra,
                condiciones: condiciones,
                items_tecnicos: itemsTecnicos
            }
        };

        await window.API.procesos.guardarDocumento(PROCESO_ID, payloadDoc);
        cerrarEditorEspecificaciones();
        
        await cargarDatosProceso(); 
        await window.API.procesos.descargarDocumento(PROCESO_ID, "especificaciones_tecnicas", formato);

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

/* =========================================
   ASISTENTE SMART PASTE PARA EXCEL
========================================= */

let datosCrudosExcel = [];

window.abrirModalImportarExcel = function() {
    const modal = document.getElementById('modal-importar-excel');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    reiniciarImportacionExcel();
};

window.cerrarModalImportarExcel = function() {
    const modal = document.getElementById('modal-importar-excel');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
};

window.reiniciarImportacionExcel = function() {
    document.getElementById('excel-raw-data').value = '';
    document.getElementById('excel-paso-1').classList.remove('hidden');
    document.getElementById('excel-paso-2').classList.add('hidden');
    document.getElementById('excel-paso-2').classList.remove('flex');
    datosCrudosExcel = [];
};

// Conversor robusto para números de LATAM (ej. 1.200,50 o 15.50)
function parseNumeroLatam(str) {
    if (!str) return NaN;
    let s = str.toString().trim();
    if (s.includes(',') && s.includes('.')) {
        s = s.replace(/\./g, '').replace(',', '.'); // Formato: 1.200,50
    } else if (s.includes(',')) {
        s = s.replace(',', '.'); // Formato: 15,50
    }
    return parseFloat(s);
}

window.interceptarPegado = function(e) {
    e.preventDefault(); // Evitamos que el texto roto se pegue en el textarea

    const clipboard = e.clipboardData || window.clipboardData;
    const html = clipboard.getData('text/html');
    const text = clipboard.getData('text/plain');

    datosCrudosExcel = [];

    if (html) {
        // ESTÁNDAR NATIVO: Usamos el parser del navegador para leer la tabla de Excel
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const filas = doc.querySelectorAll('tr');
        
        filas.forEach(fila => {
            const celdas = fila.querySelectorAll('td, th');
            const datosFila = Array.from(celdas).map(celda => {
                // innerText lee el contenido visual, reemplazamos saltos internos por espacios
                return celda.innerText.trim().replace(/\n/g, ' '); 
            });
            // Si la fila tiene al menos un dato, la guardamos
            if (datosFila.some(c => c !== '')) {
                datosCrudosExcel.push(datosFila);
            }
        });
    } else {
        // Fallback: Si copian desde el bloc de notas (texto plano)
        const filas = text.split('\n').map(r => r.split('\t'));
        datosCrudosExcel = filas.filter(r => r.some(c => c.trim() !== ''));
    }

    if (datosCrudosExcel.length === 0) return alert("No se detectaron datos válidos.");

    document.getElementById('excel-raw-data').value = "✅ Tabla capturada con éxito. Procesando...";
    
    // Transición automática al mapeo
    setTimeout(() => procesarDatosCapturados(), 300);
};

window.procesarDatosCapturados = function() {
    document.getElementById('excel-paso-1').classList.add('hidden');
    document.getElementById('excel-paso-2').classList.remove('hidden');
    document.getElementById('excel-paso-2').classList.add('flex');

    const thead = document.getElementById('excel-mapeo-thead');
    const tbody = document.getElementById('excel-mapeo-tbody');
    thead.innerHTML = ''; 
    tbody.innerHTML = '';

    const numCols = Math.max(...datosCrudosExcel.map(r => r.length));

    const trHead = document.createElement('tr');
    for (let i = 0; i < numCols; i++) {
        const th = document.createElement('th');
        th.className = "p-2";
        th.innerHTML = `
            <select class="map-columna w-full border border-slate-300 p-1.5 rounded-lg text-xs font-bold text-slate-800 bg-white focus:border-indigo-500 focus:ring-1 outline-none" data-col="${i}">
                <option value="ignore">-- Ignorar --</option>
                <option value="objeto">Objeto Corto / Nombre</option>
                <option value="desc">Descripción / Forma</option>
                <option value="unidad">Unidad de Medida</option>
                <option value="cant">Cantidad</option>
                <option value="precio">Precio Unitario</option>
            </select>
        `;
        trHead.appendChild(th);
    }
    thead.appendChild(trHead);

    const previewRows = datosCrudosExcel.slice(0, 8);
    previewRows.forEach(row => {
        const tr = document.createElement('tr');
        for (let i = 0; i < numCols; i++) {
            const td = document.createElement('td');
            td.textContent = row[i] ? row[i] : '';
            td.className = "p-3 text-slate-600 max-w-[200px] truncate";
            tr.appendChild(td);
        }
        tbody.appendChild(tr);
    });
};

window.confirmarImportacionExcel = function() {
    const selectores = Array.from(document.querySelectorAll('.map-columna'));
    const mapa = {};
    
    selectores.forEach(sel => {
        if (sel.value !== 'ignore') mapa[sel.value] = parseInt(sel.getAttribute('data-col'));
    });

    if (!('objeto' in mapa) || !('cant' in mapa) || !('precio' in mapa)) {
        return alert("⚠️ Es obligatorio asignar al menos las columnas de: Objeto Corto, Cantidad y Precio Unitario.");
    }

    let itemsAñadidos = 0;

    datosCrudosExcel.forEach(fila => {
        // Validación estricta: Si cantidad o precio no son números, es un título/basura y se ignora
        const rawCant = fila[mapa['cant']] || '';
        const rawPrecio = fila[mapa['precio']] || '';
        
        const cant = parseNumeroLatam(rawCant);
        const precio = parseNumeroLatam(rawPrecio);

        // El filtro inteligente de filas basura
        if (isNaN(cant) || isNaN(precio) || cant <= 0 || precio <= 0) return;

        const objeto = fila[mapa['objeto']] ? fila[mapa['objeto']].trim() : '';
        const desc = ('desc' in mapa && fila[mapa['desc']]) ? fila[mapa['desc']].trim() : '';
        const unidad = ('unidad' in mapa && fila[mapa['unidad']]) ? fila[mapa['unidad']].trim() : 'PIEZA';

        // Inyectar a la tabla oficial de especificaciones
        window.agregarItemSpec({
            objeto_corto: objeto,
            descripcion_larga: desc,
            unidad: unidad,
            cantidad: cant,
            precio_unitario: precio,
            total_item: cant * precio
        });
        
        itemsAñadidos++;
    });

    if (itemsAñadidos === 0) {
        alert("No se encontró ningún ítem válido (revise que las cantidades y precios tengan formato numérico).");
        return;
    }

    window.calcularTotalSpecs();
    cerrarModalImportarExcel();
};