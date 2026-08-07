from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import func, or_, case, extract
from sqlalchemy.orm import Session, joinedload
from typing import Optional
from docx2pdf import convert
from io import BytesIO
import pythoncom
import os
import shutil
import zipfile


from app.core.base_datos import get_db
from app.core.seguridad import obtener_usuario_actual
from app.core.config import MATRIZ_REQUISITOS
from app.models.tablas_transaccionales import Proceso, ItemProceso, EstadoProceso, GastoProceso, DocumentoProceso, EstadoDocumento
from app.models.tablas_base import Proyecto, Unidad, Proveedor, Usuario
from app.schemas.proceso import ProcesoCreate, PayloadDocumento, ProcesoUpdate, FusionPayload
from app.services.generador_documentos import orquestar_generacion_documento

def evaluar_estado_proceso(proceso):
    if proceso.estado == EstadoProceso.ANULADO:
        return 
        
    # Extraemos claves únicas
    docs_generados = {doc.clave_documento for doc in proceso.documentos if doc.estado == EstadoDocumento.FINALIZADO}
    
    # Lógica de equivalencia: Si el usuario hizo ambos almacenes, se marca el paso "almacenes" como cumplido
    if "ingreso_almacenes" in docs_generados and "salida_almacenes" in docs_generados:
        docs_generados.add("almacenes")
    
    requeridos = MATRIZ_REQUISITOS["ESTANDAR"]
    
    # Evaluación
    if not docs_generados:
        proceso.estado = EstadoProceso.BORRADOR
    elif requeridos.issubset(docs_generados):
        proceso.estado = EstadoProceso.FINALIZADO
    # Si ya tienen el informe de conformidad pero faltan otros, el proceso está "atascado" (Con Pendientes)
    elif "informe_conformidad" in docs_generados:
        proceso.estado = EstadoProceso.CON_PENDIENTES
    else:
        proceso.estado = EstadoProceso.EN_CURSO

# El prefix maneja la ruta base, así mantenemos los endpoints limpios
router = APIRouter(
    prefix="/api/procesos", 
    tags=["Procesos y Hoja de Ruta"],
    dependencies=[Depends(obtener_usuario_actual)] 
)

@router.get("/")
def listar_procesos(unidad_id: Optional[int] = None, db: Session = Depends(get_db), usuario_actual: dict = Depends(obtener_usuario_actual)):
    # Cargamos también la relación con la Unidad
    query = db.query(Proceso).options(
        joinedload(Proceso.documentos),
        joinedload(Proceso.unidad_solicitante)
    ).filter(Proceso.activo == True)

    if unidad_id:
        query = query.filter(Proceso.unidad_solicitante_id == unidad_id)
    
    if usuario_actual.get("rol") == "SOLICITANTE":
        user_id = usuario_actual.get("user_id")
        usuario_db = db.query(Usuario).filter(Usuario.id == int(user_id)).first()
        
        if usuario_db and usuario_db.unidad_id:
            query = query.filter(
                or_(
                    Proceso.usuario_id == int(user_id),
                    Proceso.unidad_solicitante_id == usuario_db.unidad_id
                )
            )
        else:
            query = query.filter(Proceso.usuario_id == int(user_id))
    
    procesos_db = query.all()
        
    resultado = []
    for p in procesos_db:
        estado_str = p.estado.value if hasattr(p.estado, 'value') else p.estado
        
        docs_fin = [
            d.clave_documento for d in p.documentos 
            if (d.estado.value if hasattr(d.estado, 'value') else d.estado) == "FINALIZADO"
        ]
        
        fecha_iso = p.fecha_creacion.isoformat() if p.fecha_creacion else None
        resultado.append({
            "id": p.id,
            "codigo_proceso": p.codigo_proceso,
            "hoja_ruta": p.hoja_ruta,
            "objeto_contratacion": p.objeto_contratacion,
            "estado": estado_str,
            "unidad_solicitante": p.unidad_solicitante.nombre if p.unidad_solicitante else (p.distrito_comunidad or "Ventanilla / Sin Asignar"),
            "monto_total": float(p.monto_total) if p.monto_total else 0.0,
            "monto_adjudicado": float(p.monto_adjudicado) if p.monto_adjudicado else None,
            "retencion_monto": float(p.retencion_monto) if p.retencion_monto else 0.0,
            "tipo_contratacion": p.tipo_contratacion,
            "docs_finalizados": docs_fin,
            "fecha_creacion": fecha_iso,
            "fecha_solicitud": fecha_iso
        })
        
    return resultado


