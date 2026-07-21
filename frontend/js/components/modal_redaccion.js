// ======================================================
// Componente: Modal de Redacción Documental
// ======================================================

const ModalRedaccion = {
    documentoActivo: null,
    procesoIdActivo: null,
    esquemaActivo: null,

    init: function() {
        if (!document.getElementById('contenedor-modal-redaccion')) {
            const div = document.createElement('div');
            div.id = 'contenedor-modal-redaccion';
            div.innerHTML = this.template();
            document.body.appendChild(div);
        }
    },

    template: function() {
        return `
        <div id="modal-redaccion" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 hidden flex items-center justify-center p-4">
            <div class="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden transition-all transform scale-95 opacity-0" id="modal-content">
                
                <div class="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div>
                        <h3 id="modal-titulo" class="text-xl font-bold text-slate-800">Redactar Documento</h3>
                        <p class="text-sm text-slate-500 mt-1">Complete los datos requeridos para la plantilla</p>
                    </div>
                    <button onclick="ModalRedaccion.cerrar()" class="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                        <i data-lucide="x" class="w-6 h-6"></i>
                    </button>
                </div>
                
                <div class="p-8 overflow-y-auto flex-1">
                    <form id="form-documento" class="space-y-5">
                        </form>
                </div>
                
                <div class="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button type="button" onclick="ModalRedaccion.cerrar()" class="px-5 py-2.5 rounded-xl font-semibold text-slate-600 hover:bg-slate-200 transition">Cancelar</button>
                    <button type="button" onclick="ModalRedaccion.guardar('BORRADOR')" class="px-5 py-2.5 rounded-xl font-semibold bg-amber-100 text-amber-700 hover:bg-amber-200 transition flex items-center gap-2">
                        <i data-lucide="save" class="w-4 h-4"></i> Guardar Progreso
                    </button>
                    <button type="button" onclick="ModalRedaccion.guardar('FINALIZADO')" class="px-5 py-2.5 rounded-xl font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition shadow flex items-center gap-2">
                        <i data-lucide="check-circle" class="w-4 h-4"></i> Emitir Final
                    </button>
                </div>
            </div>
        </div>`;
    },

    abrir: function(tipoDoc, titulo, esquema, idProceso) {
        this.documentoActivo = tipoDoc;
        this.procesoIdActivo = idProceso;
        this.esquemaActivo = esquema;

        document.getElementById("modal-titulo").textContent = titulo;
        const formulario = document.getElementById("form-documento");
        formulario.innerHTML = ""; 

        if (!esquema || esquema.length === 0) {
            formulario.innerHTML = `<div class="text-amber-600 bg-amber-50 p-4 rounded-xl font-medium flex items-center gap-3"><i data-lucide="alert-triangle"></i> Formulario en construcción.</div>`;
        } else {
            esquema.forEach(campo => {
                formulario.innerHTML += `
                    <div>
                        <label class="block text-sm font-semibold text-slate-700 mb-2">${campo.label}</label>
                        <input type="${campo.tipo}" id="${campo.id}" class="w-full rounded-xl border border-slate-300 bg-slate-50 py-3 px-4 focus:border-indigo-600 focus:bg-white outline-none transition" placeholder="${campo.placeholder}">
                    </div>
                `;
            });
        }

        const modal = document.getElementById("modal-redaccion");
        const content = document.getElementById("modal-content");
        modal.classList.remove("hidden");
        
        setTimeout(() => {
            content.classList.remove("scale-95", "opacity-0");
            content.classList.add("scale-100", "opacity-100");
        }, 10);
        lucide.createIcons();
    },

    cerrar: function() {
        const modal = document.getElementById("modal-redaccion");
        const content = document.getElementById("modal-content");
        
        content.classList.remove("scale-100", "opacity-100");
        content.classList.add("scale-95", "opacity-0");
        
        setTimeout(() => {
            modal.classList.add("hidden");
            this.documentoActivo = null;
            this.esquemaActivo = null;
        }, 200);
    },

    guardar: async function(estado) {
        if (!this.documentoActivo) return;
        
        const datosJSON = {};
        
        if (this.esquemaActivo) {
            for (let campo of this.esquemaActivo) {
                const inputVal = document.getElementById(campo.id).value.trim();
                
                if (estado === "FINALIZADO" && !inputVal) {
                    alert(`El campo "${campo.label}" es obligatorio para emitir el documento final.`);
                    return;
                }
                datosJSON[campo.id] = inputVal;
            }
        }

        const payload = {
            clave_documento: this.documentoActivo,
            estado: estado,
            datos_formulario: datosJSON
        };

        try {
            // Cambiamos el texto del botón temporalmente para dar feedback visual
            const btnBorrador = document.querySelector(`button[onclick="ModalRedaccion.guardar('BORRADOR')"]`);
            const textoOriginal = btnBorrador.innerHTML;
            if(estado === 'BORRADOR') btnBorrador.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Guardando...`;

            // Llamada real al backend
            await window.API.procesos.guardarDocumento(this.procesoIdActivo, payload);
            
            this.cerrar();
            
            // Recargamos los datos de la pantalla principal para que los botones se actualicen (PENDIENTE -> BORRADOR)
            if (typeof cargarDatosProceso === "function") {
                cargarDatosProceso();
            }

        } catch (error) {
            alert("Error al guardar el documento: " + error.message);
        }
    }
};

// Inyectar el componente en el DOM en cuanto el archivo carga
document.addEventListener("DOMContentLoaded", () => ModalRedaccion.init());