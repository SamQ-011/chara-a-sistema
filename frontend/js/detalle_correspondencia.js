// JS Controller para Detalle de Correspondencia (Expediente Dedicado)
let correspondenciaId = null;
let currentPdfUrl = null;
let currentNumHR = "";

document.addEventListener("DOMContentLoaded", async () => {
    verificarTokenYPagina();
    correspondenciaId = obtenerIdUrl();

    if (!correspondenciaId) {
        window.mostrarToast("No se ha especificado ID de correspondencia", "error");
        setTimeout(() => window.location.href = "correspondencia.html", 1500);
        return;
    }

    await cargarDetalleCorrespondencia();
});

function obtenerIdUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get("id");
}

async function cargarDetalleCorrespondencia() {
    try {
        const resp = await window.API.correspondencia.obtener(correspondenciaId);
        const data = resp.data;
        currentNumHR = data.numero_hr;

        // Ficha Técnica & Header FUSIONADOS
        document.getElementById("det-numero-hr").textContent = data.numero_hr;
        document.getElementById("det-subtitulo-fecha").textContent = `Recibido el ${data.fecha_recepcion} por ${data.usuario_recepcion}`;

        // Badge Estado General
        const badge = document.getElementById("det-badge-estado");
        if (data.estado_general === "EN_PROCESO") {
            badge.className = "px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30";
            badge.textContent = "🔵 EN PROCESO";
        } else if (data.estado_general === "RESPONDIDO" || data.estado_general === "ATENDIDO") {
            badge.className = "px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30";
            badge.textContent = "✅ RESPONDIDO / CONCLUIDO";
        } else if (data.estado_general === "PROMOVIDO_A_COMPRA") {
            badge.className = "px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-500/20 text-blue-300 border border-blue-500/30";
            badge.textContent = "🛒 PROMOVIDO A COMPRA";
        } else {
            badge.className = "px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30";
            badge.textContent = "EN BANDEJA";
        }

        // Datos del remitente y origen
        document.getElementById("det-tipo-doc").textContent = data.tipo_documento || "CARTA";
        document.getElementById("det-remitente").textContent = data.nombre_remitente;
        document.getElementById("det-cargo").textContent = data.cargo_remitente ? `${data.cargo_remitente} (${data.tipo_remitente})` : data.tipo_remitente;
        document.getElementById("det-telefono").textContent = data.telefono_remitente ? `📱 ${data.telefono_remitente}` : "Sin teléfono registrado";

        document.getElementById("det-cite").textContent = data.cite_origen || "Sin CITE Origen";
        document.getElementById("det-fecha-fojas").textContent = `${data.fecha_doc_origen || '—'} (${data.nro_fojas || 1} fojas)`;
        document.getElementById("det-asunto").textContent = data.asunto;

        document.getElementById("det-unidad-destino").textContent = `📍 ${data.unidad_actual}`;

        // Proveído inicial
        const derivaciones = data.derivaciones || [];
        const proveidoInicial = derivaciones.length > 0 ? derivaciones[0].instruccion_proveido : "Para su atención y trámite correspondiente";
        document.getElementById("det-proveido").textContent = `"${proveidoInicial}"`;

        // PDF Escaneado
        const token = localStorage.getItem("token") || localStorage.getItem("access_token") || "";
        currentPdfUrl = `/api/correspondencia/${data.id}/ver-pdf?token=${encodeURIComponent(token)}`;

        const boxPdfActivo = document.getElementById("box-pdf-activo");
        const boxPdfVacio = document.getElementById("box-pdf-vacio");

        if (data.tiene_pdf) {
            boxPdfActivo.classList.remove("hidden");
            boxPdfVacio.classList.add("hidden");
        } else {
            boxPdfActivo.classList.add("hidden");
            boxPdfVacio.classList.remove("hidden");
        }

        // Timeline Historial (Debajo de acciones)
        renderizarTimeline(data.movimientos || [], data.derivaciones || []);

        // Control de Visibilidad de Secciones de Acción
        gestionarSeccionesAccion(data);

        if (typeof lucide !== 'undefined') lucide.createIcons();

    } catch (e) {
        console.error("Error al cargar detalle de correspondencia:", e);
        window.mostrarToast(`Error al cargar expediente: ${e.message}`, "error");
    }
}

function abrirVisorPDFDoc() {
    if (!currentPdfUrl) {
        window.mostrarToast("No hay documento PDF disponible", "warning");
        return;
    }
    if (typeof window.abrirVisorPDF === "function") {
        window.abrirVisorPDF(currentPdfUrl, `Documento Escaneado - ${currentNumHR}`);
    } else {
        window.open(currentPdfUrl, "_blank");
    }
}

function renderizarTimeline(movimientos, derivaciones) {
    const contenedor = document.getElementById("contenedor-timeline");
    const counter = document.getElementById("det-count-movimientos");
    if (!contenedor) return;

    const totalCount = movimientos.length;
    if (counter) counter.textContent = `${totalCount} movimiento(s)`;

    if (totalCount === 0) {
        contenedor.innerHTML = `<p class="text-xs text-slate-400 italic text-center py-4">No se registran movimientos aún.</p>`;
        return;
    }

    let html = "";
    movimientos.forEach(m => {
        let badgeColor = "bg-slate-100 text-slate-700 border-slate-200";
        if (m.tipo === "RECEPCION") badgeColor = "bg-indigo-50 text-indigo-700 border-indigo-200";
        else if (m.tipo === "ACUSE") badgeColor = "bg-amber-50 text-amber-700 border-amber-200";
        else if (m.tipo === "NOTA") badgeColor = "bg-blue-50 text-blue-700 border-blue-200";
        else if (m.tipo === "RESPUESTA") badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200";
        else if (m.tipo === "PROMOCION") badgeColor = "bg-purple-50 text-purple-700 border-purple-200";

        html += `
        <div class="flex items-start gap-4 text-xs border-l-2 border-slate-200 pl-4 py-1 relative">
            <div class="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-white border border-slate-300 flex items-center justify-center">
                <div class="w-2 h-2 rounded-full bg-indigo-600"></div>
            </div>
            <div class="flex-1 bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-1">
                <div class="flex items-center justify-between">
                    <span class="font-bold text-slate-900">${escapeHtml(m.usuario_nombre)}</span>
                    <span class="text-[10px] text-slate-400 font-medium">${escapeHtml(m.fecha)}</span>
                </div>
                <p class="text-slate-700 leading-relaxed font-medium">${escapeHtml(m.descripcion)}</p>
            </div>
        </div>
        `;
    });

    contenedor.innerHTML = html;
}

