import os
from app.services.motor_word_v2 import generar_documento_word
from app.services.generadores.utils import formatear_fecha_literal, monto_a_letras_bolivianos

RUTA_PLANTILLAS = "Plantillas"
RUTA_RESULTADOS = "Resultados"

def generar_solicitud_cp(ctx):
    ruta = os.path.join(RUTA_RESULTADOS, f"{ctx['proceso'].id}_0_SolicitudInicial.docx")
    generar_documento_word(
        f"{RUTA_PLANTILLAS}/solicitudCP.docx", ruta, ctx['fecha_literal'], ctx['proceso'].codigo_proceso or "",
        ctx['proceso'].tecnico_solicitante or "", ctx['fecha_corta'], False, 0, ctx['proceso'].objeto_contratacion or "",
        ctx['monto_total'], ctx['proceso'].plazo_entrega or 0, None, ctx['items_mapeados'], ctx['gastos_mapeados'], ctx['variables']
    )
    return ruta

def generar_cert_presupuestaria(ctx):
    ruta = os.path.join(RUTA_RESULTADOS, f"{ctx['proceso'].id}_1_CertificacionPresupuestaria.docx")
    doc_bd = next((d for d in ctx['proceso'].documentos if d.clave_documento == "cert_presupuestaria"), None)
    datos = doc_bd.datos_formulario if doc_bd and doc_bd.datos_formulario else {}
    f_emision = datos.get("fecha_emision", ctx['fecha_corta'])
    
    vars_cert = {
        "{CARGO}": datos.get("cargo_solicitante", ctx['proceso'].cargo_tecnico_solicitante or ""),
        "{NOMBRE}": datos.get("nombre_solicitante", ctx['proceso'].tecnico_solicitante or ""),
        "{FECHAINI}": ctx['fecha_literal'], "{FECHA}": formatear_fecha_literal(f_emision),
        "{TOTAL}": f"{ctx['monto_total']:,.2f}", "{TOTALIT}": monto_a_letras_bolivianos(ctx['monto_total']),
        "{AÑO}": f_emision.split("-")[0] if "-" in f_emision else (f_emision[-4:] if f_emision else ""),
        "{ENCFINANZAS}": ctx['proceso'].responsable_presupuesto or "",
        "{PROGRAMA}": ctx['gastos_mapeados'][0]["prog_header"] if ctx['gastos_mapeados'] else "",
        "{PROYACT}": ctx['gastos_mapeados'][0]["proy_header"] if ctx['gastos_mapeados'] else ""
    }
    generar_documento_word(f"{RUTA_PLANTILLAS}/certificacionPresupuestaria.docx", ruta, variables_extra={**ctx['variables'], **vars_cert}, gastos=ctx['gastos_mapeados'])
    return ruta

def generar_solicitud_inicio(ctx):
    ruta = os.path.join(RUTA_RESULTADOS, f"{ctx['proceso'].id}_2_SolicitudInicio.docx")
    doc_bd = next((d for d in ctx['proceso'].documentos if d.clave_documento == "solicitud_inicio"), None)
    datos = doc_bd.datos_formulario if doc_bd and doc_bd.datos_formulario else {}
    
    vars_inicio = {
        "{FECHA}": formatear_fecha_literal(datos.get("fecha_documento", ctx['fecha_corta'])),
        "{ALCALDE}": datos.get("alcalde", ""), "{OBJETIVO}": datos.get("objetivo", ""),
        "{LUGARENTREGA}": datos.get("lugar_entrega", ""), "{OTRASCOND}": datos.get("otras_condiciones", "")
    }
    generar_documento_word(f"{RUTA_PLANTILLAS}/solicitudIniProcContr.docx", ruta, variables_extra={**ctx['variables'], **vars_inicio}, items=ctx['items_mapeados'])
    return ruta