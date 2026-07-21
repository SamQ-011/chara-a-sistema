from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import Optional
import os
import shutil

from app.core.base_datos import get_db
from app.core.seguridad import obtener_usuario_actual
from app.core.config import MATRIZ_REQUISITOS
from app.models.tablas_transaccionales import Proceso, ItemProceso, EstadoProceso, GastoProceso, DocumentoProceso, EstadoDocumento
from app.models.tablas_base import Proyecto, Unidad, Proveedor
from app.schemas.proceso import ProcesoCreate, PayloadDocumento, ProcesoUpdate
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
def listar_procesos(db: Session = Depends(get_db), usuario_actual = Depends(obtener_usuario_actual)):
    query = db.query(Proceso).filter(Proceso.activo == True)
    
    # Filtro automático: El admin ve todo, el solicitante solo lo suyo
    if usuario_actual.rol == "SOLICITANTE":
        query = query.filter(Proceso.usuario_id == usuario_actual.id)
        
    return query.all()

@router.get("/dashboard")
def obtener_estadisticas_dashboard(db: Session = Depends(get_db), usuario_actual = Depends(obtener_usuario_actual)):
    query = db.query(Proceso.estado, func.count(Proceso.id)).filter(Proceso.activo == True)
    
    if usuario_actual.rol == "SOLICITANTE":
        query = query.filter(Proceso.usuario_id == usuario_actual.id)
        
    conteos = query.group_by(Proceso.estado).all()
    
    stats = {
        "total": 0,
        "BORRADOR": 0,
        "EN CURSO": 0,
        "CON PENDIENTES": 0,
        "FINALIZADO": 0,
        "ANULADO": 0

    }
    
    for estado, cantidad in conteos:
        # estado.value extrae el string del Enum
        if estado.value in stats:
            stats[estado.value] = cantidad
        stats["total"] += cantidad
        
    return {
        "success": True,
        "data": stats
    }

@router.post("/")
def crear_proceso(datos: ProcesoCreate, db: Session = Depends(get_db)):
    try:
        ui = datos.variables_ui
        
        proyecto_db = db.query(Proyecto).filter(Proyecto.codigo_proyecto == ui.cod_proy).first()
        unidad_db = db.query(Unidad).filter(Unidad.nombre == ui.uni_solic).first()
        
        proy_id = proyecto_db.id if proyecto_db else None
        uni_id = unidad_db.id if unidad_db else None
        
        nuevo_proceso = Proceso(
            codigo_proceso=ui.codigo,
            nro_orden=ui.n_orden,
            objeto_contratacion=ui.objeto,
            desca_contextual=ui.desca,
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
            proveedor_id=None, # <--- ¡AQUÍ ESTABA EL ERROR DEL PANTALLAZO!          
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

@router.put("/{proceso_id}")
def actualizar_proceso(proceso_id: int, datos: ProcesoUpdate, db: Session = Depends(get_db)):
    try:
        # 1. Verificar que el proceso exista
        proceso = db.query(Proceso).filter(Proceso.id == proceso_id, Proceso.activo == True).first()
        if not proceso:
            raise HTTPException(status_code=404, detail="Proceso no encontrado")

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
        "proveedor_id": proceso.proveedor_id,
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
def guardar_datos_documento(proceso_id: int, payload: PayloadDocumento, db: Session = Depends(get_db)):
    proceso = db.query(Proceso).filter(Proceso.id == proceso_id).first()
    if not proceso:
        raise HTTPException(status_code=404, detail="Proceso no encontrado")

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
    fecha_corta: Optional[str] = None, 
    fecha_larga: Optional[str] = None, 
    db: Session = Depends(get_db)
):
    try:
        ruta_archivo = orquestar_generacion_documento(proceso_id, tipo_documento, db, fecha_corta, fecha_larga)
        
        if not os.path.exists(ruta_archivo):
            raise HTTPException(status_code=500, detail="El archivo se generó pero no se encuentra en el disco.")
            
        nombre_descarga = os.path.basename(ruta_archivo)
        
        return FileResponse(
            path=ruta_archivo, 
            filename=nombre_descarga,
            media_type="application/octet-stream"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando documento: {str(e)}")

@router.post("/{proceso_id}/subir-solicitud")
async def subir_pdf_solicitud(proceso_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    # 1. Validar que el proceso exista
    proceso = db.query(Proceso).filter(Proceso.id == proceso_id).first()
    if not proceso:
        raise HTTPException(status_code=404, detail="Proceso no encontrado en la base de datos.")

    # 2. Validar que sea un PDF
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="El archivo adjunto debe ser estrictamente un PDF.")

    # 3. Crear la carpeta si no existe (Mismo concepto del legacy, pero local/nube)
    directorio = "Uploads/solicitudes_iniciales"
    os.makedirs(directorio, exist_ok=True)

    # 4. Guardar el archivo con el ID del proceso (ej: 15_solicitud.pdf)
    ruta_guardado = os.path.join(directorio, f"{proceso_id}_solicitud.pdf")

    with open(ruta_guardado, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return {
        "success": True, 
        "message": "Archivo PDF resguardado correctamente.", 
        "ruta_pdf": ruta_guardado
    }