function gestionarSeccionesAccion(data) {
    const secBandeja = document.getElementById("sec-acciones-bandeja");
    const secProceso = document.getElementById("sec-acciones-proceso");
    const secConcluido = document.getElementById("sec-resumen-concluido");
    const secPromovido = document.getElementById("sec-resumen-promovido");

    [secBandeja, secProceso, secConcluido, secPromovido].forEach(el => el && el.classList.add("hidden"));

    const estado = data.estado_general;

    if (estado === "EN_BANDEJA") {
        secBandeja.classList.remove("hidden");
    } else if (estado === "EN_PROCESO") {
        secProceso.classList.remove("hidden");
        if (data.acusado_por) {
            document.getElementById("info-acusado-por").textContent = `Recibido por: ${data.acusado_por}`;
            document.getElementById("info-fecha-acuse").textContent = `${data.fecha_acuse}`;
        }
    } else if (estado === "RESPONDIDO" || estado === "ATENDIDO") {
        secConcluido.classList.remove("hidden");
        document.getElementById("text-resumen-dictamen").textContent = data.resumen_respuesta || "Trámite concluido.";
        document.getElementById("text-cite-respuesta-guardada").textContent = data.cite_respuesta ? `CITE Respuesta: ${data.cite_respuesta}` : "";
        document.getElementById("text-fecha-atencion-guardada").textContent = data.fecha_atencion ? `Atendido el ${data.fecha_atencion}` : "";
    } else if (estado === "PROMOVIDO_A_COMPRA") {
        secPromovido.classList.remove("hidden");
        if (data.proceso_id) {
            document.getElementById("link-ir-proceso").href = `detalle_proceso.html?id=${data.proceso_id}`;
        }
    }
}

async function ejecutarAcuseRecibo() {
    const btn = document.getElementById("btn-acusar-recibo");
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Confirmando...`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    try {
        const resp = await window.API.correspondencia.acusarRecibo(correspondenciaId);
        if (resp.success) {
            window.mostrarToast("Acuse de recibo confirmado correctamente", "success");
            await cargarDetalleCorrespondencia();
        }
    } catch (e) {
        window.mostrarToast(`Error al acusar recibo: ${e.message}`, "error");
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i data-lucide="check-square" class="w-4 h-4"></i> Acusar Recibo Digital`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }
}

async function ejecutarAgregarNota() {
    const input = document.getElementById("input-nota-avance");
    const texto = input ? input.value.trim() : "";

    if (!texto) {
        window.mostrarToast("Por favor ingrese el contenido de la nota de avance", "error");
        return;
    }

    const btn = document.getElementById("btn-guardar-nota");
    if (btn) btn.disabled = true;

    try {
        const resp = await window.API.correspondencia.agregarNota(correspondenciaId, { descripcion: texto });
        if (resp.success) {
            window.mostrarToast("Nota agregada al historial", "success");
            input.value = "";
            await cargarDetalleCorrespondencia();
        }
    } catch (e) {
        window.mostrarToast(`Error al guardar nota: ${e.message}`, "error");
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function ejecutarResponderCorrespondencia() {
    const resumen = document.getElementById("input-resumen-respuesta")?.value.trim();
    if (!resumen) {
        window.mostrarToast("Por favor escriba el resumen de la respuesta", "error");
        return;
    }

    const cite = document.getElementById("input-cite-respuesta")?.value.trim() || null;
    const btn = document.getElementById("btn-responder");
    if (btn) btn.disabled = true;

    try {
        const resp = await window.API.correspondencia.atender(correspondenciaId, {
            cite_respuesta: cite,
            resumen_respuesta: resumen
        });
        if (resp.success) {
            window.mostrarToast("Correspondencia dada por concluida correctamente", "success");
            await cargarDetalleCorrespondencia();
        }
    } catch (e) {
        window.mostrarToast(`Error al responder correspondencia: ${e.message}`, "error");
        if (btn) btn.disabled = false;
    }
}

async function ejecutarPromocionACompra() {
    if (!confirm("¿Desea convertir esta Hoja de Ruta en un Proceso de Contratación? Se heredará la información y se creará el trámite de compras en el Paso 1.")) {
        return;
    }

    const btn = document.getElementById("btn-promover");
    if (btn) btn.disabled = true;

    try {
        const resp = await window.API.correspondencia.promover(correspondenciaId);
        if (resp.success) {
            window.mostrarToast(resp.message, "success");
            const procesoId = resp.data.proceso_id;
            window.location.href = `detalle_proceso.html?id=${procesoId}`;
        }
    } catch (e) {
        window.mostrarToast(`Error al promover a compra: ${e.message}`, "error");
        if (btn) btn.disabled = false;
    }
}
