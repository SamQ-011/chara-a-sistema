from app.core.base_datos import SessionLocal, engine, Base
from app.models.tablas_base import Usuario, Unidad, Proveedor, Proyecto
from app.models.tablas_transaccionales import Proceso, ItemProceso, GastoProceso, DocumentoProceso, EstadoProceso, HojaRuta, Correspondencia
from datetime import datetime

def poblar_procesos_ejemplo():
    db = SessionLocal()
    try:
        # Verificar si ya existen procesos
        num_procesos = db.query(Proceso).count()
        if num_procesos >= 4:
            print(f"Ya existen {num_procesos} procesos en la base de datos.")
            return

        print("Poblando 4 procesos de ejemplo con métricas...")

        # Buscar usuario y unidad
        usuario = db.query(Usuario).filter(Usuario.username == "yassher.albarracin").first() or db.query(Usuario).first()
        unidad = db.query(Unidad).filter(Unidad.id == 1).first() or db.query(Unidad).first()

        procesos_data = [
            {
                "codigo": "HR-2026-0001",
                "objeto": "Adquisición de pintura sintética y cemento para mantenimiento de 18 Unidades Educativas",
                "monto_total": 48500.00,
                "estado": EstadoProceso.EN_CURSO,
                "ubicacion": "PRESUPUESTO",
                "docs_finalizados": ["especificaciones_tecnicas", "solicitud_cp"]
            },
            {
                "codigo": "HR-2026-0002",
                "objeto": "Compra de insumos y equipamiento médico básico para el Centro de Salud Charaña",
                "monto_total": 35200.00,
                "estado": EstadoProceso.EN_CURSO,
                "ubicacion": "RPC",
                "docs_finalizados": ["especificaciones_tecnicas", "solicitud_cp", "cert_presupuestaria", "autorizacion_inicio"]
            },
            {
                "codigo": "HR-2026-0003",
                "objeto": "Contratación de servicio de mantenimiento preventivo de maquinaria pesada del Municipio",
                "monto_total": 62000.00,
                "estado": EstadoProceso.EN_CURSO,
                "ubicacion": "SOLICITANTE",
                "docs_finalizados": ["especificaciones_tecnicas"]
            },
            {
                "codigo": "HR-2026-0004",
                "objeto": "Adquisición de alimentos y ración seca para el Programa de Alimentación Escolar (PAE)",
                "monto_total": 94000.00,
                "estado": EstadoProceso.FINALIZADO,
                "ubicacion": "FINALIZADO",
                "docs_finalizados": ["especificaciones_tecnicas", "solicitud_cp", "cert_presupuestaria", "autorizacion_inicio", "solicitud_inicio", "informe_cotizacion", "notificacion_adjudicacion", "orden_compra", "acta_recepcion", "informe_conformidad", "almacenes"]
            }
        ]

        for p_data in procesos_data:
            proc = Proceso(
                codigo=p_data["codigo"],
                hoja_ruta=p_data["codigo"],
                objeto=p_data["objeto"],
                monto_total=p_data["monto_total"],
                estado=p_data["estado"],
                ubicacion_actual=p_data["ubicacion"],
                unidad_solicitante_id=unidad.id if unidad else 1,
                usuario_id=usuario.id if usuario else 1,
                activo=True
            )
            db.add(proc)
            db.flush()

            # Agregar un ítem de ejemplo
            item = ItemProceso(
                proceso_id=proc.id,
                nro_item=1,
                objeto_corto=p_data["objeto"][:100],
                descripcion_larga=p_data["objeto"],
                unidad="Global",
                cantidad=1,
                precio_unitario=p_data["monto_total"],
                total_item=p_data["monto_total"]
            )
            db.add(item)

            # Agregar documentos con estado
            for clave_doc in p_data["docs_finalizados"]:
                doc = DocumentoProceso(
                    proceso_id=proc.id,
                    clave_documento=clave_doc,
                    nombre_documento=clave_doc.replace("_", " ").title(),
                    estado="FINALIZADO"
                )
                db.add(doc)

        db.commit()
        print("¡4 procesos de ejemplo poblados exitosamente!")

    except Exception as e:
        db.rollback()
        print(f"Error poblando procesos: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    poblar_procesos_ejemplo()