@router.get("/dashboard")
def obtener_estadisticas_dashboard(db: Session = Depends(get_db), usuario_actual: dict = Depends(obtener_usuario_actual)):
    rol = usuario_actual.get("rol")
    user_id = usuario_actual.get("user_id")
    
    # 1. CONTEO BÁSICO DE ESTADOS (Con filtro de privacidad)
    query_estados = db.query(Proceso.estado, func.count(Proceso.id)).filter(Proceso.activo == True)
    
    if rol == "SOLICITANTE":
        if not user_id:
            raise HTTPException(status_code=401, detail="Usuario no identificado.")
            
        usuario_db = db.query(Usuario).filter(Usuario.id == int(user_id)).first()
        
        if usuario_db and usuario_db.unidad_id:
            query_estados = query_estados.filter(
                or_(
                    Proceso.usuario_id == int(user_id),
                    Proceso.unidad_solicitante_id == usuario_db.unidad_id
                )
            )
        else:
            query_estados = query_estados.filter(Proceso.usuario_id == int(user_id))

    conteos = query_estados.group_by(Proceso.estado).all()
    
    stats = {
        "total": 0, "BORRADOR": 0, "EN CURSO": 0, "CON PENDIENTES": 0, "FINALIZADO": 0, "ANULADO": 0
    }
    
    for estado, cantidad in conteos:
        if estado.value in stats:
            stats[estado.value] = cantidad
        stats["total"] += cantidad
        
    response_data = {"conteos": stats}

    # 2. MÉTRICAS AVANZADAS (Exclusivo para alta gerencia: ADMIN, RPC, PRESUPUESTO)
    if rol in ["ADMIN", "RPC", "PRESUPUESTO"]:
        # A. Presupuesto Total Solicitado
        presupuesto_sol_db = db.query(func.sum(Proceso.monto_total))\
            .filter(Proceso.activo == True, Proceso.estado != EstadoProceso.ANULADO).scalar()
            
        # B. Presupuesto Total Adjudicado
        presupuesto_ejecutado_db = db.query(func.sum(Proceso.monto_adjudicado))\
            .filter(Proceso.activo == True, Proceso.monto_adjudicado.isnot(None)).scalar()

        sol_val = float(presupuesto_sol_db or 0)
        ejec_val = float(presupuesto_ejecutado_db or 0)
        ahorro_val = max(0.0, sol_val - ejec_val) if ejec_val > 0 else 0.0

        # C. SLA Real: Promedio de días entre creación y última actualización (solo finalizados)
        from datetime import datetime
        finalizados_con_fechas = db.query(Proceso.fecha_creacion, Proceso.fecha_actualizacion)\
            .filter(
                Proceso.activo == True,
                Proceso.estado == EstadoProceso.FINALIZADO,
                Proceso.fecha_creacion.isnot(None),
                Proceso.fecha_actualizacion.isnot(None)
            ).all()
        
        if finalizados_con_fechas:
            total_dias = 0.0
            count_valid = 0
            for fc, fa in finalizados_con_fechas:
                delta = (fa - fc).total_seconds() / 86400.0  # Convertir a días
                if delta >= 0:
                    total_dias += delta
                    count_valid += 1
            sla_real = round(total_dias / count_valid, 1) if count_valid > 0 else None
        else:
            sla_real = None

        # D. Total de Retenciones Acumuladas (7% retenido a proveedores)
        retenciones_db = db.query(func.sum(Proceso.retencion_monto))\
            .filter(Proceso.activo == True, Proceso.retencion_monto.isnot(None),
                    Proceso.estado != EstadoProceso.ANULADO).scalar()
        total_retenciones = float(retenciones_db or 0)
            
        # E. Carga por Unidad Solicitante
        unidades_conteo = db.query(Unidad.nombre, func.count(Proceso.id))\
            .join(Proceso, Unidad.id == Proceso.unidad_solicitante_id)\
            .filter(Proceso.activo == True, Proceso.estado != EstadoProceso.FINALIZADO)\
            .group_by(Unidad.nombre).all()

        # F. Partidas POA más afectadas
        top_partidas_db = db.query(GastoProceso.partida, GastoProceso.descripcion, func.sum(GastoProceso.monto))\
            .join(Proceso, Proceso.id == GastoProceso.proceso_id)\
            .filter(Proceso.activo == True, Proceso.estado != EstadoProceso.ANULADO)\
            .group_by(GastoProceso.partida, GastoProceso.descripcion)\
            .order_by(func.sum(GastoProceso.monto).desc()).limit(5).all()

        # G. Ranking Proveedores Adjudicados
        top_prov_db = db.query(Proveedor.razon_social, func.count(Proceso.id), func.sum(Proceso.monto_adjudicado))\
            .join(Proceso, Proveedor.id == Proceso.proveedor_id)\
            .filter(Proceso.activo == True, Proceso.monto_adjudicado.isnot(None))\
            .group_by(Proveedor.razon_social)\
            .order_by(func.sum(Proceso.monto_adjudicado).desc()).limit(5).all()

        # H. Índice de Efectividad: % de trámites que llegan a FINALIZADO sin ser anulados
        total_no_borrador = db.query(func.count(Proceso.id))\
            .filter(Proceso.activo == True, Proceso.estado != EstadoProceso.BORRADOR).scalar() or 0
        total_finalizados = stats.get("FINALIZADO", 0)
        total_anulados = stats.get("ANULADO", 0)
        indice_efectividad = round((total_finalizados / total_no_borrador) * 100, 1) if total_no_borrador > 0 else 0.0

        # I. Distribución por Tipo de Contratación
        tipos_db = db.query(Proceso.tipo_contratacion, func.count(Proceso.id))\
            .filter(Proceso.activo == True, Proceso.estado != EstadoProceso.ANULADO,
                    Proceso.tipo_contratacion.isnot(None))\
            .group_by(Proceso.tipo_contratacion).all()
            
        response_data["metricas_globales"] = {
            "presupuesto_solicitado": sol_val,
            "presupuesto_ejecutado": ejec_val,
            "ahorro_acumulado": ahorro_val,
            "sla_promedio_dias": sla_real,
            "total_retenciones": total_retenciones,
            "indice_efectividad": indice_efectividad,
            "total_finalizados": total_finalizados,
            "total_anulados": total_anulados,
            "carga_por_unidad": [{"unidad": u[0], "cantidad": u[1]} for u in unidades_conteo],
            "top_partidas": [{"partida": p[0], "descripcion": p[1], "monto": float(p[2] or 0)} for p in top_partidas_db],
            "ranking_proveedores": [{"proveedor": pr[0], "contratos": pr[1], "monto": float(pr[2] or 0)} for pr in top_prov_db] if top_prov_db else [],
            "distribucion_tipo_contratacion": [{"tipo": t[0], "cantidad": t[1]} for t in tipos_db] if tipos_db else []
        }
        
    return {
        "success": True,
        "data": response_data
    }

