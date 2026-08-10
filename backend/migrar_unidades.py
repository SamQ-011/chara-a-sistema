# backend/migrar_unidades.py
from app.core.base_datos import SessionLocal
from app.models.tablas_base import Usuario, Unidad

def migrar_cargos_a_unidades():
    db = SessionLocal()
    try:
        # Limpiar responsable_id en unidades previamente para evitar conflictos FK en migraciones
        db.query(Unidad).update({Unidad.responsable_id: None})
        db.commit()

        # 1. Obtener todos los cargos únicos registrados en usuarios
        cargos_unicos = db.query(Usuario.cargo).filter(
            Usuario.cargo.isnot(None),
            Usuario.cargo != ""
        ).distinct().all()

        print(f"Analizando {len(cargos_unicos)} cargos en la base de datos...")

        unidades_map = {}
        # 2. Insertar en la tabla 'unidades' si no existen
        for (cargo_nombre,) in cargos_unicos:
            nombre_limpio = cargo_nombre.strip()
            unidad = db.query(Unidad).filter(Unidad.nombre == nombre_limpio).first()
            if not unidad:
                unidad = Unidad(nombre=nombre_limpio)
                db.add(unidad)
                db.flush()
                print(f"  [+] Unidad creada: ID {unidad.id} - '{nombre_limpio}'")
            else:
                print(f"  [=] Unidad existente: ID {unidad.id} - '{nombre_limpio}'")
            
            unidades_map[nombre_limpio] = unidad.id

        # 3. Vincular Foreign Key (unidad_id) y responsable_id a cada Usuario/Unidad
        usuarios = db.query(Usuario).all()
        modificados = 0
        for u in usuarios:
            if u.cargo and u.cargo.strip() in unidades_map:
                u_id = unidades_map[u.cargo.strip()]
                u.unidad_id = u_id
                unidad_obj = db.query(Unidad).filter(Unidad.id == u_id).first()
                if unidad_obj and not unidad_obj.responsable_id and u.rol not in ["PASANTE", "AUXILIAR"]:
                    unidad_obj.responsable_id = u.id
                modificados += 1

        db.commit()
        print(f"Migración completada: {modificados} usuarios vinculados con su 'unidad_id'.")

    except Exception as e:
        db.rollback()
        print(f"Error durante la migración: {str(e)}")
    finally:
        db.close()

if __name__ == "__main__":
    migrar_cargos_a_unidades()