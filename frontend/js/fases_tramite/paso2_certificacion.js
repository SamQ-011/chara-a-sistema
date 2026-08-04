// archivo: js/fases_tramite/paso2_certificacion.js

async function abrirEditorCertificacion(proceso) { 
    const docPaso2 = proceso.documentos?.find(d => d.clave_documento === "solicitud_cp");
    const datosPaso2 = docPaso2?.datos_formulario || {};

    document.getElementById("cert-nombre").value = datosPaso2.nombre_solicitante || proceso.tecnico_solicitante || "";
    document.getElementById("cert-cargo").value = datosPaso2.cargo_solicitante || proceso.cargo_tecnico_solicitante || "";
    document.getElementById("cert-fecha").value = new Date().toISOString().split('T')[0];

    const contenedor = document.getElementById("cert-contenedor-tablas");
    
    // Loader elegante
    contenedor.innerHTML = `
        <div class="py-12 flex flex-col items-center justify-center">
            <div class="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
            <p class="text-slate-500 font-bold animate-pulse">Cruzando datos con el Catálogo POA...</p>
        </div>
    `;

    const vista = document.getElementById("vista-certificacion");
    vista.classList.remove("hidden");
    vista.classList.add("flex"); 

    // Hidratación del lado del cliente
    let catalogoPOA = [];
    try {
        catalogoPOA = await window.API.catalogos.obtenerPoa();
    } catch (e) {
        console.error("No se pudo conectar con el catálogo POA", e);
    }

    // Agrupar usando la variable inyectada "proceso"
    const grupos = {};
    proceso.gastos.forEach(g => {
        const p_proy = String(g.proy).padStart(3, '0');
        const p_act = String(g.act).padStart(3, '0');
        const llave_grupo = `${g.prog}-${p_proy}-${p_act}`;
        
        if (!grupos[llave_grupo]) {
            let nombre_prog = "Sin descripción";
            let nombre_proy = "Sin descripción";
            
            if (catalogoPOA.length > 0) {
                const progInfo = catalogoPOA.find(p => p.codigo === String(g.prog).padStart(3, '0'));
                if (progInfo) {
                    nombre_prog = progInfo.nombre;
                    const proyInfo = progInfo.proyectos.find(py => py.codigo_proy === p_proy && py.actividad === p_act);
                    if (proyInfo) {
                        nombre_proy = proyInfo.nombre;
                    }
                }
            }

            grupos[llave_grupo] = {
                prog: String(g.prog).padStart(3, '0'),
                proy: p_proy,
                act: p_act,
                nombre_prog: nombre_prog,
                nombre_proy: nombre_proy,
                gastos: []
            };
        }
        grupos[llave_grupo].gastos.push(g);
    });

    contenedor.innerHTML = ""; 
    
    for (const llave in grupos) {
        const grupo = grupos[llave];
        const divGrupo = document.createElement("div");
        divGrupo.className = "bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden";

        let htmlGrupo = `
            <div class="bg-indigo-50/50 px-8 py-5 border-b border-indigo-100 flex flex-col gap-3">
                <div class="flex items-start gap-4">
                    <span class="text-xs font-bold text-slate-500 w-48 tracking-wider pt-1">PROGRAMA:</span>
                    <div class="flex-1">
                        <span class="text-xl font-black text-indigo-900 mr-3">${grupo.prog}</span>
                        <span class="text-sm font-bold text-slate-700 uppercase tracking-wide">${grupo.nombre_prog}</span>
                    </div>
                </div>
                <div class="flex items-start gap-4">
                    <span class="text-xs font-bold text-slate-500 w-48 tracking-wider pt-1">PROYECTO/ACTIVIDAD:</span>
                    <div class="flex-1">
                        <span class="text-xl font-black text-indigo-900 mr-3">${grupo.proy} ${grupo.act}</span>
                        <span class="text-sm font-bold text-slate-700 uppercase tracking-wide">${grupo.nombre_proy}</span>
                    </div>
                </div>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-left text-sm whitespace-nowrap">
                    <thead class="bg-white text-slate-500 font-semibold border-b border-slate-200">
                        <tr>
                            <th class="px-6 py-4 w-40 text-xs uppercase tracking-wider">Apertura Prog.</th>
                            <th class="px-6 py-4 w-32 text-center text-xs uppercase tracking-wider bg-slate-50">Fuente (FF)</th>
                            <th class="px-6 py-4 w-32 text-center text-xs uppercase tracking-wider bg-slate-50">Organismo (OF)</th>
                            <th class="px-6 py-4 w-32 text-xs uppercase tracking-wider">Partida</th>
                            <th class="px-6 py-4 text-xs uppercase tracking-wider">Descripción</th>
                            <th class="px-6 py-4 w-40 text-right text-xs uppercase tracking-wider">Monto (Bs)</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
        `;

        grupo.gastos.forEach(g => {
            htmlGrupo += `
                <tr class="hover:bg-slate-50 transition-colors">
                    <td class="px-6 py-4 font-bold text-slate-600">${llave}</td>
                    <td class="px-6 py-4 bg-slate-50/50">
                        <input type="text" 
                            data-id="${g.id}" 
                            data-prog="${grupo.prog}" 
                            data-proy="${grupo.proy}" 
                            data-act="${grupo.act}" 
                            data-nomprog="${grupo.nombre_prog.replace(/"/g, '&quot;')}" 
                            data-nomproy="${grupo.nombre_proy.replace(/"/g, '&quot;')}" 
                            class="ff-input w-full p-2.5 text-center border rounded-lg border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 font-bold text-indigo-900 outline-none transition-all shadow-sm" value="${g.ff || ''}">
                    </td>
                    <td class="px-6 py-4 bg-slate-50/50">
                        <input type="text" data-id="${g.id}" class="of-input w-full p-2.5 text-center border rounded-lg border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 font-bold text-indigo-900 outline-none transition-all shadow-sm" value="${g.of || ''}">
                    </td>
                    <td class="px-6 py-4 font-black text-slate-800">${g.partida}</td>
                    <td class="px-6 py-4 text-slate-600 truncate max-w-[300px]" title="${g.descripcion}">${g.descripcion}</td>
                    <td class="px-6 py-4 text-right font-bold text-emerald-600">${parseFloat(g.monto).toFixed(2)}</td>
                </tr>
            `;
        });

        htmlGrupo += `</tbody></table></div>`;
        divGrupo.innerHTML = htmlGrupo;
        contenedor.appendChild(divGrupo);
    }
}

