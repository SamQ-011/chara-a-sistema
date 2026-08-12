from fastapi import APIRouter, Depends, HTTPException, status, Form, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime
import os, shutil

from app.core.base_datos import get_db
from app.models.tablas_base import Usuario, Unidad
from app.models.tablas_transaccionales import (
    HojaRuta, Correspondencia, DerivacionHojaRuta, Proceso, EstadoProceso, CorrespondenciaMovimiento
)
from app.schemas.correspondencia import (
    CorrespondenciaCrear, CorrespondenciaAtender, CorrespondenciaOut, DerivacionCrear, DerivacionOut,
    MovimientoOut, NotaCrear
)
from app.core.seguridad import obtener_usuario_actual

router = APIRouter(prefix="/api/correspondencia", tags=["Correspondencia y Ventanilla Única"])

def generar_codigo_hoja_ruta(db: Session) -> str:
    anio = datetime.now().year
    prefijo = f"HR-{anio}-"
    ult_hr = db.query(HojaRuta).filter(HojaRuta.numero_hr.like(f"{prefijo}%")).order_by(HojaRuta.id.desc()).first()
    if not ult_hr:
        return f"{prefijo}0001"
    try:
        num = int(ult_hr.numero_hr.split("-")[-1]) + 1
        return f"{prefijo}{num:04d}"
    except ValueError:
        return f"{prefijo}{ult_hr.id + 1:04d}"

@router.post("/ingreso-form", status_code=status.HTTP_201_CREATED)
async def registrar_ingreso_correspondencia_form(
    tipo_remitente: str = Form("INSTITUCIONAL"),
    nombre_remitente: Optional[str] = Form(None),
    cargo_remitente: Optional[str] = Form(None),
    telefono_remitente: Optional[str] = Form(None),
    cite_origen: Optional[str] = Form(None),
    fecha_doc_origen: Optional[str] = Form(None),
    tipo_documento: str = Form("CARTA"),
    asunto: str = Form(...),
    nro_fojas: int = Form(1),
    anexos: Optional[str] = Form(None),
    unidad_destino_id: int = Form(...),
    instruccion_proveido: Optional[str] = Form("Para su atención y trámite correspondiente"),
    pdf_solicitud: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    usuario_actual: dict = Depends(obtener_usuario_actual)
):
    user_id = usuario_actual.get("user_id") or usuario_actual.get("sub")
    usuario_db = db.query(Usuario).filter(Usuario.id == int(user_id)).first()
    if not usuario_db:
        raise HTTPException(status_code=401, detail="Usuario invalido")

    remitente_final = nombre_remitente.strip() if (nombre_remitente and nombre_remitente.strip()) else (usuario_db.nombre_completo or "Unidad Solicitante")

    num_hr = generar_codigo_hoja_ruta(db)

    ruta_guardada = None
    if pdf_solicitud and pdf_solicitud.filename:
        folder = os.path.join("uploads", "correspondencia")
        os.makedirs(folder, exist_ok=True)
        filename = f"{num_hr.replace('/', '_')}_{pdf_solicitud.filename}"
        ruta_guardada = os.path.join(folder, filename)
        with open(ruta_guardada, "wb") as buffer:
            shutil.copyfileobj(pdf_solicitud.file, buffer)

    nueva_hr = HojaRuta(
        numero_hr=num_hr,
        usuario_recepcion_id=usuario_db.id,
        tipo_remitente=tipo_remitente,
        nombre_remitente=remitente_final,
        cargo_remitente=cargo_remitente,
        telefono_remitente=telefono_remitente,
        cite_origen=cite_origen,
        fecha_doc_origen=fecha_doc_origen,
        tipo_documento=tipo_documento,
        asunto=asunto,
        nro_fojas=nro_fojas,
        anexos=anexos,
        unidad_actual_id=unidad_destino_id,
        estado_general="EN_BANDEJA"
    )
    db.add(nueva_hr)
    db.flush()

    nueva_corr = Correspondencia(
        hoja_ruta_id=nueva_hr.id,
        estado="PENDIENTE",
        ruta_archivo_respuesta=ruta_guardada
    )
    db.add(nueva_corr)

    unidad_origen_id = usuario_db.unidad_id or unidad_destino_id
    nueva_derivacion = DerivacionHojaRuta(
        hoja_ruta_id=nueva_hr.id,
        unidad_origen_id=unidad_origen_id,
        unidad_destino_id=unidad_destino_id,
        usuario_emisor_id=usuario_db.id,
        instruccion_proveido=instruccion_proveido or "Para su atención y trámite correspondiente"
    )
    db.add(nueva_derivacion)

    db.commit()
    db.refresh(nueva_hr)

    return {
        "success": True,
        "message": f"Correspondencia registrada exitosamente con Hoja de Ruta {num_hr}.",
        "data": {
            "hoja_ruta_id": nueva_hr.id,
            "numero_hr": nueva_hr.numero_hr,
            "pdf_path": ruta_guardada
        }
    }

