// archivo: js/detalle_proceso.js
const urlParams = new URLSearchParams(window.location.search);
const PROCESO_ID = urlParams.get('id');

if (!PROCESO_ID) {
    window.location.href = "index.html";
}

document.addEventListener("DOMContentLoaded", async () => {
    document.getElementById("ui-user-name").textContent = localStorage.getItem("user_nombre") || "Usuario";
    document.getElementById("ui-user-rol").textContent = localStorage.getItem("user_cargo") || "Funcionario";

    await cargarDatosProceso();
});

const MAESTRO_DOCUMENTOS = [
    { id_tipo: "especificaciones_tecnicas", nombre: "Especificaciones Técnicas", owner: ["SOLICITANTE"], desc: "Definición detallada de los ítems específicos." },
    { id_tipo: "solicitud_cp", nombre: "Solicitud de Certificación Presupuestaria", owner: ["SOLICITANTE"], desc: "Carga de gastos e ítems generales." },
    { id_tipo: "cert_presupuestaria", nombre: "Certificación Presupuestaria", owner: ["PRESUPUESTO"], desc: "Asignación formal de la partida presupuestaria." },
    { id_tipo: "solicitud_inicio", nombre: "Solicitud de Inicio de Proceso", owner: ["SOLICITANTE"], desc: "Solicitud formal de inicio." },
    { id_tipo: "autorizacion_inicio", nombre: "Autorización de Inicio", owner: ["RPC"], desc: "Resolución oficial para iniciar la contratación." },
    { id_tipo: "informe_cotizacion", nombre: "Informe de Cotización", owner: ["SOLICITANTE", "ADMIN"], desc: "Evaluación de proformas y selección de proveedor." },
    { id_tipo: "notificacion_adjudicacion", nombre: "Notificación de Adjudicación", owner: ["RPC"], desc: "Aviso formal al proveedor ganador." },
    { id_tipo: "orden_compra", nombre: "Orden de Compra / Servicio", owner: ["RPC"], desc: "Documento oficial de solicitud de provisión." },
    { id_tipo: "almacenes", nombre: "Ingreso y Salida de Almacenes", owner: ["ADMIN", "RPC"], desc: "Registro de recepción y despacho logístico." },
    { id_tipo: "acta_recepcion", nombre: "Acta de Entrega", owner: ["SOLICITANTE"], desc: "Entrega oficial del área solicitante al beneficiario." },
    { id_tipo: "informe_conformidad", nombre: "Informe de Confomidad", owner: ["SOLICITANTE"], desc: "Conformidad final del área solicitante." }
];

