import os
from app.services.motor_word_v2 import generar_documento_word
from app.services.motor_excel_v4 import generar_documento_excel
from app.services.generadores.utils import formatear_fecha_literal

RUTA_PLANTILLAS = "Plantillas"
RUTA_RESULTADOS = "Resultados"
MAPEO_FINANCIERA = {'nro': 2, 'objeto': 3, 'tipuni': 4, 'cant': 5, 'precio_unitario': 6, 'total_item': 7}

def generar_autorizacion_inicio(ctx):
    # INYECCIÓN DEL ID ÚNICO
    ruta = os.path.join(ctx['ruta_directorio'], f"{ctx['proceso'].id}_3_AutorizacionContratacion.xlsx")
    doc_auth = next((d for d in ctx['proceso'].documentos if d.clave_documento == "autorizacion_inicio"), None)
    items_locales = ctx['items_mapeados']
    variables = ctx['variables'].copy()
    
    if doc_auth and doc_auth.datos_formulario:
        datos = doc_auth.datos_formulario
        if "fecha_documento" in datos: variables["{FECHA}"] = formatear_fecha_literal(datos["fecha_documento"])
        if "unidad_solicitante" in datos: variables["{CARGOA}"] = datos["unidad_solicitante"]
        if "codigo_proyecto" in datos: variables["{CODPROY}"] = datos["codigo_proyecto"]
        if "objeto_contratacion" in datos: variables["{OBJCONTR}"] = datos["objeto_contratacion"].upper()
        if "items_tecnicos" in datos and len(datos["items_tecnicos"]) > 0: items_locales = datos["items_tecnicos"]

    generar_documento_excel(f"{RUTA_PLANTILLAS}/autorizacion_contr.xlsx", ruta, variables, items_locales, MAPEO_FINANCIERA, "financiera")
    return ruta

def generar_informe_cotizacion(ctx):
    # INYECCIÓN DEL ID ÚNICO
    ruta = os.path.join(ctx['ruta_directorio'], f"{ctx['proceso'].id}_5_InformeCotizacion.docx")
    doc_info = next((d for d in ctx['proceso'].documentos if d.clave_documento == "informe_cotizacion"), None)
    datos = doc_info.datos_formulario if doc_info and doc_info.datos_formulario else {}
    
    doc_auth = next((d for d in ctx['proceso'].documentos if d.clave_documento == "autorizacion_inicio"), None)
    doc_inicio = next((d for d in ctx['proceso'].documentos if d.clave_documento == "solicitud_inicio"), None)
    
    vars_info = {
        "{ENCCONTR}": datos.get("encargado_rpc", ""), "{ASISTENTEADM}": datos.get("asistente_adm", ""),
        "{FECHA}": formatear_fecha_literal(datos.get("fecha_informe", ctx['fecha_corta'])),
        "{FECHACOT}": formatear_fecha_literal(datos.get("fecha_cotizacion", ctx['fecha_corta'])),
        "{FECHAPC}": formatear_fecha_literal(doc_auth.datos_formulario.get("fecha_documento", ctx['fecha_corta']) if doc_auth and doc_auth.datos_formulario else ctx['fecha_corta']),
        "{OBJCONTR}": ctx['proceso'].objeto_contratacion or "", "{OBJCORTO}": ctx['proceso'].objeto_contratacion or "",
        "{CARGO}": ctx['proceso'].cargo_tecnico_solicitante or "",
        "{OBJETIVOCONTR}": doc_inicio.datos_formulario.get("objetivo", "") if doc_inicio and doc_inicio.datos_formulario else "",
        "{OBJETIVOCONTR}": datos.get("finalidad_contratacion", ""),
        "{EMPRESA}": datos.get("proveedor_ganador", "")
    }
    
    cots = datos.get("cotizaciones", [])
    for index, cot in enumerate(cots): cot['n'] = str(index + 1)
    generar_documento_word(f"{RUTA_PLANTILLAS}/infoCotizacion.docx", ruta, variables_extra={**ctx['variables'], **vars_info}, items=cots)
    return ruta