@router.post("/", status_code=status.HTTP_201_CREATED)
def registrar_ingreso_correspondencia(
    payload: CorrespondenciaCrear,
    db: Session = Depends(get_db),
    usuario_actual: dict = Depends(obtener_usuario_actual)
):
    user_id = usuario_actual.get("user_id") or usuario_actual.get("sub")
    usuario_db = db.query(Usuario).filter(Usuario.id == int(user_id)).first()
    if not usuario_db:
        raise HTTPException(status_code=401, detail="Usuario invalido")

    # 1. Generar número de Hoja de Ruta
    num_hr = generar_codigo_hoja_ruta(db)

    # 2. Crear registro de Hoja de Ruta Madre
    nueva_hr = HojaRuta(
        numero_hr=num_hr,
        usuario_recepcion_id=usuario_db.id,
        tipo_remitente=payload.tipo_remitente,
        nombre_remitente=payload.nombre_remitente,
        cargo_remitente=payload.cargo_remitente,
        telefono_remitente=payload.telefono_remitente,
        cite_origen=payload.cite_origen,
        fecha_doc_origen=payload.fecha_doc_origen,
        tipo_documento=payload.tipo_documento,
        asunto=payload.asunto,
        nro_fojas=payload.nro_fojas,
        anexos=payload.anexos,
        unidad_actual_id=payload.unidad_destino_id,
        estado_general="EN_BANDEJA"
    )
    db.add(nueva_hr)
    db.flush()

    # 3. Crear extensión de Correspondencia
    nueva_corr = Correspondencia(
        hoja_ruta_id=nueva_hr.id,
        estado="PENDIENTE"
    )
    db.add(nueva_corr)

    # 4. Registrar Derivación Inicial
    unidad_origen_id = usuario_db.unidad_id or payload.unidad_destino_id
    nueva_derivacion = DerivacionHojaRuta(
        hoja_ruta_id=nueva_hr.id,
        unidad_origen_id=unidad_origen_id,
        unidad_destino_id=payload.unidad_destino_id,
        usuario_emisor_id=usuario_db.id,
        instruccion_proveido=payload.instruccion_proveido or "Para su atención y trámite correspondiente"
    )
    db.add(nueva_derivacion)

    db.commit()
    db.refresh(nueva_hr)

    return {
        "success": True,
        "message": f"Correspondencia registrada exitosamente con Hoja de Ruta {num_hr}.",
        "data": {
            "hoja_ruta_id": nueva_hr.id,
            "numero_hr": nueva_hr.numero_hr
        }
    }