@router.post("/")
def crear_proceso(datos: ProcesoCreate, db: Session = Depends(get_db), usuario_actual: dict = Depends(obtener_usuario_actual)):
    try:
        ui = datos.variables_ui
        user_id = usuario_actual.get("user_id")
        rol_usuario = usuario_actual.get("rol")
            
        proyecto_db = db.query(Proyecto).filter(Proyecto.codigo_proyecto == getattr(ui, "cod_proy", "")).first()
        proy_id = proyecto_db.id if proyecto_db else None
        
        # --- NUEVA LÓGICA DE ASIGNACIÓN DE UNIDAD POR ROL ---
        uni_id = None
        
        if rol_usuario == "SOLICITANTE":
            # 1. Si es técnico, ignoramos el frontend y le asignamos SU propia unidad
            usuario_db = db.query(Usuario).filter(Usuario.id == int(user_id)).first()
            if usuario_db:
                uni_id = usuario_db.unidad_id
        else:
            # 2. Si es SECRETARIA o ADMIN, respetamos a quién derivó en el select
            uni_solic_val = str(getattr(ui, "uni_solic", "")).strip()
            unidad_db = None
            if uni_solic_val.isdigit():
                unidad_db = db.query(Unidad).filter(Unidad.id == int(uni_solic_val), Unidad.activo == True).first()
            elif uni_solic_val:
                unidad_db = db.query(Unidad).filter(Unidad.nombre == uni_solic_val, Unidad.activo == True).first()
            
            uni_id = unidad_db.id if unidad_db else None

        nuevo_proceso = Proceso(
            codigo_proceso=ui.hoja_ruta or ui.codigo,
            hoja_ruta=ui.hoja_ruta,
            nro_orden=ui.n_orden,
            objeto_contratacion=ui.objeto,
            desca_contextual=ui.objeto[:50] if ui.objeto else "",
            tipo_pago=ui.tipo_pago,
            tipo_contratacion=ui.tipo_contratacion,
            plazo_entrega=ui.plazo,
            monto_total=ui.monto_total,
            retencion_monto=ui.retencion_val,
            responsable_presupuesto=ui.enc_finanzas,
            distrito_comunidad = ui.distrito_comunidad,
            fecha_solicitud = ui.fecha_corta,
            tecnico_solicitante=ui.nom_tecnico,
            cargo_tecnico_solicitante=ui.cargo_tecnico,
            proyecto_id=proy_id,           
            unidad_solicitante_id=uni_id,  
            proveedor_id=None,
            usuario_id=int(user_id), # <--- SE GUARDA AQUÍ
            estado=EstadoProceso.EN_CURSO 
        )
        
        db.add(nuevo_proceso)
        db.flush()

        for item in datos.items:
            nuevo_item = ItemProceso(
                proceso_id=nuevo_proceso.id,
                nro_item=item.nro_item,
                objeto_corto=item.objeto_corto,
                descripcion_larga=item.descripcion_larga,
                unidad=item.unidad,
                cantidad=item.cantidad,
                precio_unitario=item.precio_unitario,
                total_item=item.total_item
            )
            db.add(nuevo_item)

        for gasto in datos.gastos:
            nuevo_gasto = GastoProceso(
                proceso_id=nuevo_proceso.id,
                partida=gasto.partida,
                prog=gasto.prog,
                proy=gasto.proy,
                act=gasto.act,
                ff=gasto.ff,
                of=gasto.of,
                descripcion=gasto.descripcion,
                monto=gasto.monto
            )
            db.add(nuevo_gasto)

        db.commit()

        db.refresh(nuevo_proceso)
        
        return {
            "success": True, 
            "message": "Proceso creado correctamente.",
            "data": {"proceso_id": nuevo_proceso.id}
        }

    except Exception as e:
        db.rollback() 
        raise HTTPException(status_code=500, detail=f"Error crítico al guardar: {str(e)}")

