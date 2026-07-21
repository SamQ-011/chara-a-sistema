// archivo: js/detalle_proceso.js
const urlParams = new URLSearchParams(window.location.search);
const PROCESO_ID = urlParams.get('id');

let procesoActual = null;

if (!PROCESO_ID) {
    window.location.href = "index.html";
}

document.addEventListener("DOMContentLoaded", async () => {
    const nombreActual = localStorage.getItem("user_nombre");
    const cargoActual = localStorage.getItem("user_cargo");
    
    document.getElementById("ui-user-name").textContent = nombreActual || "Usuario";
    document.getElementById("ui-user-rol").textContent = cargoActual || "Funcionario";

    await cargarDatosProceso();
});

const MAESTRO_DOCUMENTOS = [
    { id_tipo: "solicitud_cp", nombre: "Solicitud de Certificación Presupuestaria", owner: ["SOLICITANTE"], desc: "Documento inicial con cuadro de requerimientos." },
    { id_tipo: "cert_presupuestaria", nombre: "Certificación Presupuestaria", owner: ["PRESUPUESTO"], desc: "Asignación formal de la partida presupuestaria." },
    { id_tipo: "solicitud_inicio", nombre: "Solicitud de Inicio de Proceso", owner: ["SOLICITANTE"], desc: "Solicitud formal junto a las especificaciones técnicas." },
    { id_tipo: "autorizacion_inicio", nombre: "Autorización de Inicio", owner: ["RPC"], desc: "Resolución oficial para iniciar la contratación." },
    { id_tipo: "informe_cotizacion", nombre: "Informe de Cotización", owner: ["ADMIN"], desc: "Evaluación de proformas y selección de proveedor ganador." },
    { id_tipo: "notificacion_adjudicacion", nombre: "Notificación de Adjudicación", owner: ["RPC"], desc: "Aviso formal al proveedor ganador." },
    { id_tipo: "orden_compra", nombre: "Orden de Compra / Servicio", owner: ["RPC"], desc: "Documento oficial de solicitud de provisión." },
    { id_tipo: "almacenes", nombre: "Ingreso y Salida de Almacenes", owner: ["ADMIN", "RPC"], desc: "Registro de recepción y despacho logístico." },
    { id_tipo: "acta_recepcion", nombre: "Acta de Entrega", owner: ["SOLICITANTE"], desc: "Entrega oficial del área solicitante al beneficiario." },
    { id_tipo: "informe_conformidad", nombre: "Informe de Confomidad", owner: ["SOLICITANTE"], desc: "Conformidad final del área solicitante." }

];

async function cargarDatosProceso() {
    try {
        const proceso = await window.API.procesos.obtener(PROCESO_ID);
        procesoActual = proceso;
        const rolActual = localStorage.getItem("user_rol");
        
        document.getElementById("txt-codigo-proceso").textContent = proceso.codigo_proceso;
        document.getElementById("badge-estado").textContent = proceso.estado;
        document.getElementById("lbl-objeto").textContent = proceso.objeto_contratacion || "No definido";
        document.getElementById("lbl-monto").textContent = `Bs. ${parseFloat(proceso.monto_total).toFixed(2)}`;
        document.getElementById("lbl-plazo").textContent = `${proceso.plazo_entrega} días`;
        document.getElementById("lbl-area").textContent = proceso.distrito_comunidad || "S/N";
        
        renderizarControlesEdicion(rolActual);
        renderizarDocumentos(rolActual);
        renderizarTablasDetalle(proceso.items || [], proceso.gastos || []);

    } catch (error) {
        alert("Error cargando el proceso: " + error.message);
        window.location.href = "index.html";
    }
}

function renderizarControlesEdicion(rolActual) {
    const contenedorBotones = document.getElementById("contenedor-acciones-principales");
    if (!contenedorBotones) return;

    if (["SOLICITANTE", "ADMIN"].includes(rolActual)) {
        contenedorBotones.innerHTML = `
            <button onclick="redirigirEdicionGlobal()" class="w-full mt-4 bg-amber-500 text-white font-semibold px-4 py-2 rounded-xl hover:bg-amber-600 transition shadow-sm flex items-center justify-center gap-2">
                <i data-lucide="edit" class="w-4 h-4"></i> Editar Trámite Completo
            </button>
        `;
        lucide.createIcons();
    }
}

function redirigirEdicionGlobal() {
    window.location.href = `nuevo_proceso.html?edit=true&id=${PROCESO_ID}`;
}