@router.get("/")
def listar_correspondencia(
    unidad_id: Optional[int] = None,
    estado: Optional[str] = None,
    db: Session = Depends(get_db),
    usuario_actual: dict = Depends(obtener_usuario_actual)
):
    from sqlalchemy import or_

    query = db.query(HojaRuta).options(
        joinedload(HojaRuta.usuario_recepcion),
        joinedload(HojaRuta.unidad_actual),
        joinedload(HojaRuta.correspondencia),
        joinedload(HojaRuta.proceso),
        joinedload(HojaRuta.derivaciones)
    )

    rol_efectivo = usuario_actual.get("rol_efectivo", usuario_actual.get("rol"))
    user_id = usuario_actual.get("user_id") or usuario_actual.get("sub")

    if unidad_id:
        query = query.filter(HojaRuta.unidad_actual_id == unidad_id)
    elif rol_efectivo in ["SOLICITANTE", "PASANTE", "UNIDAD"]:
        usuario_db = db.query(Usuario).filter(Usuario.id == int(user_id)).first()
        if usuario_db and usuario_db.unidad_id:
            query = query.filter(
                or_(
                    HojaRuta.usuario_recepcion_id == int(user_id),
                    HojaRuta.unidad_actual_id == usuario_db.unidad_id
                )
            )
        else:
            query = query.filter(HojaRuta.usuario_recepcion_id == int(user_id))

    if estado:
        query = query.filter(HojaRuta.estado_general == estado)

    hrs = query.order_by(HojaRuta.id.desc()).all()

    resultado = []
    for hr in hrs:
        corr = hr.correspondencia
        proc = hr.proceso
        
        derivaciones_out = [
            DerivacionOut(
                id=d.id,
                unidad_origen=d.unidad_origen.nombre if d.unidad_origen else "Recepción",
                unidad_destino=d.unidad_destino.nombre if d.unidad_destino else "Unidad",
                usuario_emisor=d.usuario_emisor.nombre_completo if d.usuario_emisor else "Funcionario",
                instruccion_proveido=d.instruccion_proveido,
                fecha_derivacion=d.fecha_derivacion.strftime("%Y-%m-%d %H:%M") if d.fecha_derivacion else ""
            ) for d in hr.derivaciones
        ]

        resultado.append(
            CorrespondenciaOut(
                id=hr.id,
                numero_hr=hr.numero_hr,
                fecha_recepcion=hr.fecha_recepcion.strftime("%Y-%m-%d %H:%M") if hr.fecha_recepcion else "",
                usuario_recepcion=hr.usuario_recepcion.nombre_completo if hr.usuario_recepcion else "Ventanilla",
                tipo_remitente=hr.tipo_remitente,
                nombre_remitente=hr.nombre_remitente,
                cargo_remitente=hr.cargo_remitente,
                telefono_remitente=hr.telefono_remitente,
                cite_origen=hr.cite_origen,
                fecha_doc_origen=hr.fecha_doc_origen,
                tipo_documento=hr.tipo_documento,
                asunto=hr.asunto,
                nro_fojas=hr.nro_fojas,
                anexos=hr.anexos,
                unidad_actual_id=hr.unidad_actual_id,
                unidad_actual=hr.unidad_actual.nombre if hr.unidad_actual else "Unidad",
                estado_general=hr.estado_general,
                estado_correspondencia=corr.estado if corr else "PENDIENTE",
                cite_respuesta=corr.cite_respuesta if corr else None,
                resumen_respuesta=corr.resumen_respuesta if corr else None,
                fecha_atencion=corr.fecha_atencion.strftime("%Y-%m-%d %H:%M") if corr and corr.fecha_atencion else None,
                proceso_id=proc.id if proc else None,
                derivaciones=derivaciones_out
            )
        )

    return {"success": True, "data": resultado}

