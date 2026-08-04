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
    { id_tipo: "informe_cotizacion", nombre: "Informe de Cotización", owner: ["ADMIN"], desc: "Evaluación de proformas y selección de proveedor." },
    { id_tipo: "notificacion_adjudicacion", nombre: "Notificación de Adjudicación", owner: ["RPC"], desc: "Aviso formal al proveedor ganador." },
    { id_tipo: "orden_compra", nombre: "Orden de Compra / Servicio", owner: ["RPC"], desc: "Documento oficial de solicitud de provisión." },
    { id_tipo: "almacenes", nombre: "Ingreso y Salida de Almacenes", owner: ["ADMIN", "RPC"], desc: "Registro de recepción y despacho logístico." },
    { id_tipo: "acta_recepcion", nombre: "Acta de Entrega", owner: ["SOLICITANTE"], desc: "Entrega oficial del área solicitante al beneficiario." },
    { id_tipo: "informe_conformidad", nombre: "Informe de Confomidad", owner: ["SOLICITANTE"], desc: "Conformidad final del área solicitante." }
];

async function cargarDatosProceso() {
    try {
        const proceso = await window.API.procesos.obtener(PROCESO_ID);
        const rolActual = localStorage.getItem("user_rol");
        
        document.getElementById("txt-codigo-proceso").textContent = proceso.codigo_proceso;
        document.getElementById("badge-estado").textContent = proceso.estado;
        document.getElementById("lbl-objeto").textContent = proceso.objeto_contratacion || "No definido";
        document.getElementById("lbl-monto").textContent = `Bs. ${parseFloat(proceso.monto_total).toFixed(2)}`;
        
        // UX: Arreglando el plazo "0 días"
        const plazoStr = parseInt(proceso.plazo_entrega) === 0 ? "Inmediato" : `${proceso.plazo_entrega} días`;
        document.getElementById("lbl-plazo").textContent = plazoStr;
        document.getElementById("lbl-area").textContent = proceso.distrito_comunidad || "S/N";
        
        // Todo ahora recibe "proceso" por parámetro (Inyección de dependencias)
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

    // Regla de Negocio: El botón de edición solo sale si no hay otros documentos generados
    const tieneDocumentosAvanzados = proceso.documentos && proceso.documentos.some(d => d.clave_documento !== 'solicitud_cp');

    if (["SOLICITANTE", "ADMIN"].includes(rolActual) && !tieneDocumentosAvanzados) {
        contenedorBotones.innerHTML = `
            <button onclick="redirigirEdicionGlobal()" class="text-sm text-indigo-600 bg-indigo-50 hover:bg-indigo-100 font-bold px-3 py-1.5 rounded-lg transition-colors border border-indigo-100 flex items-center gap-1.5 opacity-0 group-hover:opacity-100">
                <i data-lucide="edit-2" class="w-3.5 h-3.5"></i> Corregir Trámite
            </button>
        `;
        lucide.createIcons();
    }
}

function redirigirEdicionGlobal() {
    window.location.href = `nuevo_proceso.html?edit=true&id=${PROCESO_ID}`;
}

function renderizarDocumentos(rolActual, proceso) {
    const contenedor = document.getElementById("contenedor-documentos");
    let html = `<div class="relative border-l-2 border-slate-200 ml-4 space-y-4">`;

    // Lista de documentos que ya están finalizados en el backend
    const docsFinalizados = (proceso.documentos || []).filter(d => d.estado === "FINALIZADO" || d.estado === "FINALIZADO").map(d => d.clave_documento);

    MAESTRO_DOCUMENTOS.forEach((doc, index) => {
        const tienePermiso = doc.owner.includes(rolActual);
        const estaListo = docsFinalizados.includes(doc.id_tipo);
        const textoRoles = doc.owner.join(' / ');
        
        // UX Checklist: Verde si está listo, gris/azul si falta
        const indicador = estaListo 
            ? `<i data-lucide="check-circle-2" class="w-7 h-7 text-emerald-500 bg-white rounded-full absolute -left-[15px] top-3 z-10 shadow-sm"></i>`
            : `<span class="absolute -left-[17px] top-3 flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold border-2 bg-white z-10 ${tienePermiso ? 'text-indigo-600 border-indigo-600 shadow-md shadow-indigo-200' : 'text-slate-400 border-slate-200'}">${index + 1}</span>`;
            
        const colorTitulo = tienePermiso ? "text-slate-800" : "text-slate-500";
        
        let uiAccion = "";
        if (tienePermiso) {
            const btnWord = `window.API.procesos.descargarDocumento(PROCESO_ID, '${doc.id_tipo}', 'word')`;
            const btnPDF = `window.API.procesos.descargarDocumento(PROCESO_ID, '${doc.id_tipo}', 'pdf')`;

            // Botón inteligente
            const textoBoton = estaListo ? "Modificar y Re-imprimir" : "Generar Documento";
            const iconoBoton = estaListo ? "refresh-cw" : "edit-3";

            uiAccion = `
                <div class="flex items-center gap-2 w-full">
                    <!-- PASAMOS EL OBJETO PROCESO COMO TEXTO JSON PARA EL ONCLICK -->
                    <button onclick='generarDocumento("${doc.id_tipo}", ${JSON.stringify(proceso)})' class="px-5 py-2 ${estaListo ? 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50' : 'bg-indigo-600 text-white hover:bg-indigo-700'} font-semibold rounded-xl transition shadow-sm flex items-center gap-2 text-sm z-20 relative mr-auto">
                        <i data-lucide="${iconoBoton}" class="w-4 h-4"></i> ${textoBoton}
                    </button>
                    
                    <div class="flex items-center bg-slate-100 rounded-xl p-1 shadow-inner border border-slate-200 ${!estaListo ? 'opacity-50 pointer-events-none' : ''}">
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
                    <span class="px-4 py-2 bg-slate-100 text-slate-500 rounded-lg flex items-center gap-2 text-sm border border-slate-200">
                        <i data-lucide="lock" class="w-4 h-4"></i> Requiere: ${textoRoles}
                    </span>
                </div>`;
        }

        html += `
            <div class="relative pl-8 group">
                ${indicador}
                <div class="rounded-2xl border ${estaListo ? 'border-emerald-200 bg-emerald-50/10' : 'border-slate-200 bg-white'} overflow-hidden transition-all ${tienePermiso ? 'hover:border-indigo-300 shadow-sm' : 'opacity-80'}">
                    <button onclick="togglePaso(${index})" class="w-full text-left p-4 flex items-center justify-between hover:bg-slate-50 transition-colors pointer-events-auto">
                        <div>
                            <h4 class="font-bold ${colorTitulo} text-base flex items-center gap-2">${doc.nombre} ${estaListo ? '<span class="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] rounded-md font-bold">COMPLETADO</span>' : ''}</h4>
                            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">RESP: ${textoRoles}</p>
                        </div>
                        <div class="p-2 bg-slate-50 rounded-lg">
                            <i data-lucide="chevron-down" id="icon-paso-${index}" class="w-5 h-5 text-slate-400 transition-transform duration-300"></i>
                        </div>
                    </button>
                    <div id="body-paso-${index}" class="hidden px-5 pb-5 pt-2 border-t border-slate-100 bg-slate-50/50">
                        <p class="text-sm text-slate-600 mb-4">${doc.desc}</p>
                        <div class="flex">${uiAccion}</div>
                    </div>
                </div>
            </div>
        `;
    });

    html += `</div>`;
    contenedor.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// COMPONENTIZACIÓN: Cargar Modal Dinámico
window.generarDocumento = async function(tipoDoc, proceso) {
    // Se guardan los nombres de función como texto para evitar el ReferenceError
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

    // 1. Cargar el HTML del Modal SOLAMENTE si no existe en el DOM
    if (!document.getElementById(config.idVista)) {
        try {
            const res = await fetch(`componentes/modal_${tipoDoc}.html?v=${new Date().getTime()}`);
            
            if (!res.ok) throw new Error(`El archivo componentes/modal_${tipoDoc}.html no fue encontrado (Error 404)`);
            
            const htmlText = await res.text();
            contenedor.innerHTML += htmlText;
            
            if (typeof lucide !== 'undefined') lucide.createIcons();
            
        } catch (e) {
            alert("⚠️ Error de Arquitectura:\n" + e.message + "\n\nAsegúrate de que la carpeta 'componentes' esté junto a 'detalle_proceso.html'.");
            return;
        }
    }

    // 2. Buscar y ejecutar la función de forma segura en la ventana global
    const funcionTarget = window[config.funcionName];

    if (typeof funcionTarget === 'function') {
        funcionTarget(proceso);
    } else {
        alert(`Error: La función '${config.funcionName}' no está definida en los scripts cargados.`);
    }
};

window.togglePaso = function(index) {
    const body = document.getElementById(`body-paso-${index}`);
    const icon = document.getElementById(`icon-paso-${index}`);
    body.classList.toggle('hidden');
    icon.classList.toggle('rotate-180');
};

function renderizarTablasDetalle(proceso) {
    const contenedor = document.getElementById("contenedor-tablas-detalle");
    const items = proceso.items || [];
    const gastos = proceso.gastos || [];

    // Agrupación de Gastos (Igual que en el Word y en el Modal)
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
                    <p class="text-sm text-slate-500 mt-1">Estructura programática agrupada</p>
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

    // Tabla de Ítems Rediseñada (Tipografía Escaneable)
    let htmlItems = `
        <div class="bg-white rounded-3xl shadow-lg border border-slate-200 overflow-hidden mt-6">
            <div class="p-6 border-b border-slate-100 bg-slate-50">
                <h3 class="text-lg font-bold text-slate-800 flex items-center gap-2"><i data-lucide="package" class="text-indigo-600"></i> Bienes / Servicios Solicitados</h3>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-left text-sm">
                    <thead class="bg-white text-slate-500 font-semibold border-b border-slate-200">
                        <tr>
                            <th class="px-6 py-4 w-16">Nro.</th>
                            <th class="px-6 py-4">Descripción del Ítem</th>
                            <th class="px-6 py-4 text-center w-24">Unidad</th>
                            <th class="px-6 py-4 text-right w-24">Cant.</th>
                            <th class="px-6 py-4 text-right w-32">P. Unitario</th>
                            <th class="px-6 py-4 text-right w-32">Total (Bs.)</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
    `;

    items.forEach(i => {
        htmlItems += `
                        <tr class="hover:bg-slate-50 transition">
                            <td class="px-6 py-4 font-bold text-slate-400 align-top pt-5">${i.nro_item}</td>
                            <td class="px-6 py-4">
                                <div class="flex flex-col gap-1">
                                    <span class="font-black text-slate-800">${i.objeto_corto.toUpperCase()}</span>
                                    ${i.descripcion_larga ? `<span class="text-xs text-slate-500 font-medium whitespace-pre-wrap">${i.descripcion_larga}</span>` : ''}
                                </div>
                            </td>
                            <td class="px-6 py-4 text-center align-top pt-5"><span class="bg-indigo-50 text-indigo-700 px-2 py-1 rounded font-bold text-xs">${i.unidad}</span></td>
                            <td class="px-6 py-4 text-right text-slate-700 font-bold align-top pt-5">${parseFloat(i.cantidad).toFixed(2)}</td>
                            <td class="px-6 py-4 text-right text-slate-500 font-medium align-top pt-5">${parseFloat(i.precio_unitario).toFixed(2)}</td>
                            <td class="px-6 py-4 text-right font-black text-slate-800 align-top pt-5">${parseFloat(i.total_item).toFixed(2)}</td>
                        </tr>
        `;
    });

    htmlItems += `</tbody></table></div></div>`;
    contenedor.innerHTML = htmlGastos + htmlItems;
    lucide.createIcons();
}

window.abrirPDFInicial = async function() {
    try {
        // El event.target no es necesario porque el botón siempre estará visible, 
        // pero puedes agregar un toast o un loader aquí a futuro si quieres.
        await window.API.procesos.verSolicitudInicial(PROCESO_ID);
    } catch (error) {
        alert("No se pudo cargar el documento inicial: " + (error.message || "Archivo no encontrado."));
    }
};