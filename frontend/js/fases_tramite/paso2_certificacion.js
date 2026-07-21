// archivo: js/fases_tramite/paso2_certificacion.js

function abrirEditorCertificacion() {
    document.getElementById("cert-nombre").value = procesoActual.tecnico_solicitante || "";
    document.getElementById("cert-cargo").value = procesoActual.cargo_tecnico_solicitante || "";
    document.getElementById("cert-fecha").value = new Date().toISOString().split('T')[0];

    const tbody = document.getElementById("cert-grilla-gastos");
    tbody.innerHTML = "";

    procesoActual.gastos.forEach(g => {
        const p_proy = String(g.proy).padStart(3, '0');
        const p_act = String(g.act).padStart(3, '0');

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td class="px-4 py-3 font-medium text-slate-700">${g.prog}-${p_proy}-${p_act}</td>
            <td class="px-4 py-3 font-bold text-slate-800">${g.partida}</td>
            <td class="px-4 py-3 text-slate-600 truncate max-w-[250px]" title="${g.descripcion}">${g.descripcion}</td>
            <td class="px-4 py-3 text-right font-semibold text-emerald-600">${parseFloat(g.monto).toFixed(2)}</td>
            <td class="px-4 py-3">
                <input type="text" data-id="${g.id}" class="ff-input w-full p-1.5 text-center border rounded border-slate-300 focus:border-indigo-500" value="${g.ff || ''}">
            </td>
            <td class="px-4 py-3">
                <input type="text" data-id="${g.id}" class="of-input w-full p-1.5 text-center border rounded border-slate-300 focus:border-indigo-500" value="${g.of || ''}">
            </td>
        `;
        tbody.appendChild(tr);
    });

    const vista = document.getElementById("vista-certificacion");
    vista.classList.remove("hidden");
    vista.classList.add("flex"); 
}

function cerrarEditorCertificacion() {
    const vista = document.getElementById("vista-certificacion");
    vista.classList.add("hidden");
    vista.classList.remove("flex");
}

async function guardarCertificacion(estado) {
    try {
        const btn = document.querySelector('button[onclick="guardarCertificacion(\'FINALIZADO\')"]');
        btn.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Procesando...`;
        btn.disabled = true;

        const gastosActualizados = [];
        const filas = document.getElementById("cert-grilla-gastos").querySelectorAll("tr");
        filas.forEach(fila => {
            const ffInput = fila.querySelector(".ff-input");
            const ofInput = fila.querySelector(".of-input");
            gastosActualizados.push({
                id: ffInput.dataset.id,
                ff: ffInput.value.trim(),
                of: ofInput.value.trim()
            });
        });

        const payload = {
            clave_documento: "cert_presupuestaria",
            estado: estado,
            datos_formulario: {
                nombre_solicitante: document.getElementById("cert-nombre").value.trim(),
                cargo_solicitante: document.getElementById("cert-cargo").value.trim(),
                fecha_emision: document.getElementById("cert-fecha").value,
                gastos: gastosActualizados
            }
        };

        await window.API.procesos.guardarDocumento(PROCESO_ID, payload);
        
        cerrarEditorCertificacion();
        await cargarDatosProceso(); 
        await window.API.procesos.descargarDocumento(PROCESO_ID, "cert_presupuestaria");

    } catch (error) {
        alert("Error: " + error.message);
    } finally {
        const btn = document.querySelector('button[onclick="guardarCertificacion(\'FINALIZADO\')"]');
        btn.innerHTML = `<i data-lucide="check-circle" class="w-5 h-5"></i> Emitir Certificación Final`;
        btn.disabled = false;
        if(typeof lucide !== 'undefined') lucide.createIcons();
    }
}