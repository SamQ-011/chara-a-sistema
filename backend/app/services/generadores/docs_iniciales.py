import os
from app.services.motor_word_v2 import generar_documento_word
from app.services.generadores.utils import formatear_fecha_literal, monto_a_letras_bolivianos

RUTA_PLANTILLAS = "Plantillas"
RUTA_RESULTADOS = "Resultados"

def generar_solicitud_cp(ctx):
    ruta = os.path.join(ctx['ruta_directorio'], f"{ctx['proceso'].id}_0_SolicitudInicial.docx")
    
    # 1. Recuperar JSON específico de este documento
    doc_bd = next((d for d in ctx['proceso'].documentos if d.clave_documento == "solicitud_cp"), None)
    datos = doc_bd.datos_formulario if doc_bd and doc_bd.datos_formulario else {}
    
    enc_finanzas_val = datos.get("encargado_presupuesto") or datos.get("enc_finanzas") or ctx['proceso'].responsable_presupuesto or ""
    vars_sol = {**ctx['variables'], "{ENCFINANZAS}": enc_finanzas_val}
            
    generar_documento_word(
        f"{RUTA_PLANTILLAS}/solicitudCP.docx", ruta, ctx['fecha_literal'], ctx['proceso'].codigo_proceso or "",
        ctx['proceso'].tecnico_solicitante or "", ctx['fecha_corta'], False, 0, ctx['proceso'].objeto_contratacion or "",
        ctx['monto_total'], ctx['proceso'].plazo_entrega or 0, None, None, ctx['gastos_mapeados'], vars_sol
    )
    return ruta

def generar_cert_presupuestaria(ctx):
    ruta = os.path.join(ctx['ruta_directorio'], f"{ctx['proceso'].id}_1_CertificacionPresupuestaria.docx")
    
    doc_bd = next((d for d in ctx['proceso'].documentos if d.clave_documento == "cert_presupuestaria"), None)
    datos = doc_bd.datos_formulario if doc_bd and doc_bd.datos_formulario else {}
    f_emision = datos.get("fecha_emision", ctx['fecha_corta'])
    
    # =================================================================
    # NUEVA LÓGICA: Extraer textos directamente del JSON de este paso
    # =================================================================
    programas_unicos = []
    proyectos_unicos = []
    
    gastos_json = datos.get("gastos", [])
    
    if gastos_json:
        for g in gastos_json:
            # Rellenamos con ceros por si acaso y armamos el formato exigido por Word
            prog = str(g.get('prog', '000')).zfill(3)
            proy = str(g.get('proy', '0000')).zfill(4)
            act = str(g.get('act', '000')).zfill(3)
            
            nom_prog = g.get('nombre_prog', 'Sin descripción')
            nom_proy = g.get('nombre_proy', 'Sin descripción')
            
            txt_prog = f"{prog} 0000 000 - {nom_prog}".upper()
            txt_proy = f"{prog} {proy} {act} - {nom_proy}".upper()
            
            if txt_prog not in programas_unicos:
                programas_unicos.append(txt_prog)
            if txt_proy not in proyectos_unicos:
                proyectos_unicos.append(txt_proy)
    
    texto_programas = "\n".join(programas_unicos)
    texto_proyectos = "\n".join(proyectos_unicos)
    
    vars_cert = {
        "{CARGO}": datos.get("cargo_solicitante", ctx['proceso'].cargo_tecnico_solicitante or ""),
        "{NOMBRE}": datos.get("nombre_solicitante", ctx['proceso'].tecnico_solicitante or ""),
        "{FECHAINI}": ctx['fecha_literal'], 
        "{FECHA}": formatear_fecha_literal(f_emision),
        "{TOTAL}": f"{ctx['monto_total']:,.2f}", 
        "{TOTALIT}": monto_a_letras_bolivianos(ctx['monto_total']),
        "{AÑO}": f_emision.split("-")[0] if "-" in f_emision else (f_emision[-4:] if f_emision else ""),
        "{ENCFINANZAS}": datos.get("encargado_presupuesto", ctx['proceso'].responsable_presupuesto or ""),
        "{PROGRAMA}": texto_programas, 
        "{PROYACT}": texto_proyectos 
    }
    
    generar_documento_word(f"{RUTA_PLANTILLAS}/certificacionPresupuestaria.docx", ruta, variables_extra={**ctx['variables'], **vars_cert}, gastos=ctx['gastos_mapeados'])
    return ruta