@router.get("/{hoja_ruta_id}")
def obtener_detalle_correspondencia(
    hoja_ruta_id: int,
    db: Session = Depends(get_db),
    usuario_actual: dict = Depends(obtener_usuario_actual)
):
    hr = db.query(HojaRuta).filter(HojaRuta.id == hoja_ruta_id).first()
    if not hr:
        raise HTTPException(status_code=404, detail="Hoja de Ruta no encontrada")

    corr = hr.correspondencia
    proc = hr.proceso
    
    derivaciones_out = [
        DerivacionOut(
            id=d.id,
            unidad_origen=d.unidad_origen.nombre if d.unidad_origen else "Recepción",
            unidad_destino=d.unidad_destino.nombre if d.unidad_destino else "Unidad",
            usuario_emisor=d.usuario_emisor.nombre_completo if d.usuario_emisor else "Funcionario",
            instruccion_proveido=d.instruccion_proveido,
            fecha_derivacion=d.fecha_derivacion.strftime("%Y-%m-%d %H:%M") if d.fecha_derivacion else ""
        ) for d in hr.derivaciones
    ]

    movimientos_out = []
    if corr and corr.movimientos:
        movimientos_out = [
            MovimientoOut(
                id=m.id,
                tipo=m.tipo,
                descripcion=m.descripcion,
                usuario_nombre=m.usuario.nombre_completo if m.usuario else "Sistema",
                fecha=m.fecha.strftime("%Y-%m-%d %H:%M") if m.fecha else ""
            ) for m in corr.movimientos
        ]

    tiene_pdf = False
    if corr and corr.ruta_archivo_respuesta and os.path.exists(corr.ruta_archivo_respuesta):
        tiene_pdf = True

    out = CorrespondenciaOut(
        id=hr.id,
        numero_hr=hr.numero_hr,
        fecha_recepcion=hr.fecha_recepcion.strftime("%Y-%m-%d %H:%M") if hr.fecha_recepcion else "",
        usuario_recepcion=hr.usuario_recepcion.nombre_completo if hr.usuario_recepcion else "Ventanilla",
        tipo_remitente=hr.tipo_remitente,
        nombre_remitente=hr.nombre_remitente,
        cargo_remitente=hr.cargo_remitente,
        telefono_remitente=hr.telefono_remitente,
        cite_origen=hr.cite_origen,
        fecha_doc_origen=hr.fecha_doc_origen,
        tipo_documento=hr.tipo_documento,
        asunto=hr.asunto,
        nro_fojas=hr.nro_fojas,
        anexos=hr.anexos,
        unidad_actual_id=hr.unidad_actual_id,
        unidad_actual=hr.unidad_actual.nombre if hr.unidad_actual else "Unidad",
        estado_general=hr.estado_general,
        estado_correspondencia=corr.estado if corr else "PENDIENTE",
        acusado_por=corr.acusado_por.nombre_completo if (corr and corr.acusado_por) else None,
        fecha_acuse=corr.fecha_acuse.strftime("%Y-%m-%d %H:%M") if (corr and corr.fecha_acuse) else None,
        cite_respuesta=corr.cite_respuesta if corr else None,
        resumen_respuesta=corr.resumen_respuesta if corr else None,
        fecha_atencion=corr.fecha_atencion.strftime("%Y-%m-%d %H:%M") if corr and corr.fecha_atencion else None,
        tiene_pdf=tiene_pdf,
        proceso_id=proc.id if proc else None,
        derivaciones=derivaciones_out,
        movimientos=movimientos_out
    )

    return {"success": True, "data": out}