def generar_orden_compra(ctx):
    # INYECCIÓN DEL ID ÚNICO
    ruta = os.path.join(ctx['ruta_directorio'], f"{ctx['proceso'].id}_4_OrdenCompra.xlsx")
    doc_oc = next((d for d in ctx['proceso'].documentos if d.clave_documento == "orden_compra"), None)
    datos_modal = doc_oc.datos_formulario if doc_oc and doc_oc.datos_formulario else {}
    
    retencion = float(ctx['proceso'].retencion_monto) or 0.0
    monto_final = float(ctx['proceso'].monto_adjudicado) if ctx['proceso'].monto_adjudicado else ctx['monto_total']
    
    vars_oc = {
        "{FECHA}": formatear_fecha_literal(datos_modal.get("fecha_documento", ctx['fecha_corta'])),
        "{N}": datos_modal.get("nro_orden", ctx['proceso'].nro_orden or "S/N"),
        "{DIR}": datos_modal.get("direccion", ctx['proceso'].proveedor.direccion if ctx['proceso'].proveedor and ctx['proceso'].proveedor.direccion else ""),
        "{TEL}": datos_modal.get("telefono", ctx['proceso'].proveedor.telefono if ctx['proceso'].proveedor and ctx['proceso'].proveedor.telefono else ""),
        "{NITCI}": datos_modal.get("nit", ctx['proceso'].proveedor.nit_ci if ctx['proceso'].proveedor and ctx['proceso'].proveedor.nit_ci else "S/N"),
        "{RETENC}": f"{retencion:,.2f}" if retencion > 0 else "0.00",
        "{TOTAL}": f"{monto_final:,.2f}"
    }
    
    items_locales = datos_modal.get("items_orden", ctx['items_mapeados'])
    generar_documento_excel(f"{RUTA_PLANTILLAS}/orden_compra.xlsx", ruta, {**ctx['variables'], **vars_oc}, items_locales, MAPEO_FINANCIERA, "financiera")
    return ruta

def generar_notificacion_adjudicacion(ctx):
    # INYECCIÓN DEL ID ÚNICO
    ruta = os.path.join(ctx['ruta_directorio'], f"{ctx['proceso'].id}_5_NotificacionAdjudicacion.docx")
    doc_notif = next((d for d in ctx['proceso'].documentos if d.clave_documento == "notificacion_adjudicacion"), None)
    datos_modal = doc_notif.datos_formulario if doc_notif and doc_notif.datos_formulario else {}
    
    doc_info = next((d for d in ctx['proceso'].documentos if d.clave_documento == "informe_cotizacion"), None)
    fecha_informe_cot = doc_info.datos_formulario.get("fecha_informe", ctx['fecha_corta']) if doc_info and doc_info.datos_formulario else ctx['fecha_corta']
    
    # ==========================================
    # CORRECCIÓN: EXTRACCIÓN REAL DEL PROVEEDOR
    # ==========================================
    proveedor_oficial = ctx['proceso'].proveedor.razon_social if hasattr(ctx['proceso'], 'proveedor') and ctx['proceso'].proveedor else None
    proveedor_json = doc_info.datos_formulario.get("proveedor_ganador") if doc_info and doc_info.datos_formulario else None
    nombre_proveedor = proveedor_oficial or proveedor_json or "PROVEEDOR NO DEFINIDO"

    fecha_notif = datos_modal.get("fecha_notificacion", ctx['fecha_corta'])
    monto_retencion = float(datos_modal.get("monto_retencion", ctx['proceso'].retencion_monto or 0.0))
    plazo_entrega = int(datos_modal.get("plazo_entrega", ctx['proceso'].plazo_entrega or 0))
    aplica_retencion = monto_retencion > 0
    monto_final = float(ctx['proceso'].monto_adjudicado) if ctx['proceso'].monto_adjudicado else ctx['monto_total']
    
    docs_crudos = datos_modal.get("documentos_requeridos", [])
    documentos_vineta = [f"- {doc}" for doc in docs_crudos]

    variables_notif = {
        "{FECHA}": formatear_fecha_literal(fecha_notif),
        "{FECHAINF}": formatear_fecha_literal(fecha_informe_cot)
    }
    
    generar_documento_word(
        ruta_plantilla=f"{RUTA_PLANTILLAS}/notificAdjudic.docx",
        ruta_salida=ruta,
        fecha=formatear_fecha_literal(fecha_notif),
        cod=ctx['proceso'].codigo_proceso or "",
        nombre=nombre_proveedor, # <--- SE INYECTA LA VARIABLE CORREGIDA AQUÍ
        fechaInfo=formatear_fecha_literal(fecha_informe_cot),
        retenc=aplica_retencion,
        porcentaje=monto_retencion,
        objContr=ctx['proceso'].objeto_contratacion or "",
        monto=monto_final,
        plazoEntrega=plazo_entrega,
        seleccionados=documentos_vineta,
        items=ctx['items_mapeados'],
        gastos=ctx['gastos_mapeados'],
        variables_extra={**ctx['variables'], **variables_notif}
    )
    return ruta