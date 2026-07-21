import os
from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException

from app.models.tablas_transaccionales import Proceso
from app.services.generadores.utils import formatear_fecha_literal, monto_a_letras_bolivianos

# --- SE DESCOMENTARÁN EN EL SIGUIENTE PASO ---
from app.services.generadores.docs_iniciales import generar_solicitud_cp, generar_cert_presupuestaria, generar_solicitud_inicio
from app.services.generadores.docs_contratacion import generar_autorizacion_inicio, generar_informe_cotizacion, generar_orden_compra, generar_notificacion_adjudicacion
from app.services.generadores.docs_logistica import generar_ingreso_almacenes, generar_salida_almacenes, generar_ambos_almacenes
from app.services.generadores.docs_actas import generar_acta_recepcion, generar_informe_conformidad

RUTA_PLANTILLAS = "Plantillas"
RUTA_RESULTADOS = "Resultados"

def orquestar_generacion_documento(proceso_id: int, tipo_documento: str, db: Session, fecha_corta_manual: str = None, fecha_larga_manual: str = None):
    # =================================================================
    # 1. LA SÚPER CONSULTA (Eager Loading - 0 problemas de N+1)
    # =================================================================
    proceso = db.query(Proceso).options(
        joinedload(Proceso.items),
        joinedload(Proceso.gastos),
        joinedload(Proceso.documentos)
    ).filter(Proceso.id == proceso_id).first()

    if not proceso:
        raise HTTPException(status_code=404, detail="Proceso no encontrado.")

    # =================================================================
    # 2. CONSTRUCCIÓN DE CONTEXTO GLOBAL (En memoria, instantáneo)
    # =================================================================
    proveedor = proceso.proveedor
    proyecto = proceso.proyecto
    unidad = proceso.unidad_solicitante

    razon_social = proveedor.razon_social.replace("Proveedor / Razón Social:", "").replace("PROVEEDOR / RAZÓN SOCIAL:", "").strip() if proveedor else ""
    nit = proveedor.nit_ci if proveedor else ""
    
    fecha_corta = proceso.fecha_solicitud if proceso.fecha_solicitud else (proceso.fecha_creacion.strftime("%Y-%m-%d") if proceso.fecha_creacion else "")
    fecha_literal = formatear_fecha_literal(fecha_corta)
    monto_total = float(proceso.monto_total) if proceso.monto_total else 0.0
    retencion_val = float(proceso.retencion_monto) if proceso.retencion_monto else 0.0

    os.makedirs(RUTA_RESULTADOS, exist_ok=True)

    variables = {
        "{PROVEEDOR}": razon_social, "{PROV}": razon_social,
        "{NIT}": nit, "{NITCI}": nit, "{CINIT}": nit,
        "{DIR}": proveedor.direccion if proveedor else "",
        "{TEL}": proveedor.telefono if proveedor else "", "{CEL}": proveedor.telefono if proveedor else "",
        "{COD}": proceso.codigo_proceso or "", "{N}": proceso.nro_orden or "",
        "{OBJCONTR}": proceso.objeto_contratacion or "", "{DESC}": proceso.objeto_contratacion or "",
        "{DESCA}": proceso.desca_contextual or "",
        "{CODPROY}": proyecto.codigo_proyecto if proyecto else "",
        "{UNISOLIC}": unidad.nombre if unidad else "", "{CARGOA}": unidad.nombre if unidad else "", "{AREASOLIC}": unidad.nombre if unidad else "",          
        "{DISTRI}": proceso.distrito_comunidad or "",
        "{TIPOPAGO}": proceso.tipo_pago or "", "{TIPO}": proceso.tipo_contratacion or "BIENES",
        "{ENCFINANZAS}": proceso.responsable_presupuesto or "",
        "{NOMBRE}": proceso.tecnico_solicitante or "", "{CARGO}": proceso.cargo_tecnico_solicitante or "",
        "{TOTAL}": f"{monto_total:,.2f}", "{PRECREF}": monto_a_letras_bolivianos(monto_total), 
        "{RETENC}": f"{retencion_val:,.2f}", "{D}": str(proceso.plazo_entrega or ""),
        "{FECHA}": fecha_literal, "{FECHA_ACTUAL}": fecha_corta
    }

    # Búsqueda rápida en memoria para la solicitud de inicio
    doc_inicio = next((d for d in proceso.documentos if d.clave_documento == "solicitud_inicio"), None)
    
    items_mapeados = [{"nro": i.nro_item, "objeto": i.objeto_corto, "descripcion": i.descripcion_larga, "tipuni": i.unidad, "cant": float(i.cantidad), "precio_unitario": float(i.precio_unitario), "total_item": float(i.total_item)} for i in proceso.items]
    if doc_inicio and doc_inicio.datos_formulario and doc_inicio.datos_formulario.get("items_tecnicos"):
        items_mapeados = doc_inicio.datos_formulario["items_tecnicos"]

    gastos_mapeados = []
    for g in proceso.gastos:
        p_prog = str(g.prog) if g.prog else "00"
        p_proy = str(g.proy)
        p_act = str(g.act).zfill(3) if g.act else "000"
        gastos_mapeados.append({"partida": g.partida, "prog": p_prog, "proy": p_proy, "act": p_act, "ff": g.ff, "of": g.of, "descripcion": g.descripcion, "monto": float(g.monto), "prog_header": f"{p_prog} 000 000", "proy_header": f"{p_prog} {p_proy} {p_act}"})

    contexto = {
        "proceso": proceso,
        "variables": variables,
        "items_mapeados": items_mapeados,
        "gastos_mapeados": gastos_mapeados,
        "fecha_corta": fecha_corta,
        "fecha_literal": fecha_literal,
        "monto_total": monto_total,
        "razon_social": razon_social
    }

    # =================================================================
    # 3. DICCIONARIO DE RUTEO
    # =================================================================
    estrategias = {
        "solicitud_cp": generar_solicitud_cp,
        "cert_presupuestaria": generar_cert_presupuestaria,
        "solicitud_inicio": generar_solicitud_inicio,
        "autorizacion_inicio": generar_autorizacion_inicio,
        "informe_cotizacion": generar_informe_cotizacion,
        "orden_compra": generar_orden_compra,
        "notificacion_adjudicacion": generar_notificacion_adjudicacion,
        "ingreso_almacenes": generar_ingreso_almacenes,
        "salida_almacenes": generar_salida_almacenes,
        "almacenes": generar_ambos_almacenes,
        "acta_recepcion": generar_acta_recepcion,
        "informe_conformidad": generar_informe_conformidad
    }
    
    estrategia = estrategias.get(tipo_documento)
    if not estrategia:
        raise HTTPException(status_code=400, detail=f"El documento '{tipo_documento}' no está configurado (o está comentado).")
    
    return estrategia(contexto)