@router.post("/{hoja_ruta_id}/acusar-recibo")
def acusar_recibo_correspondencia(
    hoja_ruta_id: int,
    db: Session = Depends(get_db),
    usuario_actual: dict = Depends(obtener_usuario_actual)
):
    user_id = usuario_actual.get("user_id") or usuario_actual.get("sub")
    usuario_db = db.query(Usuario).filter(Usuario.id == int(user_id)).first()
    if not usuario_db:
        raise HTTPException(status_code=401, detail="Usuario inválido")

    hr = db.query(HojaRuta).filter(HojaRuta.id == hoja_ruta_id).first()
    if not hr:
        raise HTTPException(status_code=404, detail="Hoja de Ruta no encontrada")

    corr = hr.correspondencia
    if not corr:
        corr = Correspondencia(hoja_ruta_id=hr.id)
        db.add(corr)
        db.flush()

    corr.acusado_por_id = usuario_db.id
    corr.fecha_acuse = datetime.now()
    corr.estado = "EN_PROCESO"
    hr.estado_general = "EN_PROCESO"

    mov = CorrespondenciaMovimiento(
        correspondencia_id=corr.id,
        usuario_id=usuario_db.id,
        tipo="ACUSE",
        descripcion=f"Acuse de recibo confirmado digitalmente por {usuario_db.nombre_completo} ({usuario_db.cargo or 'Funcionario'}). Trámite pasa a estado EN PROCESO."
    )
    db.add(mov)

    db.commit()
    return {"success": True, "message": "Acuse de recibo confirmado. La correspondencia ahora está EN PROCESO."}

@router.post("/{hoja_ruta_id}/agregar-nota")
def agregar_nota_correspondencia(
    hoja_ruta_id: int,
    payload: NotaCrear,
    db: Session = Depends(get_db),
    usuario_actual: dict = Depends(obtener_usuario_actual)
):
    user_id = usuario_actual.get("user_id") or usuario_actual.get("sub")
    usuario_db = db.query(Usuario).filter(Usuario.id == int(user_id)).first()
    if not usuario_db:
        raise HTTPException(status_code=401, detail="Usuario inválido")

    hr = db.query(HojaRuta).filter(HojaRuta.id == hoja_ruta_id).first()
    if not hr:
        raise HTTPException(status_code=404, detail="Hoja de Ruta no encontrada")

    corr = hr.correspondencia
    if not corr:
        corr = Correspondencia(hoja_ruta_id=hr.id)
        db.add(corr)
        db.flush()

    mov = CorrespondenciaMovimiento(
        correspondencia_id=corr.id,
        usuario_id=usuario_db.id,
        tipo="NOTA",
        descripcion=payload.descripcion
    )
    db.add(mov)

    db.commit()
    return {"success": True, "message": "Nota de avance registrada en el historial."}

@router.post("/{hoja_ruta_id}/atender")
def atender_correspondencia(
    hoja_ruta_id: int,
    payload: CorrespondenciaAtender,
    db: Session = Depends(get_db),
    usuario_actual: dict = Depends(obtener_usuario_actual)
):
    user_id = usuario_actual.get("user_id") or usuario_actual.get("sub")
    usuario_db = db.query(Usuario).filter(Usuario.id == int(user_id)).first()

    hr = db.query(HojaRuta).filter(HojaRuta.id == hoja_ruta_id).first()
    if not hr:
        raise HTTPException(status_code=404, detail="Hoja de Ruta no encontrada")

    corr = hr.correspondencia
    if not corr:
        corr = Correspondencia(hoja_ruta_id=hr.id)
        db.add(corr)
        db.flush()

    corr.estado = "RESPONDIDO"
    corr.cite_respuesta = payload.cite_respuesta
    corr.resumen_respuesta = payload.resumen_respuesta
    if payload.ruta_archivo_respuesta:
        corr.ruta_archivo_respuesta = payload.ruta_archivo_respuesta
    corr.fecha_atencion = datetime.now()

    hr.estado_general = "RESPONDIDO"

    desc_mov = f"Correspondencia atendida y dada por concluida."
    if payload.cite_respuesta:
        desc_mov += f" CITE Respuesta: {payload.cite_respuesta}."
    desc_mov += f" Detalle: {payload.resumen_respuesta}"

    mov = CorrespondenciaMovimiento(
        correspondencia_id=corr.id,
        usuario_id=usuario_db.id if usuario_db else None,
        tipo="RESPUESTA",
        descripcion=desc_mov
    )
    db.add(mov)

    db.commit()
    return {"success": True, "message": "Correspondencia registrada como RESPONDIDA/CONCLUIDA."}