function renderizarDocumentos(rolActual) {
    const contenedor = document.getElementById("contenedor-documentos");
    let html = `<div class="relative border-l-2 border-slate-200 ml-4 space-y-4">`;

    MAESTRO_DOCUMENTOS.forEach((doc, index) => {
        const tienePermiso = doc.owner.includes(rolActual);
        const textoRoles = doc.owner.join(' / ');
        const colorCirculo = tienePermiso ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200" : "bg-slate-100 text-slate-400 border-slate-200";
        const colorTitulo = tienePermiso ? "text-slate-800" : "text-slate-500";
        
        let uiAccion = "";
        if (tienePermiso) {
            const btnDescargaClick = doc.id_tipo === "almacenes" 
                ? `window.API.procesos.descargarDocumento(PROCESO_ID, 'ingreso_almacenes'); setTimeout(() => window.API.procesos.descargarDocumento(PROCESO_ID, 'salida_almacenes'), 1500);`
                : `window.API.procesos.descargarDocumento(PROCESO_ID, '${doc.id_tipo}')`;

            uiAccion = `
                <button onclick="generarDocumento('${doc.id_tipo}')" class="px-5 py-2 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition shadow-md flex items-center gap-2 text-sm z-20 relative">
                    <i data-lucide="edit-3" class="w-4 h-4"></i> Redactar
                </button>
                <button onclick="${btnDescargaClick}" class="px-3 py-2 bg-slate-100 text-slate-600 font-semibold rounded-xl hover:bg-slate-200 transition flex items-center gap-2 text-sm z-20 relative ml-2" title="Descargar última versión">
                    <i data-lucide="download" class="w-4 h-4"></i>
                </button>`;
        } else {
            uiAccion = `
                <span class="px-4 py-2 bg-slate-100 text-slate-500 rounded-lg flex items-center gap-2 text-sm border border-slate-200">
                    <i data-lucide="lock" class="w-4 h-4"></i> Requiere: ${textoRoles}
                </span>`;
        }

        html += `
            <div class="relative pl-8 group">
                <span class="absolute -left-[17px] top-3 flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold border-2 ${colorCirculo} transition-colors bg-white z-10">
                    ${index + 1}
                </span>
                
                <div class="rounded-2xl border border-slate-200 bg-white overflow-hidden transition-all ${tienePermiso ? 'hover:border-indigo-300 shadow-sm' : 'opacity-80'}">
                    <button onclick="togglePaso(${index})" class="w-full text-left p-4 flex items-center justify-between bg-white hover:bg-slate-50 transition-colors pointer-events-auto">
                        <div>
                            <h4 class="font-bold ${colorTitulo} text-base">${doc.nombre}</h4>
                            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">RESP: ${textoRoles}</p>
                        </div>
                        <div class="p-2 bg-slate-50 rounded-lg">
                            <i data-lucide="chevron-down" id="icon-paso-${index}" class="w-5 h-5 text-slate-400 transition-transform duration-300"></i>
                        </div>
                    </button>

                    <div id="body-paso-${index}" class="hidden px-5 pb-5 pt-2 border-t border-slate-100 bg-slate-50/50">
                        <p class="text-sm text-slate-600 mb-4">${doc.desc}</p>
                        <div class="flex justify-end">
                            ${uiAccion}
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    html += `</div>`;
    contenedor.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.togglePaso = function(index) {
    const body = document.getElementById(`body-paso-${index}`);
    const icon = document.getElementById(`icon-paso-${index}`);
    
    if (body.classList.contains('hidden')) {
        body.classList.remove('hidden');
        body.classList.add('block');
        icon.classList.add('rotate-180');
    } else {
        body.classList.remove('block');
        body.classList.add('hidden');
        icon.classList.remove('rotate-180');
    }
};

function generarDocumento(tipoDoc) {
    if (tipoDoc === "cert_presupuestaria") {
        abrirEditorCertificacion();
    } else if (tipoDoc === "solicitud_inicio") {
        abrirEditorSolicitudInicio();
    } else if (tipoDoc === "autorizacion_inicio") {
        abrirEditorAutorizacion();
    } else if (tipoDoc === "informe_cotizacion") {
        abrirEditorInformeCotizacion();
    } else if (tipoDoc === "notificacion_adjudicacion") {
        abrirEditorNotificacion();
    } else if (tipoDoc === "orden_compra") {
        abrirEditorOrdenCompra();
    } else if (tipoDoc === "almacenes") {
        abrirEditorAlmacenes();
    } else if (tipoDoc === "acta_recepcion") { 
        abrirEditorActaRecepcion(); 
    } else if (tipoDoc === "informe_conformidad") { 
        abrirEditorInformeConformidad(); 
    } else {
        alert(`La interfaz para ${tipoDoc} está en construcción.`);
    }
}

function renderizarTablasDetalle(items, gastos) {
    const contenedor = document.getElementById("contenedor-tablas-detalle");
    contenedor.innerHTML = ""; 

    let htmlGastos = `
        <div class="bg-white rounded-3xl shadow-lg border border-slate-200 overflow-hidden">
            <div class="p-6 border-b border-slate-100 bg-slate-50">
                <h3 class="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <i data-lucide="wallet" class="text-indigo-600"></i> Afectación Presupuestaria
                </h3>
                <p class="text-sm text-slate-500 mt-1">Estructura programática y financiera asignada al trámite</p>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-left text-sm">
                    <thead class="bg-slate-50 text-slate-500 font-semibold border-b">
                        <tr>
                            <th class="px-6 py-4">Partida</th>
                            <th class="px-6 py-4">Prog.</th>
                            <th class="px-6 py-4">Proy.</th>
                            <th class="px-6 py-4">Act.</th>
                            <th class="px-6 py-4">FF-OF</th>
                            <th class="px-6 py-4">Descripción de la Partida</th>
                            <th class="px-6 py-4 text-right">Monto Asignado (Bs.)</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
    `;
    
    gastos.forEach(g => {
        htmlGastos += `
                        <tr class="hover:bg-slate-50 transition">
                            <td class="px-6 py-4 font-bold text-slate-800">${g.partida}</td>
                            <td class="px-6 py-4 text-slate-600">${g.prog}</td>
                            <td class="px-6 py-4 text-slate-600">${g.proy}</td>
                            <td class="px-6 py-4 text-slate-600">${g.act}</td>
                            <td class="px-6 py-4 text-slate-600 font-medium">${g.ff}-${g.of}</td>
                            <td class="px-6 py-4 text-slate-600">${g.descripcion}</td>
                            <td class="px-6 py-4 text-right font-semibold text-emerald-600">${parseFloat(g.monto).toFixed(2)}</td>
                        </tr>
        `;
    });

    htmlGastos += `
                    </tbody>
                </table>
            </div>
        </div>
    `;

    let htmlItems = `
        <div class="bg-white rounded-3xl shadow-lg border border-slate-200 overflow-hidden mt-6">
            <div class="p-6 border-b border-slate-100 bg-slate-50">
                <h3 class="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <i data-lucide="package" class="text-indigo-600"></i> Bienes / Servicios Solicitados
                </h3>
                <p class="text-sm text-slate-500 mt-1">Detalle logístico exacto para compras y almacenes</p>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-left text-sm">
                    <thead class="bg-slate-50 text-slate-500 font-semibold border-b">
                        <tr>
                            <th class="px-6 py-4 w-16">Nro.</th>
                            <th class="px-6 py-4">Descripción del Ítem</th>
                            <th class="px-6 py-4">Unidad</th>
                            <th class="px-6 py-4 text-right">Cantidad</th>
                            <th class="px-6 py-4 text-right">Precio Unitario</th>
                            <th class="px-6 py-4 text-right">Total (Bs.)</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
    `;

    items.forEach(i => {
        htmlItems += `
                        <tr class="hover:bg-slate-50 transition">
                            <td class="px-6 py-4 font-medium text-slate-500">${i.nro_item}</td>
                            <td class="px-6 py-4">
                                <span class="font-bold text-slate-800 block mb-1">${i.objeto_corto}</span>
                                ${i.descripcion_larga ? `<span class="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded line-clamp-2">${i.descripcion_larga}</span>` : ''}
                            </td>
                            <td class="px-6 py-4 text-slate-600">
                                <span class="bg-indigo-50 text-indigo-700 px-2 py-1 rounded font-medium text-xs">${i.unidad}</span>
                            </td>
                            <td class="px-6 py-4 text-right text-slate-700 font-medium">${parseFloat(i.cantidad).toFixed(2)}</td>
                            <td class="px-6 py-4 text-right text-slate-600">${parseFloat(i.precio_unitario).toFixed(2)}</td>
                            <td class="px-6 py-4 text-right font-bold text-slate-800">${parseFloat(i.total_item).toFixed(2)}</td>
                        </tr>
        `;
    });

    htmlItems += `
                    </tbody>
                </table>
            </div>
        </div>
    `;

    contenedor.innerHTML = htmlGastos + htmlItems;
    lucide.createIcons();
}