@router.post("/fusionar")
def fusionar_procesos(payload: FusionPayload, db: Session = Depends(get_db)):
    if len(payload.ids_origen) < 2:
        raise HTTPException(status_code=400, detail="Debe seleccionar al menos 2 trámites para fusionar.")

    # 1. Recuperamos los procesos originales
    procesos_origen = db.query(Proceso).filter(Proceso.id.in_(payload.ids_origen)).all()
    if not procesos_origen:
        raise HTTPException(status_code=404, detail="Procesos no encontrados.")

    # Usamos al primer proceso como base para heredar unidad, usuario, proyecto, etc.
    base = procesos_origen[0]

    # 2. Creamos el Proceso Maestro
    nuevo_proceso = Proceso(
        codigo_proceso=payload.hoja_ruta_master,
        hoja_ruta=payload.hoja_ruta_master,
        objeto_contratacion=payload.objeto_unificado,
        desca_contextual=payload.objeto_unificado[:50],
        estado=EstadoProceso.EN_CURSO,
        ubicacion_actual=base.ubicacion_actual,
        proveedor_id=base.proveedor_id,
        proyecto_id=base.proyecto_id,
        unidad_solicitante_id=base.unidad_solicitante_id,
        usuario_id=base.usuario_id,
        monto_total=0.00 # Se calculará cuando llenen las especificaciones
    )
    
    db.add(nuevo_proceso)
    db.commit()
    db.refresh(nuevo_proceso)

    # 3. Traslado Físico Documental (Fusionar PDFs de solicitudes)
    ruta_maestro = os.path.join("Resultados", f"Proceso_{nuevo_proceso.id}")
    os.makedirs(ruta_maestro, exist_ok=True)

    # Recolectamos todos los PDFs de solicitud de los procesos originales
    pdfs_solicitud = []
    
    for p in procesos_origen:
        ruta_origen = os.path.join("Resultados", f"Proceso_{p.id}")
        if os.path.exists(ruta_origen):
            for archivo in sorted(os.listdir(ruta_origen)):
                if archivo.endswith(".pdf"):
                    src_file = os.path.join(ruta_origen, archivo)
                    pdfs_solicitud.append(src_file)
                    # También copiamos cada PDF individualmente como anexo para trazabilidad
                    dst_anexo = os.path.join(ruta_maestro, f"Solicitud_Anexada_{p.hoja_ruta or p.id}_{archivo}")
                    shutil.copy2(src_file, dst_anexo)

    # Fusionamos todos los PDFs en un solo documento unificado
    if pdfs_solicitud:
        try:
            from pypdf import PdfWriter, PdfReader
            writer = PdfWriter()
            for pdf_path in pdfs_solicitud:
                reader = PdfReader(pdf_path)
                for page in reader.pages:
                    writer.add_page(page)
            ruta_pdf_unificado = os.path.join(ruta_maestro, f"0_Solicitud_Inicial_{nuevo_proceso.id}.pdf")
            with open(ruta_pdf_unificado, "wb") as output_file:
                writer.write(output_file)
            print(f"[FUSION] PDF unificado creado con {len(writer.pages)} páginas desde {len(pdfs_solicitud)} archivos")
        except Exception as e:
            print(f"[FUSION ERROR] Error al fusionar PDFs: {e}")
            # Si la fusión de PDFs falla, al menos copiamos el primer PDF como solicitud principal
            if pdfs_solicitud:
                shutil.copy2(pdfs_solicitud[0], os.path.join(ruta_maestro, f"0_Solicitud_Inicial_{nuevo_proceso.id}.pdf"))

    for p in procesos_origen:
        # 4. Cambiamos estado de los hijos y marcamos trazabilidad
        p.estado = EstadoProceso.ANULADO # O crea un EstadoProceso.FUSIONADO en tu Enum
        p.fusionado_en_id = nuevo_proceso.id
    
    db.commit()
    
    return {"message": "Fusión exitosa", "proceso_maestro_id": nuevo_proceso.id}