def generar_solicitud_inicio(ctx):
    ruta = os.path.join(ctx['ruta_directorio'], f"{ctx['proceso'].id}_2_SolicitudInicio.docx")
    
    doc_bd = next((d for d in ctx['proceso'].documentos if d.clave_documento == "solicitud_inicio"), None)
    datos = doc_bd.datos_formulario if doc_bd and doc_bd.datos_formulario else {}
    
    vars_inicio = {
        "{FECHA}": formatear_fecha_literal(datos.get("fecha_documento", ctx['fecha_corta'])),
        "{ALCALDE}": datos.get("alcalde", ""), 
        "{OBJETIVO}": datos.get("objetivo", ""),
        "{LUGARENTREGA}": datos.get("lugar_entrega", "")
    }
    
    puntos_extra = datos.get("puntos_extra", [])
    condiciones = datos.get("condiciones", [])
    
    generar_documento_word(
        f"{RUTA_PLANTILLAS}/solicitudIniProcContr.docx", 
        ruta, 
        variables_extra={**ctx['variables'], **vars_inicio}, 
        items=ctx['items_mapeados'],
        puntos_extra=puntos_extra,
        condiciones=condiciones
    )
    return ruta

def generar_especificaciones_tecnicas(ctx):
    ruta = os.path.join(ctx['ruta_directorio'], f"{ctx['proceso'].id}_1_EspecificacionesTecnicas.docx")
    
    # 1. Obtener datos del JSON guardado en el Paso 1
    doc_bd = next((d for d in ctx['proceso'].documentos if d.clave_documento == "especificaciones_tecnicas"), None)
    datos = doc_bd.datos_formulario if doc_bd and doc_bd.datos_formulario else {}
    
    items_crudos = datos.get("items_tecnicos", ctx['items_mapeados'])
    
    items_tecnicos = []
    if items_crudos:
        for i in items_crudos:
            items_tecnicos.append({
                "nro": i.get("nro", i.get("nro_item", "")),
                "objeto": i.get("objeto", i.get("objeto_corto", "")),
                "descripcion": i.get("descripcion", i.get("descripcion_larga", "")),
                "tipuni": i.get("tipuni", i.get("unidad", "")),
                "cant": i.get("cant", i.get("cantidad", "")),
                "precio_unitario": i.get("precio_unitario", 0),
                "total_item": i.get("total_item", 0)
            })
            
    # 2. Calcular total del precio referencial
    total_monto = sum(float(i.get("total_item", 0)) for i in items_tecnicos) if items_tecnicos else ctx['monto_total']
    
    def_plazo = f"{ctx['proceso'].plazo_entrega} días calendario" if ctx['proceso'].plazo_entrega else "Inmediato"
    def_pago = ctx['proceso'].tipo_pago or "TRANSFERENCIA BANCARIA"

    vars_specs = {
        "{FECHA}": formatear_fecha_literal(datos.get("fecha_documento", ctx['fecha_corta'])),
        "{LUGARENTREGA}": datos.get("lugar_entrega", ctx['proceso'].distrito_comunidad or ""),
        "{PLAZOENTREGA}": datos.get("plazo_entrega", def_plazo) or def_plazo,
        "{FORMAPAGO}": datos.get("forma_pago", def_pago) or def_pago,
        "{TOTAL}": f"{total_monto:,.2f}"
    }
    
    puntos_extra = datos.get("puntos_extra", [])
    condiciones = datos.get("condiciones", [])
    if not condiciones and datos.get("otras_condiciones"):
        condiciones = [datos.get("otras_condiciones")]
        
    # 3. Generar documento con la plantilla espTec.docx
    generar_documento_word(
        f"{RUTA_PLANTILLAS}/espTec.docx", 
        ruta, 
        variables_extra={**ctx['variables'], **vars_specs}, 
        items=items_tecnicos,
        puntos_extra=puntos_extra,
        condiciones=condiciones
    )
    return ruta