function cerrarEditorCertificacion() {
    const vista = document.getElementById("vista-certificacion");
    vista.classList.add("hidden");
    vista.classList.remove("flex");
}

async function guardarCertificacion(formato) {
    const urlParams = new URLSearchParams(window.location.search);
    const PROCESO_ID = urlParams.get('id');
    const btnWord = document.getElementById("btn-guardar-cert-word");
    const btnPdf = document.getElementById("btn-guardar-cert-pdf");

    try {
        // Manejo del spinner según el botón clickeado
        if (formato === 'word') {
            btnWord.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Procesando...`;
        } else {
            btnPdf.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Procesando...`;
        }
        btnWord.disabled = true;
        btnPdf.disabled = true;

        const gastosActualizados = [];
        // Seleccionamos todos los inputs dentro de nuestro nuevo contenedor
        const contenedor = document.getElementById("cert-contenedor-tablas");
        const inputsFF = contenedor.querySelectorAll(".ff-input");
        const inputsOF = contenedor.querySelectorAll(".of-input");
        
        inputsFF.forEach((ffInput, index) => {
            gastosActualizados.push({
                id: ffInput.dataset.id,
                ff: ffInput.value.trim(),
                of: inputsOF[index].value.trim(),
                prog: ffInput.dataset.prog,
                proy: ffInput.dataset.proy,
                act: ffInput.dataset.act,
                nombre_prog: ffInput.dataset.nomprog,
                nombre_proy: ffInput.dataset.nomproy
            });
        });

        const payload = {
            clave_documento: "cert_presupuestaria",
            estado: "FINALIZADO", 
            datos_formulario: {
                nombre_solicitante: document.getElementById("cert-nombre").value.trim(),
                cargo_solicitante: document.getElementById("cert-cargo").value.trim(),
                fecha_emision: document.getElementById("cert-fecha").value,
                encargado_presupuesto: localStorage.getItem("user_nombre") || "Responsable de Presupuesto", // Inyecta a la persona logueada
                gastos: gastosActualizados
            }
        };

        // 1. Guarda los datos en la base de datos
        await window.API.procesos.guardarDocumento(PROCESO_ID, payload);
        
        // 2. Cierra el modal y refresca el fondo
        cerrarEditorCertificacion();
        await cargarDatosProceso(); 
        
        // 3. Dispara la descarga/impresión usando el formato elegido
        await window.API.procesos.descargarDocumento(PROCESO_ID, "cert_presupuestaria", formato);

    } catch (error) {
        alert("Error: " + error.message);
    } finally {
        // Restaurar estado de los botones
        btnWord.innerHTML = `<i data-lucide="file-text" class="w-5 h-5"></i> Emitir Word`;
        btnPdf.innerHTML = `<i data-lucide="printer" class="w-5 h-5"></i> Imprimir PDF`;
        btnWord.disabled = false;
        btnPdf.disabled = false;
        if(typeof lucide !== 'undefined') lucide.createIcons();
    }
}