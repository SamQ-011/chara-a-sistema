import os
from app.services.motor_word_v2 import generar_documento_word
from app.services.generadores.utils import formatear_fecha_literal

RUTA_PLANTILLAS = "Plantillas"
RUTA_RESULTADOS = "Resultados"

def generar_acta_recepcion(ctx):
    # INYECCIÓN DEL ID ÚNICO
    ruta = os.path.join(ctx['ruta_directorio'], f"{ctx['proceso'].id}_{ctx['id_unico']}_6_ActaRecepcion.docx")
    doc_acta = next((d for d in ctx['proceso'].documentos if d.clave_documento == "acta_recepcion"), None)
    datos_modal = doc_acta.datos_formulario if doc_acta and doc_acta.datos_formulario else {}

    lotes_crudos = datos_modal.get("lotes_actas", [])
    lotes_procesados = []

    if not lotes_crudos:
        lotes_crudos = [{"items": ctx['items_mapeados']}]

    for lote in lotes_crudos:
        items_acta = []
        for i in lote.get("items", []):
            cant = float(i.get("cant", 0))
            if cant > 0:
                obj = str(i.get("objeto", i.get("objeto_corto", ""))).strip()
                desc = str(i.get("descripcion", i.get("descripcion_larga", ""))).strip()
                texto_unido = f"{obj}\n{desc}" if desc else obj
                str_cant = str(cant).rstrip('0').rstrip('.') if '.' in str(cant) else str(cant)

                items_acta.append({
                    "nro": str(i.get("nro", i.get("nro_item", ""))),
                    "desc": texto_unido,
                    "cant": str_cant,
                    "unm": str(i.get("tipuni", i.get("unidad", "")))
                })
        if items_acta: 
            lotes_procesados.append(items_acta)

    generar_documento_word(
        ruta_plantilla=f"{RUTA_PLANTILLAS}/actaEntrega.docx",
        ruta_salida=ruta,
        variables_extra=ctx['variables'], 
        lotes_actas=lotes_procesados
    )
    return ruta

def generar_informe_conformidad(ctx):
    # INYECCIÓN DEL ID ÚNICO
    ruta = os.path.join(ctx['ruta_directorio'], f"{ctx['proceso'].id}_7_InformeConformidad.docx")
    
    doc_info = next((d for d in ctx['proceso'].documentos if d.clave_documento == "informe_conformidad"), None)
    fecha_informe = doc_info.datos_formulario.get("fecha_informe", ctx['fecha_corta']) if doc_info and doc_info.datos_formulario else ctx['fecha_corta']

    doc_acta = next((d for d in ctx['proceso'].documentos if d.clave_documento == "acta_recepcion"), None)
    fecha_entrega = doc_acta.datos_formulario.get("fecha_entrega", ctx['fecha_corta']) if doc_acta and doc_acta.datos_formulario else ctx['fecha_corta']
    
    doc_inicio = next((d for d in ctx['proceso'].documentos if d.clave_documento == "solicitud_inicio"), None)
    fecha_solicitud = doc_inicio.datos_formulario.get("fecha_documento", ctx['fecha_corta']) if doc_inicio and doc_inicio.datos_formulario else ctx['fecha_corta']

    doc_oc = next((d for d in ctx['proceso'].documentos if d.clave_documento == "orden_compra"), None)
    items_oficiales = doc_oc.datos_formulario.get("items_orden", ctx['items_mapeados']) if doc_oc and doc_oc.datos_formulario else ctx['items_mapeados']

    vars_info_conf = {
        "{FECHA}": formatear_fecha_literal(fecha_informe),
        "{FECHA_ENTREGA}": formatear_fecha_literal(fecha_entrega),
        "{FECHA_SOLICITUD}": formatear_fecha_literal(fecha_solicitud)
    }
    
    generar_documento_word(
        ruta_plantilla=f"{RUTA_PLANTILLAS}/infoConformidad.docx",
        ruta_salida=ruta,
        variables_extra={**ctx['variables'], **vars_info_conf},
        items=items_oficiales 
    )
    return ruta