@router.put("/{proceso_id}")
def actualizar_proceso(proceso_id: int, datos: ProcesoUpdate, db: Session = Depends(get_db)):
    try:
        # 1. Verificar que el proceso exista
        proceso = db.query(Proceso).filter(Proceso.id == proceso_id, Proceso.activo == True).first()
        if not proceso:
            raise HTTPException(status_code=404, detail="Proceso no encontrado")

        if proceso.estado == EstadoProceso.ANULADO:
            raise HTTPException(status_code=400, detail="Este trámite ha sido ANULADO / FUSIONADO y no se puede modificar.")

        ui = datos.variables_ui

        # 2. Re-validar relaciones de llaves foráneas (Proyecto y Unidad)
        proyecto_db = db.query(Proyecto).filter(Proyecto.codigo_proyecto == ui.cod_proy).first()
        unidad_db = db.query(Unidad).filter(Unidad.nombre == ui.uni_solic).first()

        # 3. Actualizar campos escalares (Los datos principales del trámite)
        proceso.codigo_proceso = ui.codigo
        proceso.nro_orden = ui.n_orden
        proceso.objeto_contratacion = ui.objeto
        proceso.desca_contextual = ui.desca
        proceso.tipo_pago = ui.tipo_pago
        proceso.tipo_contratacion = ui.tipo_contratacion
        proceso.plazo_entrega = ui.plazo
        proceso.monto_total = ui.monto_total
        proceso.retencion_monto = ui.retencion_val
        proceso.responsable_presupuesto = ui.enc_finanzas
        proceso.distrito_comunidad = ui.distrito_comunidad
        proceso.fecha_solicitud = ui.fecha_corta
        proceso.tecnico_solicitante = ui.nom_tecnico
        proceso.cargo_tecnico_solicitante = ui.cargo_tecnico
        
        proceso.proyecto_id = proyecto_db.id if proyecto_db else None
        proceso.unidad_solicitante_id = unidad_db.id if unidad_db else None

        # 4. Reemplazar Ítems (Eliminación en bloque e inserción)
        db.query(ItemProceso).filter(ItemProceso.proceso_id == proceso_id).delete()
        for item in datos.items:
            nuevo_item = ItemProceso(
                proceso_id=proceso_id,
                nro_item=item.nro_item,
                objeto_corto=item.objeto_corto,
                descripcion_larga=item.descripcion_larga,
                unidad=item.unidad,
                cantidad=item.cantidad,
                precio_unitario=item.precio_unitario,
                total_item=item.total_item
            )
            db.add(nuevo_item)

        # 5. Reemplazar Gastos (Eliminación en bloque e inserción)
        db.query(GastoProceso).filter(GastoProceso.proceso_id == proceso_id).delete()
        for gasto in datos.gastos:
            nuevo_gasto = GastoProceso(
                proceso_id=proceso_id,
                partida=gasto.partida,
                prog=gasto.prog,
                proy=gasto.proy,
                act=gasto.act,
                ff=gasto.ff,
                of=gasto.of,
                descripcion=gasto.descripcion,
                monto=gasto.monto
            )
            db.add(nuevo_gasto)

        # Guardar en base de datos
        db.commit()

        return {
            "success": True, 
            "message": "Trámite actualizado correctamente. Los próximos documentos generados tomarán esta nueva información."
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error crítico al actualizar el trámite: {str(e)}")

@router.get("/{proceso_id}")
def obtener_proceso_individual(proceso_id: int, db: Session = Depends(get_db)):
    proceso = db.query(Proceso).filter(Proceso.id == proceso_id, Proceso.activo == True).first()
    
    if not proceso:
        raise HTTPException(status_code=404, detail="Proceso no encontrado")
        
    return {
        "id": proceso.id,
        "codigo_proceso": proceso.codigo_proceso,
        "nro_orden": proceso.nro_orden,
        "objeto_contratacion": proceso.objeto_contratacion,
        "estado": proceso.estado.value if hasattr(proceso.estado, 'value') else proceso.estado,
        "monto_total": proceso.monto_total,
        "monto_adjudicado": proceso.monto_adjudicado,
        "retencion_monto": proceso.retencion_monto,
        "plazo_entrega": proceso.plazo_entrega,
        "tipo_contratacion": proceso.tipo_contratacion,
        "distrito_comunidad": proceso.distrito_comunidad,
        "tecnico_solicitante": proceso.tecnico_solicitante,
        "cargo_tecnico_solicitante": proceso.cargo_tecnico_solicitante,
        "unidad_solicitante": proceso.unidad_solicitante.nombre if proceso.unidad_solicitante else None,
        "proveedor_id": proceso.proveedor_id,
        "fecha_creacion": proceso.fecha_creacion.isoformat() if proceso.fecha_creacion else None,
        "fecha_solicitud": proceso.fecha_creacion.isoformat() if proceso.fecha_creacion else None,
        # INYECCIÓN DE DATOS RELACIONALES PARA EL EXPEDIENTE
        "items": [
            {
                "nro_item": item.nro_item,
                "objeto_corto": item.objeto_corto,
                "descripcion_larga": item.descripcion_larga,
                "unidad": item.unidad,
                "cantidad": item.cantidad,
                "precio_unitario": item.precio_unitario,
                "total_item": item.total_item
            } for item in proceso.items
        ],
        "gastos": [
            {
                "id": gasto.id,
                "partida": gasto.partida,
                "prog": gasto.prog,
                "proy": gasto.proy,
                "act": gasto.act,
                "ff": gasto.ff,
                "of": gasto.of,
                "descripcion": gasto.descripcion,
                "monto": gasto.monto
            } for gasto in proceso.gastos
        ],
        "documentos": [
            {
                "id": doc.id,
                "clave_documento": doc.clave_documento,
                "estado": doc.estado.value if hasattr(doc.estado, 'value') else doc.estado,
                "datos_formulario": doc.datos_formulario,
                "ruta_archivo": doc.ruta_archivo
            } for doc in proceso.documentos
        ]

    }

@router.post("/{proceso_id}/documentos")
def guardar_datos_documento(proceso_id: int, payload: PayloadDocumento, db: Session = Depends(get_db), usuario_actual: dict = Depends(obtener_usuario_actual)):
    proceso = db.query(Proceso).filter(Proceso.id == proceso_id).first()
    if not proceso:
        raise HTTPException(status_code=404, detail="Proceso no encontrado")

    if proceso.estado == EstadoProceso.ANULADO:
        raise HTTPException(status_code=400, detail="Este trámite ha sido ANULADO / FUSIONADO y no admite generación o modificación de documentos.")

    if payload.clave_documento == "especificaciones_tecnicas":
        # 1. Actualizar nombre oficial
        nuevo_nombre = payload.datos_formulario.get("nuevo_objeto_contratacion")
        if nuevo_nombre:
            proceso.objeto_contratacion = nuevo_nombre
            proceso.desca_contextual = nuevo_nombre[:50]

        # 2. Poblar la tabla ItemProceso para que los demás pasos hereden
        items_tecnicos = payload.datos_formulario.get("items_tecnicos", [])
        if items_tecnicos:
            db.query(ItemProceso).filter(ItemProceso.proceso_id == proceso_id).delete()
            for item in items_tecnicos:
                nuevo_item = ItemProceso(
                    proceso_id=proceso_id,
                    nro_item=item.get("nro", 0),
                    objeto_corto=item.get("objeto", ""),
                    descripcion_larga=item.get("descripcion", ""),
                    unidad=item.get("tipuni", ""),
                    cantidad=item.get("cant", 0),
                    precio_unitario=item.get("precio_unitario", 0),
                    total_item=item.get("total_item", 0)
                )
                db.add(nuevo_item)
            
            # Forzamos la actualización del monto total
            proceso.monto_total = sum(float(item.get("total_item", 0)) for item in items_tecnicos)

    if payload.clave_documento == "solicitud_cp":
        
        # 1. Guardar Estructura de Gastos (POA)
        gastos_payload = payload.datos_formulario.get("gastos", [])
        if gastos_payload:
            db.query(GastoProceso).filter(GastoProceso.proceso_id == proceso_id).delete()
            for g in gastos_payload:
                nuevo_gasto = GastoProceso(
                    proceso_id=proceso_id,
                    partida=g.get("partida", ""),
                    prog=g.get("prog", ""),
                    proy=g.get("proy", ""),
                    act=g.get("act", ""),
                    ff=g.get("ff", ""),
                    of=g.get("of", ""),
                    descripcion=g.get("descripcion", ""),
                    monto=g.get("monto", 0)
                )
                db.add(nuevo_gasto)

        # 2. Guardar variables globales del trámite
        fecha_doc = payload.datos_formulario.get("fecha_documento")
        if fecha_doc:
            proceso.fecha_solicitud = fecha_doc
            
        distrito_doc = payload.datos_formulario.get("distrito_comunidad")
        if distrito_doc is not None:
            proceso.distrito_comunidad = distrito_doc

        enc_finanzas_doc = payload.datos_formulario.get("encargado_presupuesto") or payload.datos_formulario.get("enc_finanzas")
        if enc_finanzas_doc:
            proceso.responsable_presupuesto = enc_finanzas_doc

    # Guardado de Asignación Financiera FF-OF en la base de datos (Paso 2)
    if payload.clave_documento == "cert_presupuestaria" and "gastos" in payload.datos_formulario:
        for g_data in payload.datos_formulario["gastos"]:
            g_id = g_data.get("id")
            if g_id:
                gasto_db = db.query(GastoProceso).filter(GastoProceso.id == g_id, GastoProceso.proceso_id == proceso_id).first()
                if gasto_db:
                    gasto_db.ff = g_data.get("ff", "")
                    gasto_db.of = g_data.get("of", "")

    if payload.clave_documento == "notificacion_adjudicacion":
        monto_ret = payload.datos_formulario.get("monto_retencion")
        plazo = payload.datos_formulario.get("plazo_entrega")
        
        if monto_ret is not None:
            proceso.retencion_monto = monto_ret
        if plazo is not None:
            proceso.plazo_entrega = plazo

    # NUEVO: Registro dinámico de Proveedor y asignación al Proceso (Paso 5)
    if payload.clave_documento == "informe_cotizacion":
        razon_social = payload.datos_formulario.get("proveedor_ganador")
        nit = payload.datos_formulario.get("nit_ganador")
        monto_adj = payload.datos_formulario.get("monto_adjudicado")
        
        if razon_social:
            proveedor_db = db.query(Proveedor).filter(Proveedor.razon_social == razon_social).first()
            if not proveedor_db:
                proveedor_db = Proveedor(razon_social=razon_social, nit_ci=nit or "S/N")
                db.add(proveedor_db)
                db.flush() 
            elif nit and nit != "S/N" and (not proveedor_db.nit_ci or proveedor_db.nit_ci == "S/N"):
                proveedor_db.nit_ci = nit
            
            proceso.proveedor_id = proveedor_db.id
            
        if monto_adj is not None:
            proceso.monto_adjudicado = monto_adj

    # ---> INSERTA ESTE NUEVO BLOQUE AQUÍ <---
    if payload.clave_documento == "orden_compra":
        direccion = payload.datos_formulario.get("direccion")
        telefono = payload.datos_formulario.get("telefono")
        nro_orden = payload.datos_formulario.get("nro_orden")
        nit_ci = payload.datos_formulario.get("nit")
        
        if nro_orden:
            proceso.nro_orden = nro_orden
            
        if proceso.proveedor_id:
            prov = db.query(Proveedor).filter(Proveedor.id == proceso.proveedor_id).first()
            if prov:
                if direccion: prov.direccion = direccion
                if telefono: prov.telefono = telefono
                # Si editaron el NIT (ya no es S/N), se actualiza en el catálogo de proveedores
                if nit_ci and nit_ci != "S/N": prov.nit_ci = nit_ci

                
    doc_db = db.query(DocumentoProceso).filter(
        DocumentoProceso.proceso_id == proceso_id,
        DocumentoProceso.clave_documento == payload.clave_documento
    ).first()

    estado_enum = EstadoDocumento.BORRADOR if payload.estado == "BORRADOR" else EstadoDocumento.FINALIZADO

    if doc_db:
        doc_db.datos_formulario = payload.datos_formulario
        doc_db.estado = estado_enum
    else:
        doc_db = DocumentoProceso(
            proceso_id=proceso_id,
            clave_documento=payload.clave_documento,
            estado=estado_enum,
            datos_formulario=payload.datos_formulario
        )
        db.add(doc_db)

    if not proceso.tecnico_solicitante and payload.clave_documento in ["especificaciones_tecnicas", "solicitud_cp"]:
        user_id = usuario_actual.get("user_id") or usuario_actual.get("sub")
        if user_id:
            usuario_db = db.query(Usuario).filter(Usuario.id == int(user_id)).first()
            if usuario_db:
                titulo = f"{usuario_db.titulo.strip()} " if usuario_db.titulo else ""
                proceso.tecnico_solicitante = f"{titulo}{usuario_db.nombre_completo}"
                proceso.cargo_tecnico_solicitante = usuario_db.cargo
    
    db.flush() # Obliga a BD a registrar el documento temporalmente en la sesión
    evaluar_estado_proceso(proceso)

    db.commit()

    if estado_enum == EstadoDocumento.FINALIZADO:
        try:
            orquestar_generacion_documento(proceso_id, payload.clave_documento, db)
        except PermissionError:
            raise HTTPException(status_code=409, detail="Cierre el archivo de Word antes de emitir.")

    return {"success": True, "estado": payload.estado}

@router.get("/{proceso_id}/documentos/{tipo_documento}")
def descargar_documento_individual(
    proceso_id: int, 
    tipo_documento: str, 
    formato: Optional[str] = "word",
    fecha_corta: Optional[str] = None, 
    fecha_larga: Optional[str] = None, 
    db: Session = Depends(get_db)
):
    try:
        ruta_word_relativa = orquestar_generacion_documento(proceso_id, tipo_documento, db, fecha_corta, fecha_larga)
        
        if not ruta_word_relativa:
            raise HTTPException(status_code=500, detail="El orquestador no devolvió ninguna ruta de archivo.")

        ruta_word = os.path.abspath(str(ruta_word_relativa).strip())
        
        if not os.path.exists(ruta_word):
            raise HTTPException(status_code=500, detail="El archivo se generó pero no se encuentra en el disco duro.")
            
        if formato == "word":
            # Si el documento es un Excel, ajustamos el tipo MIME para que el navegador lo entienda
            is_excel = ruta_word.lower().endswith(".xlsx")
            m_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" if is_excel else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            
            return FileResponse(
                path=ruta_word, 
                filename=os.path.basename(ruta_word),
                media_type=m_type
            )
            
        elif formato == "pdf":
            # Extraemos el nombre y le clavamos la extensión .pdf
            ruta_pdf = os.path.splitext(ruta_word)[0] + ".pdf"
            
            # CACHÉ INTELIGENTE: Si el PDF ya existe y no es más viejo que el origen, se retorna directo (instantáneo)
            if os.path.exists(ruta_pdf) and os.path.exists(ruta_word):
                if os.path.getmtime(ruta_pdf) >= os.path.getmtime(ruta_word):
                    return FileResponse(
                        path=ruta_pdf, 
                        filename=os.path.basename(ruta_pdf),
                        media_type="application/pdf"
                    )

            abs_origen = os.path.abspath(ruta_word)
            abs_destino = os.path.abspath(ruta_pdf)
            
            pythoncom.CoInitialize()
            try:
                # MOTOR 1: Si es Word
                if ruta_word.lower().endswith(".docx"):
                    from docx2pdf import convert
                    convert(abs_origen, abs_destino)
                
                # MOTOR 2: Si es Excel (Ultra-robusto con rutas absolutas y cierre garantizado)
                elif ruta_word.lower().endswith(".xlsx"):
                    import win32com.client
                    excel = None
                    wb = None
                    try:
                        excel = win32com.client.Dispatch("Excel.Application")
                        excel.Visible = False
                        excel.DisplayAlerts = False
                        wb = excel.Workbooks.Open(abs_origen)
                        wb.ExportAsFixedFormat(0, abs_destino)
                    finally:
                        if wb:
                            try: wb.Close(False)
                            except Exception: pass
                        if excel:
                            try: excel.Quit()
                            except Exception: pass
                
                else:
                    raise HTTPException(status_code=500, detail=f"No hay motor PDF para este formato: {ruta_word}")
            except Exception as ex:
                raise HTTPException(status_code=500, detail=f"Error convirtiendo a PDF: {str(ex)}")
            finally:
                pythoncom.CoUninitialize() 
                
            if not os.path.exists(ruta_pdf):
                raise HTTPException(status_code=500, detail="Falló la conversión a PDF mediante COM.")
                
            return FileResponse(
                path=ruta_pdf, 
                filename=os.path.basename(ruta_pdf),
                media_type="application/pdf"
            )
            
        else:
            raise HTTPException(status_code=400, detail="Formato no soportado.")
            
    except Exception as e:
        print("=== ERROR CRÍTICO EN GENERACIÓN ===")
        import traceback
        traceback.print_exc()
        print("===================================")
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

    

@router.post("/{proceso_id}/subir-solicitud")
async def subir_pdf_solicitud(proceso_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    proceso = db.query(Proceso).filter(Proceso.id == proceso_id).first()
    if not proceso:
        raise HTTPException(status_code=404, detail="Proceso no encontrado en la base de datos.")

    if proceso.estado == EstadoProceso.ANULADO:
        raise HTTPException(status_code=400, detail="Este trámite ha sido ANULADO / FUSIONADO y no permite la subida de nuevos archivos.")

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="El archivo adjunto debe ser estrictamente un PDF.")

    # Guardamos directamente en su expediente (Resultados/Proceso_X/)
    directorio = f"Resultados/Proceso_{proceso_id}"
    os.makedirs(directorio, exist_ok=True)

    ruta_guardado = os.path.join(directorio, f"0_Solicitud_Inicial_{proceso_id}.pdf")

    with open(ruta_guardado, "wb") as buffer:
        import shutil
        shutil.copyfileobj(file.file, buffer)

    return {"success": True, "message": "Archivo PDF resguardado.", "ruta_pdf": ruta_guardado}

@router.get("/{proceso_id}/ver-solicitud")
def ver_pdf_solicitud(proceso_id: int, db: Session = Depends(get_db)):
    proceso = db.query(Proceso).filter(Proceso.id == proceso_id).first()
    if not proceso:
        raise HTTPException(status_code=404, detail="Proceso no encontrado")

    ruta_pdf = f"Resultados/Proceso_{proceso_id}/0_Solicitud_Inicial_{proceso_id}.pdf"
    
    if not os.path.exists(ruta_pdf):
        raise HTTPException(status_code=404, detail="El PDF inicial no se encuentra en el servidor.")
        
    return FileResponse(
        path=ruta_pdf, 
        filename=f"Solicitud_Inicial_{proceso.hoja_ruta or proceso_id}.pdf",
        media_type="application/pdf"
    )


@router.get("/{proceso_id}/descargar-zip")
def descargar_expediente_zip(proceso_id: int, db: Session = Depends(get_db)):
    proceso = db.query(Proceso).filter(Proceso.id == proceso_id, Proceso.activo == True).first()
    if not proceso:
        raise HTTPException(status_code=404, detail="Proceso no encontrado")

    ruta_directorio = f"Resultados/Proceso_{proceso_id}"
    
    if not os.path.exists(ruta_directorio):
        raise HTTPException(status_code=404, detail="Este expediente aún no tiene documentos generados.")

    zip_buffer = BytesIO()

    # Comprime todo lo que encuentre en esa subcarpeta exacta
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for root, _, files in os.walk(ruta_directorio):
            for file in files:
                ruta_completa = os.path.join(root, file)
                # arcname=file evita que el zip contenga toda la ruta "Resultados/Proceso_15/..." internamente
                zip_file.write(ruta_completa, arcname=file)

    zip_buffer.seek(0)
    nombre_zip = f"Expediente_{proceso.hoja_ruta or proceso.codigo_proceso or proceso_id}.zip"

    from fastapi.responses import StreamingResponse
    return StreamingResponse(
        iter([zip_buffer.getvalue()]), 
        media_type="application/zip", 
        headers={"Content-Disposition": f"attachment; filename={nombre_zip}"}
    )
