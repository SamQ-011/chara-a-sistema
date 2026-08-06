// archivo: js/fases_tramite/paso5_cotizacion.js
let contadorCotizacion = 0;
let montoTotalProcesoRespaldo = 0; // Guardamos esto para no usar variable global en el guardado

async function cargarProveedoresDatalist() {
    try {
        const res = await fetch(`/api/catalogos/proveedores`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
        });
        if (res.ok) {
            const proveedores = await res.json();
            const datalist = document.getElementById("lista-proveedores");
            datalist.innerHTML = "";
            proveedores.forEach(p => {
                const option = document.createElement("option");
                option.value = p.razon_social;
                option.dataset.nit = p.nit_ci; 
                datalist.appendChild(option);
            });
        }
    } catch (error) { console.warn("No se pudo cargar la lista de proveedores", error); }
}

function agregarFilaCotizacion(data = null) {
    contadorCotizacion++;
    const tr = document.createElement("tr");
    tr.id = `cot-item-${contadorCotizacion}`;
    const v_prov = data ? data.pr : "";
    const v_desc = data ? data.dec : "Cumple con las Especificaciones Técnicas";
    const v_pt = data ? data.pt : "0.00";

    tr.innerHTML = `
        <td class="p-2 align-top"><input type="text" class="w-full p-2 bg-slate-50 border border-slate-200 rounded cot-prov outline-none text-sm focus:border-indigo-500" value="${v_prov}" placeholder="Nombre de Empresa"></td>
        <td class="p-2 align-top"><input type="text" class="w-full p-2 bg-slate-50 border border-slate-200 rounded cot-desc outline-none text-sm focus:border-indigo-500" value="${v_desc}"></td>
        <td class="p-2 align-top"><input type="number" step="0.01" class="w-full p-2 bg-slate-50 border border-slate-200 rounded text-right cot-pt outline-none text-sm focus:border-indigo-500" value="${v_pt}"></td>
        <td class="p-2 text-center align-top pt-4">
            <button type="button" onclick="document.getElementById('cot-item-${contadorCotizacion}').remove()" class="text-red-400 hover:text-red-600 transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
        </td>
    `;
    document.getElementById("inf-tabla-cotizaciones").appendChild(tr);
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

function abrirEditorInformeCotizacion(proceso) {
    cargarProveedoresDatalist();
    
    // Guardamos el monto en variable de este scope para usarlo luego
    montoTotalProcesoRespaldo = parseFloat(proceso.monto_total);

    const docInfo = proceso.documentos?.find(d => d.clave_documento === "informe_cotizacion");
    const datosGuardados = docInfo?.datos_formulario || {};

    const adminDefault = localStorage.getItem("user_rol") === "ADMIN" ? (localStorage.getItem("user_nombre") || "Tec. Rosa Aduviri Vichini") : "Tec. Rosa Aduviri Vichini";
    document.getElementById("inf-rpc").value = datosGuardados.encargado_rpc || "Gerson Elvis Vargas Conde";
    document.getElementById("inf-asistente").value = datosGuardados.asistente_adm || adminDefault;
    document.getElementById("inf-fecha-informe").value = datosGuardados.fecha_informe || new Date().toISOString().split('T')[0];
    document.getElementById("inf-fecha-cot").value = datosGuardados.fecha_cotizacion || new Date().toISOString().split('T')[0];
    document.getElementById("inf-finalidad").value = datosGuardados.finalidad_contratacion || "";
    document.getElementById("inf-proveedor-ganador").value = datosGuardados.proveedor_ganador || "";
    document.getElementById("inf-tabla-cotizaciones").innerHTML = "";
    
    contadorCotizacion = 0;
    if (datosGuardados.cotizaciones && datosGuardados.cotizaciones.length > 0) {
        datosGuardados.cotizaciones.forEach(cot => agregarFilaCotizacion(cot));
    } else {
        agregarFilaCotizacion(); agregarFilaCotizacion();
    }

    const vista = document.getElementById("vista-informe-cotizacion");
    vista.classList.remove("hidden"); vista.classList.add("flex");
}

function cerrarEditorInformeCotizacion() {
    const vista = document.getElementById("vista-informe-cotizacion");
    vista.classList.add("hidden"); vista.classList.remove("flex");
}

async function guardarInformeCotizacion(formato) {
    const urlParams = new URLSearchParams(window.location.search);
    const PROCESO_ID = urlParams.get('id');
    const botones = document.querySelectorAll(".btn-guardar-cot");
    
    try {
        botones.forEach(b => {
            b.disabled = true;
            b.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Procesando...`;
        });

        const cotizaciones = [];
        let montoAdjudicado = 0;
        const provGanador = document.getElementById("inf-proveedor-ganador").value.trim();
        let nitGanador = "S/N";
        const optionsProv = document.querySelectorAll("#lista-proveedores option");
        optionsProv.forEach(opt => {
            if (opt.value.trim().toLowerCase() === provGanador.toLowerCase() && opt.dataset.nit) {
                nitGanador = opt.dataset.nit;
            }
        });

        document.getElementById("inf-tabla-cotizaciones").querySelectorAll("tr").forEach(fila => {
            const pr = fila.querySelector(".cot-prov").value.trim();
            const dec = fila.querySelector(".cot-desc").value.trim();
            const pt = parseFloat(fila.querySelector(".cot-pt").value) || 0;
            
            cotizaciones.push({ pr, dec, pt });
            
            if (pr !== "" && pr === provGanador) {
                montoAdjudicado = pt;
            }
        });

        if (montoAdjudicado === 0) montoAdjudicado = montoTotalProcesoRespaldo;

        const payload = {
            clave_documento: "informe_cotizacion",
            estado: "FINALIZADO",
            datos_formulario: {
                encargado_rpc: document.getElementById("inf-rpc").value.trim(),
                asistente_adm: document.getElementById("inf-asistente").value.trim(),
                fecha_informe: document.getElementById("inf-fecha-informe").value,
                fecha_cotizacion: document.getElementById("inf-fecha-cot").value,
                finalidad_contratacion: document.getElementById("inf-finalidad").value.trim(),
                proveedor_ganador: provGanador,
                nit_ganador: nitGanador,
                cotizaciones: cotizaciones,
                monto_adjudicado: montoAdjudicado
            }
        };

        await window.API.procesos.guardarDocumento(PROCESO_ID, payload);
        cerrarEditorInformeCotizacion();
        await cargarDatosProceso(); 
        await window.API.procesos.descargarDocumento(PROCESO_ID, "informe_cotizacion", formato);

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