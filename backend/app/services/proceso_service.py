from typing import Optional
from sqlalchemy.orm import Session
from app.core.config import MATRIZ_REQUISITOS
from app.models.tablas_transaccionales import Proceso, EstadoProceso, EstadoDocumento
from app.models.tablas_base import Unidad, Usuario

def evaluar_estado_proceso(proceso: Proceso) -> None:
    """
    Evalúa y actualiza el estado general de un proceso de contratación
    basado en los documentos finalizados requeridos por la matriz de requisitos.
    """
    if proceso.estado == EstadoProceso.ANULADO:
        return 
        
    docs_generados = {doc.clave_documento for doc in proceso.documentos if doc.estado == EstadoDocumento.FINALIZADO}
    
    if "ingreso_almacenes" in docs_generados and "salida_almacenes" in docs_generados:
        docs_generados.add("almacenes")
    
    requeridos = MATRIZ_REQUISITOS["ESTANDAR"]
    
    if not docs_generados:
        proceso.estado = EstadoProceso.BORRADOR
    elif requeridos.issubset(docs_generados):
        proceso.estado = EstadoProceso.FINALIZADO
    elif "informe_conformidad" in docs_generados:
        proceso.estado = EstadoProceso.CON_PENDIENTES
    else:
        proceso.estado = EstadoProceso.EN_CURSO

def resolver_firmante_solicitante(db: Session, unidad_id: Optional[int], usuario_actual_db: Optional[Usuario]) -> tuple[str, str]:
    """
    Resuelve el nombre y cargo de la autoridad firmante para la unidad solicitante.
    Si la unidad tiene un responsable asignado (Titular), devuelve sus datos para que un
    pasante o auxiliar genere el documento legal a nombre del Titular.
    """
    if unidad_id:
        unidad_db = db.query(Unidad).filter(Unidad.id == unidad_id, Unidad.activo == True).first()
        if unidad_db and unidad_db.responsable_id:
            titular = db.query(Usuario).filter(Usuario.id == unidad_db.responsable_id, Usuario.activo == True).first()
            if titular:
                titulo = f"{titular.titulo.strip()} " if titular.titulo and titular.titulo.strip() else ""
                return f"{titulo}{titular.nombre_completo}", titular.cargo or ""
        
        titular = db.query(Usuario).filter(
            Usuario.unidad_id == unidad_id,
            Usuario.activo == True,
            Usuario.rol == "SOLICITANTE"
        ).first()
        if titular:
            titulo = f"{titular.titulo.strip()} " if titular.titulo and titular.titulo.strip() else ""
            return f"{titulo}{titular.nombre_completo}", titular.cargo or ""

    if usuario_actual_db:
        titulo = f"{usuario_actual_db.titulo.strip()} " if usuario_actual_db.titulo and usuario_actual_db.titulo.strip() else ""
        return f"{titulo}{usuario_actual_db.nombre_completo}", usuario_actual_db.cargo or ""

    return "Servidor Público", "Unidad Solicitante"

def generar_codigo_proceso(db: Session) -> str:
    """
    Genera un nuevo correlativo de proceso de contratación (ej: PROC-2026-0001).
    """
    ult = db.query(Proceso).order_by(Proceso.id.desc()).first()
    num = (ult.id + 1) if ult else 1
    return f"PROC-2026-{num:04d}"