async function cargarDatosProceso() {
    try {
        const proceso = await window.API.procesos.obtener(PROCESO_ID);
        const rolActual = getEffectiveRole();
        
        document.getElementById("txt-codigo-proceso").textContent = proceso.codigo_proceso;
        document.getElementById("badge-estado").textContent = proceso.estado;
        document.getElementById("lbl-objeto").textContent = proceso.objeto_contratacion || "No definido";
        
        // Gasto Solicitado vs Gasto Adjudicado
        const montoSol = parseFloat(proceso.monto_total) || 0;
        const montoAdj = (proceso.monto_adjudicado !== null && proceso.monto_adjudicado !== undefined) ? parseFloat(proceso.monto_adjudicado) : null;
        
        const elSol = document.getElementById("lbl-monto-solicitado");
        if (elSol) elSol.textContent = `Bs. ${montoSol.toFixed(2)}`;
        
        const containerAdj = document.getElementById("container-monto-adjudicado");
        if (containerAdj) {
            if (montoAdj !== null && montoAdj > 0) {
                const ahorro = montoSol - montoAdj;
                const badgeAhorro = ahorro > 0 ? `<span class="ml-2 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">Ahorro: Bs. ${ahorro.toFixed(2)}</span>` : '';
                containerAdj.innerHTML = `<span class="font-black text-emerald-600 text-base tabular-nums">Bs. ${montoAdj.toFixed(2)}</span> ${badgeAhorro}`;
            } else {
                containerAdj.innerHTML = `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">Pendiente de Adjudicación</span>`;
            }
        }
        
        // UX: Arreglando el plazo "0 días"
        const plazoStr = parseInt(proceso.plazo_entrega) === 0 ? "Inmediato" : `${proceso.plazo_entrega} días`;
        document.getElementById("lbl-plazo").textContent = plazoStr;
        document.getElementById("lbl-area").textContent = proceso.unidad_solicitante || "S/N";
        
        // Banner visual para procesos ANULADOS
        const bannerContainer = document.getElementById("container-banner-anulado");
        if (proceso.estado === "ANULADO") {
            if (bannerContainer) {
                bannerContainer.classList.remove("hidden");
                bannerContainer.innerHTML = `
                    <div class="bg-red-50 border-l-4 border-red-500 p-5 rounded-r-2xl text-red-900 shadow-sm flex items-center justify-between">
                        <div class="flex items-center gap-4">
                            <div class="p-3 bg-red-100 rounded-xl text-red-600">
                                <i data-lucide="slash" class="w-6 h-6"></i>
                            </div>
                            <div>
                                <p class="font-bold text-base">Este trámite ha sido ANULADO / FUSIONADO</p>
                                <p class="text-xs text-red-700 mt-0.5">Fue unificado en el Expediente Maestro ${proceso.fusionado_en_id ? `#${proceso.fusionado_en_id}` : ''}. Este expediente se conserva solo para fines de auditoría y lectura.</p>
                            </div>
                        </div>
                        <span class="px-3 py-1 bg-red-200 text-red-800 rounded-lg text-xs font-bold uppercase tracking-wider">Solo Lectura</span>
                    </div>
                `;
            }
        } else if (bannerContainer) {
            bannerContainer.classList.add("hidden");
        }

        renderizarControlesEdicion(rolActual, proceso);
        renderizarDocumentos(rolActual, proceso);
        renderizarTablasDetalle(proceso);

    } catch (error) {
        alert("Error cargando el proceso: " + error.message);
        window.location.href = "index.html";
    }
}

function renderizarControlesEdicion(rolActual, proceso) {
    const contenedorBotones = document.getElementById("contenedor-acciones-principales");
    if (!contenedorBotones) return;

    if (proceso.estado === "ANULADO") {
        contenedorBotones.innerHTML = "";
        return;
    }

    const tieneDocumentosAvanzados = proceso.documentos && proceso.documentos.some(d => d.clave_documento !== 'solicitud_cp');

    if (["SOLICITANTE", "ADMIN"].includes(rolActual) && !tieneDocumentosAvanzados) {
        contenedorBotones.innerHTML = `
            <button onclick="redirigirEdicionGlobal()" class="text-sm text-indigo-600 bg-indigo-50 hover:bg-indigo-100 font-bold px-3 py-1.5 rounded-lg transition-colors border border-indigo-100 flex items-center gap-1.5 opacity-0 group-hover:opacity-100">
                <i data-lucide="edit-2" class="w-3.5 h-3.5"></i> Corregir Trámite
            </button>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

function redirigirEdicionGlobal() {
    window.location.href = `nuevo_proceso.html?edit=true&id=${PROCESO_ID}`;
}

function renderizarDocumentos(rolActual, proceso) {
    const contenedor = document.getElementById("contenedor-documentos");
    let html = `<div class="relative border-l-2 border-slate-200 ml-4 space-y-4">`;

    const esAnulado = proceso.estado === "ANULADO";
    const docsFinalizados = (proceso.documentos || []).filter(d => d.estado === "FINALIZADO").map(d => d.clave_documento);

    MAESTRO_DOCUMENTOS.forEach((doc, index) => {
        const tienePermiso = doc.owner.includes(rolActual) && !esAnulado;
        const estaListo = docsFinalizados.includes(doc.id_tipo);
        const textoRoles = doc.owner.join(' / ');
        
        const indicador = estaListo 
            ? `<i data-lucide="check-circle-2" class="w-7 h-7 text-emerald-500 bg-white rounded-full absolute -left-[15px] top-3 z-10 shadow-sm"></i>`
            : `<span class="absolute -left-[17px] top-3 flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold border-2 bg-white z-10 ${tienePermiso ? 'text-indigo-600 border-indigo-600 shadow-md shadow-indigo-200' : 'text-slate-400 border-slate-200'}">${index + 1}</span>`;
            
        const colorTitulo = tienePermiso ? "text-slate-800" : "text-slate-500";
        
        let uiAccion = "";
        if (esAnulado) {
            if (estaListo) {
                const btnWord = `window.API.procesos.descargarDocumento(PROCESO_ID, '${doc.id_tipo}', 'word')`;
                const btnPDF = `window.API.procesos.descargarDocumento(PROCESO_ID, '${doc.id_tipo}', 'pdf')`;
                uiAccion = `
                    <div class="flex items-center justify-between w-full">
                        <span class="px-3 py-1 bg-red-50 text-red-600 rounded-lg text-xs font-bold border border-red-100 flex items-center gap-1">
                            <i data-lucide="lock" class="w-3.5 h-3.5"></i> Bloqueado (Anulado)
                        </span>
                        <div class="flex items-center bg-slate-100 rounded-xl p-1 shadow-inner border border-slate-200">
                            <button onclick="${btnWord}" class="px-4 py-1.5 text-slate-600 hover:text-blue-600 hover:bg-white hover:shadow-sm rounded-lg transition-all flex items-center gap-2 text-sm font-semibold" title="Descargar Word">
                                <i data-lucide="file-text" class="w-4 h-4"></i> Word
                            </button>
                            <button onclick="${btnPDF}" class="px-4 py-1.5 text-slate-600 hover:text-red-600 hover:bg-white hover:shadow-sm rounded-lg transition-all flex items-center gap-2 text-sm font-semibold" title="Imprimir PDF">
                                <i data-lucide="printer" class="w-4 h-4"></i> Imprimir
                            </button>
                        </div>
                    </div>`;
            } else {
                uiAccion = `
                    <div class="flex justify-end w-full">
                        <span class="px-4 py-2 bg-slate-100 text-slate-400 rounded-lg flex items-center gap-2 text-sm border border-slate-200 font-medium">
                            <i data-lucide="slash" class="w-4 h-4"></i> Anulado
                        </span>
                    </div>`;
            }
        } else if (estaListo) {
            const btnWord = `window.API.procesos.descargarDocumento(PROCESO_ID, '${doc.id_tipo}', 'word')`;
            const btnPDF = `window.API.procesos.descargarDocumento(PROCESO_ID, '${doc.id_tipo}', 'pdf')`;
            const btnEdit = `abrirEditorFormulario('${doc.id_tipo}')`;

            uiAccion = `
                <div class="flex items-center justify-between w-full">
                    <button onclick="${btnEdit}" class="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 hover:underline">
                        <i data-lucide="edit-3" class="w-3.5 h-3.5"></i> Editar / Re-emitir
                    </button>
                    <div class="flex items-center bg-slate-100 rounded-xl p-1 shadow-inner border border-slate-200">
                        <button onclick="${btnWord}" class="px-4 py-1.5 text-slate-700 hover:text-blue-700 hover:bg-white hover:shadow-sm rounded-lg transition-all flex items-center gap-2 text-sm font-bold" title="Descargar Word">
                            <i data-lucide="file-text" class="w-4 h-4 text-blue-600"></i> Word
                        </button>
                        <button onclick="${btnPDF}" class="px-4 py-1.5 text-slate-700 hover:text-red-700 hover:bg-white hover:shadow-sm rounded-lg transition-all flex items-center gap-2 text-sm font-bold" title="Imprimir PDF">
                            <i data-lucide="printer" class="w-4 h-4 text-red-600"></i> Imprimir PDF
                        </button>
                    </div>
                </div>`;
        } else if (tienePermiso) {
            uiAccion = `
                <div class="flex justify-end w-full">
                    <button onclick="abrirEditorFormulario('${doc.id_tipo}')" class="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-200 hover:shadow-indigo-300 transition-all flex items-center gap-2 text-sm">
                        <i data-lucide="file-plus" class="w-4 h-4"></i> Generar Documento
                    </button>
                </div>`;
        } else {
            uiAccion = `
                <div class="flex justify-end w-full">
                    <span class="px-4 py-2 bg-slate-100 text-slate-400 rounded-lg flex items-center gap-2 text-xs border border-slate-200 font-medium">
                        <i data-lucide="lock" class="w-3.5 h-3.5"></i> Requiere rol: ${textoRoles}
                    </span>
                </div>`;
        }

        html += `
            <div class="relative pl-8 pb-4">
                ${indicador}
                <div class="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:border-slate-300 transition flex flex-col gap-3">
                    <div class="flex justify-between items-start">
                        <div>
                            <h4 class="font-bold text-base ${colorTitulo}">${doc.nombre}</h4>
                            <p class="text-xs text-slate-500 mt-0.5">${doc.desc}</p>
                        </div>
                        <span class="text-[10px] font-bold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md uppercase tracking-wider border border-slate-200">${textoRoles}</span>
                    </div>
                    <div class="pt-2 border-t border-slate-100">
                        ${uiAccion}
                    </div>
                </div>
            </div>
        `;
    });

    html += `</div>`;
    contenedor.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.abrirEditorFormulario = async function(tipoDoc) {
    const proceso = await window.API.procesos.obtener(PROCESO_ID);
    
    const mapaModales = {
        "especificaciones_tecnicas": { idVista: "vista-especificaciones", funcionName: "abrirEditorEspecificaciones" },
        "solicitud_cp": { idVista: "vista-solicitud-cp", funcionName: "abrirEditorSolicitudCP" },
        "cert_presupuestaria": { idVista: "vista-certificacion", funcionName: "abrirEditorCertificacion" },
        "solicitud_inicio": { idVista: "vista-solicitud-inicio", funcionName: "abrirEditorSolicitudInicio" },
        "autorizacion_inicio": { idVista: "vista-autorizacion", funcionName: "abrirEditorAutorizacion" },
        "informe_cotizacion": { idVista: "vista-informe-cotizacion", funcionName: "abrirEditorInformeCotizacion" },
        "notificacion_adjudicacion": { idVista: "vista-notificacion", funcionName: "abrirEditorNotificacion" },
        "orden_compra": { idVista: "vista-orden-compra", funcionName: "abrirEditorOrdenCompra" },
        "almacenes": { idVista: "vista-almacenes", funcionName: "abrirEditorAlmacenes" },
        "acta_recepcion": { idVista: "vista-acta-recepcion", funcionName: "abrirEditorActaRecepcion" },
        "informe_conformidad": { idVista: "vista-informe-conformidad", funcionName: "abrirEditorInformeConformidad" }
    };

    const config = mapaModales[tipoDoc];
    
    if (!config) {
        alert("El documento '" + tipoDoc + "' no está configurado en el sistema.");
        return;
    }

    const contenedor = document.getElementById("contenedor-modales");

    if (!document.getElementById(config.idVista)) {
        try {
            const res = await fetch(`componentes/modal_${tipoDoc}.html?v=${new Date().getTime()}`);
            if (!res.ok) throw new Error(`El archivo componentes/modal_${tipoDoc}.html no fue encontrado`);
            
            const htmlText = await res.text();
            contenedor.innerHTML += htmlText;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            
        } catch (e) {
            alert("Error cargando componentes del modal: " + e.message);
            return;
        }
    }

    const funcionTarget = window[config.funcionName];
    if (typeof funcionTarget === 'function') {
        funcionTarget(proceso);
    } else {
        alert(`Error: La función '${config.funcionName}' no está definida.`);
    }
};

window.togglePaso = function(index) {
    const body = document.getElementById(`body-paso-${index}`);
    const icon = document.getElementById(`icon-paso-${index}`);
    if (body) body.classList.toggle('hidden');
    if (icon) icon.classList.toggle('rotate-180');
};

function renderizarTablasDetalle(proceso) {
    const contenedor = document.getElementById("contenedor-tablas-detalle");
    const gastos = proceso.gastos || [];

    // Herencia de ítems (Almacenes > Orden de Compra > Autorización > BD) con DRY Normalizer
    let itemsBase = [];
    const docAlm = proceso.documentos?.find(d => d.clave_documento === "almacenes");
    const docOC = proceso.documentos?.find(d => d.clave_documento === "orden_compra");
    const docAuth = proceso.documentos?.find(d => d.clave_documento === "autorizacion_inicio");

    if (docAlm?.datos_formulario?.items_almacen?.length > 0) {
        itemsBase = docAlm.datos_formulario.items_almacen;
    } else if (docOC?.datos_formulario?.items_orden?.length > 0) {
        itemsBase = docOC.datos_formulario.items_orden;
    } else if (docAuth?.datos_formulario?.items_tecnicos?.length > 0) {
        itemsBase = docAuth.datos_formulario.items_tecnicos;
    } else {
        itemsBase = proceso.items || [];
    }

    const items = itemsBase.map(item => window.normalizarItem(item));

    // Agrupación de Gastos
    const grupos = {};
    gastos.forEach(g => {
        const p_proy = String(g.proy).padStart(3, '0');
        const p_act = String(g.act).padStart(3, '0');
        const llave = `${g.prog}-${p_proy}-${p_act}`;
        if (!grupos[llave]) grupos[llave] = { prog: g.prog, proy: p_proy, act: p_act, gastos: [] };
        grupos[llave].gastos.push(g);
    });

    let htmlGastos = `
        <div class="bg-white rounded-3xl shadow-lg border border-slate-200 overflow-hidden">
            <div class="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <div>
                    <h3 class="text-lg font-bold text-slate-800 flex items-center gap-2"><i data-lucide="wallet" class="text-indigo-600"></i> Afectación Presupuestaria</h3>
                    <p class="text-sm text-slate-500 mt-1">Estructura programática agrupada (Partidas de Gasto)</p>
                </div>
            </div>
            <div class="p-6 space-y-6">
    `;
    
    for (const llave in grupos) {
        htmlGastos += `
            <div class="border border-indigo-100 rounded-xl overflow-hidden shadow-sm">
                <div class="bg-indigo-50/50 px-6 py-3 border-b border-indigo-100 flex gap-8">
                    <div><span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Programa</span><span class="text-indigo-900 font-bold">${grupos[llave].prog}</span></div>
                    <div><span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Proyecto/Actividad</span><span class="text-indigo-900 font-bold">${grupos[llave].proy} ${grupos[llave].act}</span></div>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left text-sm whitespace-nowrap">
                        <thead class="bg-white text-slate-500 font-semibold border-b border-slate-200">
                            <tr>
                                <th class="px-6 py-3 w-32">Partida</th>
                                <th class="px-6 py-3">Descripción</th>
                                <th class="px-6 py-3 w-32 text-center bg-slate-50">FF-OF</th>
                                <th class="px-6 py-3 w-40 text-right">Monto (Bs.)</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
        `;
        grupos[llave].gastos.forEach(g => {
            htmlGastos += `
                            <tr class="hover:bg-slate-50">
                                <td class="px-6 py-3 font-bold text-slate-800">${g.partida}</td>
                                <td class="px-6 py-3 text-slate-600">${g.descripcion}</td>
                                <td class="px-6 py-3 text-center bg-slate-50/50"><span class="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-md font-bold text-xs">${g.ff || 'S/N'}-${g.of || 'S/N'}</span></td>
                                <td class="px-6 py-3 text-right font-bold text-emerald-600">${parseFloat(g.monto).toFixed(2)}</td>
                            </tr>
            `;
        });
        htmlGastos += `</tbody></table></div></div>`;
    }
    htmlGastos += `</div></div>`;

    // Tabla de Ítems
    let htmlItems = `
        <div class="bg-white rounded-3xl shadow-lg border border-slate-200 overflow-hidden mt-6">
            <div class="p-6 border-b border-slate-100 bg-slate-50">
                <h3 class="text-lg font-bold text-slate-800 flex items-center gap-2"><i data-lucide="package" class="text-indigo-600"></i> Bienes / Servicios Solicitados</h3>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-left text-sm">
                    <thead class="bg-white text-slate-500 font-semibold border-b border-slate-200">
                        <tr>
                            <th class="px-6 py-4 w-16 text-center">Nro.</th>
                            <th class="px-6 py-4">Descripción del Ítem</th>
                            <th class="px-6 py-4 text-center w-28">Unidad</th>
                            <th class="px-6 py-4 text-right w-24">Cant.</th>
                            <th class="px-6 py-4 text-right w-32">P. Unitario (Bs)</th>
                            <th class="px-6 py-4 text-right w-32">Total (Bs)</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
    `;

    items.forEach((i, idx) => {
        const nroDisp = i.nro || i.nro_item || (idx + 1);
        const objDisp = (i.objeto || i.objeto_corto || "").toUpperCase();
        const descDisp = i.descripcion || i.descripcion_larga || "";
        const uniDisp = i.tipuni || i.unidad || "UNIDAD";

        htmlItems += `
                        <tr class="hover:bg-slate-50 transition">
                            <td class="px-6 py-4 font-bold text-slate-500 align-top text-center pt-5">${nroDisp}</td>
                            <td class="px-6 py-4">
                                <div class="flex flex-col gap-1">
                                    <span class="font-black text-slate-800">${objDisp}</span>
                                    ${descDisp ? `<span class="text-xs text-slate-500 font-medium whitespace-pre-wrap">${descDisp}</span>` : ''}
                                </div>
                            </td>
                            <td class="px-6 py-4 text-center align-top pt-5"><span class="bg-indigo-50 text-indigo-700 px-2 py-1 rounded font-bold text-xs">${uniDisp}</span></td>
                            <td class="px-6 py-4 text-right text-slate-700 font-bold align-top pt-5">${parseFloat(i.cant).toFixed(2)}</td>
                            <td class="px-6 py-4 text-right text-slate-500 font-medium align-top pt-5">${parseFloat(i.precio_unitario).toFixed(2)}</td>
                            <td class="px-6 py-4 text-right font-black text-slate-800 align-top pt-5">${parseFloat(i.total_item).toFixed(2)}</td>
                        </tr>
        `;
    });

    htmlItems += `</tbody></table></div></div>`;
    contenedor.innerHTML = htmlGastos + htmlItems;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.abrirPDFInicial = async function() {
    try {
        await window.API.procesos.descargarSolicitudInicial(PROCESO_ID);
    } catch (error) {
        alert("No se pudo cargar el documento inicial: " + (error.message || "Archivo no encontrado."));
    }
};

window.imprimirFichaControl = async function() {
    try {
        const proceso = await window.API.procesos.obtener(PROCESO_ID);
        if (!proceso) return;

        const docAuth = proceso.documentos?.find(d => d.clave_documento === "autorizacion_inicio");
        const docSpecs = proceso.documentos?.find(d => d.clave_documento === "especificaciones_tecnicas");
        
        function formatearFechaLimpia(str) {
            if (!str || str === "SI") return "";
            let base = String(str);
            if (base.includes("T")) base = base.split("T")[0];
            if (base.includes(" ")) base = base.split(" ")[0];
            const partes = base.split("-");
            if (partes.length === 3 && partes[0].length === 4) {
                return `${partes[2]}/${partes[1]}/${partes[0]}`;
            }
            return base;
        }

        const codProy = docAuth?.datos_formulario?.codigo_proyecto || docSpecs?.datos_formulario?.codigo_proyecto || (proceso.proyecto ? proceso.proyecto.codigo_proyecto : "N/A");
        const codTramite = proceso.codigo_proceso || "PRO-2026";
        const unidadSol = proceso.unidad_solicitante || "ÁREA SOLICITANTE";
        const objeto = proceso.objeto_contratacion || "SIN ESPECIFICAR";
        const fechaCreacion = formatearFechaLimpia(proceso.fecha_solicitud || proceso.fecha_creacion || new Date().toISOString());

        const docsProcesoMap = {};
        (proceso.documentos || []).forEach(d => {
            if (d.estado === "FINALIZADO") {
                let fecha = d.datos_formulario?.fecha_documento ||
                            d.datos_formulario?.fecha ||
                            d.datos_formulario?.fecha_solicitud ||
                            d.datos_formulario?.fecha_certificacion ||
                            d.datos_formulario?.fecha_autorizacion ||
                            d.datos_formulario?.fecha_informe ||
                            d.datos_formulario?.fecha_notificacion ||
                            d.datos_formulario?.fecha_orden ||
                            d.datos_formulario?.fecha_almacen ||
                            d.datos_formulario?.fecha_entrega ||
                            d.fecha_creacion;

                docsProcesoMap[d.clave_documento] = formatearFechaLimpia(fecha);
            }
        });

        let qrText = `GAMCH - FICHA DE TRÁMITE\n`;
        qrText += `TRÁMITE: ${codTramite}\n`;
        qrText += `CÓDIGO: ${codProy}\n`;
        qrText += `UNIDAD: ${unidadSol}\n`;
        qrText += `OBJETO: ${objeto.substring(0, 60)}\n`;
        qrText += `--------------------\n`;

        let filasTabla = "";
        MAESTRO_DOCUMENTOS.forEach((doc, idx) => {
            const fechaEmit = docsProcesoMap[doc.id_tipo] || "";
            if (fechaEmit) {
                qrText += `${idx + 1}. ${doc.nombre}: ${fechaEmit}\n`;
            } else {
                qrText += `${idx + 1}. ${doc.nombre}: (Pendiente)\n`;
            }

            filasTabla += `
                <tr class="border-b border-slate-200">
                    <td class="px-1.5 py-1 text-center font-bold text-slate-700 w-6">${idx + 1}</td>
                    <td class="px-1.5 py-1 text-slate-800 font-semibold text-[9.5px] leading-tight">${doc.nombre}</td>
                    <td class="px-1.5 py-1 text-center font-mono text-[9px] font-bold ${fechaEmit ? 'text-indigo-900' : 'text-slate-300'}">${fechaEmit}</td>
                </tr>
            `;
        });

        let qrSvg = "";
        if (typeof generarQRCodeSVG === 'function') {
            qrSvg = generarQRCodeSVG(qrText, { size: 90, color: "#0f172a" });
        }

        const htmlFicha = `
            <div class="flex flex-col w-full space-y-2 select-none">
                <div>
                    <div class="flex justify-between items-start border-b-2 border-slate-800 pb-2 mb-2">
                        <div class="space-y-0.5">
                            <span class="text-[9px] font-black tracking-widest text-slate-500 uppercase block">GAMCH - ALCALDÍA DE CHARAÑA</span>
                            <h4 class="text-xs font-black text-slate-900 uppercase tracking-tight">FICHA DE CONTROL Y SEGUIMIENTO</h4>
                            <div class="flex items-center gap-2 pt-0.5">
                                <span class="bg-slate-900 text-white font-mono text-[9.5px] font-bold px-1.5 py-0.5 rounded-xs">${codTramite}</span>
                                <span class="bg-indigo-100 text-indigo-900 font-mono text-[9.5px] font-black px-1.5 py-0.5 rounded-xs border border-indigo-200">${codProy}</span>
                            </div>
                        </div>
                        <div class="shrink-0 ml-1 bg-white p-0.5 border border-slate-300 rounded-xs">
                            ${qrSvg}
                        </div>
                    </div>

                    <div class="bg-slate-50 p-2 rounded-xs border border-slate-200 mb-2 space-y-1 text-[9px]">
                        <div class="flex justify-between">
                            <span class="font-bold text-slate-600">UNIDAD: <strong class="text-slate-900 font-black">${unidadSol}</strong></span>
                            <span class="font-bold text-slate-500">FECHA: ${fechaCreacion}</span>
                        </div>
                        <div class="truncate">
                            <span class="font-bold text-slate-600">OBJETO: </span>
                            <span class="text-slate-800 font-medium">${objeto}</span>
                        </div>
                    </div>

                    <table class="w-full text-left border-collapse border border-slate-300">
                        <thead>
                            <tr class="bg-slate-800 text-white text-[9px] uppercase font-bold">
                                <th class="px-1.5 py-1 text-center w-6">N°</th>
                                <th class="px-1.5 py-1">DOCUMENTO DEL FLUJO</th>
                                <th class="px-1.5 py-1 text-center w-24">FECHA EMISIÓN</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filasTabla}
                        </tbody>
                    </table>
                </div>

                <div class="pt-2 border-t border-slate-300 flex justify-between items-center text-[8px] text-slate-400 font-medium">
                    <span>DOCUMENTO OFICIAL DE AUDITORÍA FÍSICA</span>
                    <span>1/4 HOJA CARTA</span>
                </div>
            </div>
        `;

        document.getElementById("ficha-print-container").innerHTML = htmlFicha;
        const modalEl = document.getElementById("modal-ficha-control");
        modalEl.classList.remove("hidden");
        const scrollBox = modalEl.querySelector(".overflow-auto");
        if (scrollBox) { scrollBox.scrollTop = 0; scrollBox.scrollLeft = 0; }
        if (typeof lucide !== 'undefined') lucide.createIcons();

    } catch (e) {
        alert("Error generando Ficha de Control: " + e.message);
    }
};

window.cerrarFichaControl = function() {
    document.getElementById("modal-ficha-control").classList.add("hidden");
};

window.ejecutarImpresionFicha = function() {
    window.print();
};