@router.post("/{hoja_ruta_id}/promover-contratacion")
def promover_a_proceso_contratacion(
    hoja_ruta_id: int,
    db: Session = Depends(get_db),
    usuario_actual: dict = Depends(obtener_usuario_actual)
):
    hr = db.query(HojaRuta).filter(HojaRuta.id == hoja_ruta_id).first()
    if not hr:
        raise HTTPException(status_code=404, detail="Hoja de Ruta no encontrada")

    if hr.proceso:
        return {
            "success": True,
            "message": "Esta Hoja de Ruta ya fue promovida a proceso de contratación.",
            "data": {"proceso_id": hr.proceso.id}
        }

    user_id = usuario_actual.get("user_id") or usuario_actual.get("sub")
    usuario_db = db.query(Usuario).filter(Usuario.id == int(user_id)).first()

    corr = hr.correspondencia
    if not corr:
        corr = Correspondencia(hoja_ruta_id=hr.id)
        db.add(corr)
        db.flush()

    # Crear Proceso de Contratación heredando la Hoja de Ruta
    nuevo_proceso = Proceso(
        codigo_proceso=hr.numero_hr,
        hoja_ruta=hr.numero_hr,
        objeto_contratacion=hr.asunto,
        desca_contextual=hr.asunto[:50],
        estado=EstadoProceso.EN_CURSO,
        ubicacion_actual="SOLICITANTE",
        unidad_solicitante_id=hr.unidad_actual_id,
        usuario_id=usuario_db.id if usuario_db else None,
        hoja_ruta_id=hr.id,
        monto_total=0.00
    )
    db.add(nuevo_proceso)
    
    # Actualizar estado de la Hoja de Ruta Madre
    hr.estado_general = "PROMOVIDO_A_COMPRA"
    corr.estado = "PROMOVIDO_A_COMPRA"

    mov = CorrespondenciaMovimiento(
        correspondencia_id=corr.id,
        usuario_id=usuario_db.id if usuario_db else None,
        tipo="PROMOCION",
        descripcion=f"Trámite promovido a Proceso de Contratación Directo (Carpeta de Compra iniciada)."
    )
    db.add(mov)

    db.commit()
    db.refresh(nuevo_proceso)

    return {
        "success": True,
        "message": f"Hoja de Ruta {hr.numero_hr} promovida exitosamente a Proceso de Contratación.",
        "data": {
            "proceso_id": nuevo_proceso.id,
            "codigo_proceso": nuevo_proceso.codigo_proceso
        }
    }

@router.get("/{hoja_ruta_id}/ver-pdf")
def ver_pdf_correspondencia(
    hoja_ruta_id: int,
    db: Session = Depends(get_db),
    token: Optional[str] = None
):
    """
    Sirve el PDF escaneado de una correspondencia.
    Acepta autenticación vía query param ?token=... para apertura en nueva pestaña del browser.
    """
    import jwt as pyjwt
    from app.core.config import settings
    if not token:
        raise HTTPException(status_code=401, detail="Token de acceso requerido")
    try:
        pyjwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except Exception:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")

    hr = db.query(HojaRuta).filter(HojaRuta.id == hoja_ruta_id).first()
    if not hr:
        raise HTTPException(status_code=404, detail="Hoja de Ruta no encontrada")

    corr = hr.correspondencia
    if not corr or not corr.ruta_archivo_respuesta:
        raise HTTPException(status_code=404, detail="Esta correspondencia no tiene documento adjunto")

    ruta = corr.ruta_archivo_respuesta
    if not os.path.exists(ruta):
        raise HTTPException(status_code=404, detail="El archivo PDF ya no está disponible en el servidor")

    return FileResponse(
        path=ruta,
        media_type="application/pdf",
        filename=os.path.basename(ruta)
    )
