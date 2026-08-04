from app.core.base_datos import SessionLocal, engine, Base
from app.models.tablas_base import Usuario
from app.core.seguridad import get_password_hash
from sqlalchemy import text

def poblar_usuarios():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    try:
        # Inyectar las nuevas columnas a la fuerza en PostgreSQL por si no existen
        try:
            db.execute(text("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS titulo VARCHAR(20);"))
            db.execute(text("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS cargo VARCHAR(150);"))
            db.commit()
        except Exception as e:
            db.rollback()

        # Limpiar usuarios anteriores para evitar duplicados
        db.query(Usuario).delete()
        db.commit()

        print("Inyectando usuarios con la nueva estructura...")
        password_default = get_password_hash("gamch2026")

        usuarios_seed = [
            Usuario(username="jose.ramos", password_hash=password_default, titulo="", nombre_completo="Jose Luis Ramos Mamani", cargo="Encargado de Activos, Recaudación e Intendencia", rol="SOLICITANTE"),
            Usuario(username="mayelyn.torrez", password_hash=password_default, titulo="Lic.", nombre_completo="Mayelyn C. Torrez Quispe", cargo="Responsable Municipal de Salud y Educación", rol="SOLICITANTE"),
            Usuario(username="yassher.albarracin", password_hash=password_default, titulo="Ing.", nombre_completo="Yassher Albarracín Alarcón", cargo="Responsable de Obras Públicas y Desarrollo Territorial", rol="SOLICITANTE"),
            Usuario(username="ivan.mita", password_hash=password_default, titulo="", nombre_completo="Ivan Mita Montevilla", cargo="Encargado de Cultura y Educación", rol="SOLICITANTE"),
            Usuario(username="waldemar.butron", password_hash=password_default, titulo="", nombre_completo="Waldemar Limbert Butrón Poma", cargo="Secretario Municipal", rol="SOLICITANTE"),
            Usuario(username="francisco.cusi", password_hash=password_default, titulo="", nombre_completo="Francisco Cusi Cusi", cargo="Encargado Almacenes y Limpieza", rol="SOLICITANTE"),
            Usuario(username="adela.dorado", password_hash=password_default, titulo="Lic.", nombre_completo="Adela Dorado Garrado", cargo="Responsable de Presupuesto y Contabilidad", rol="PRESUPUESTO"),
            Usuario(username="gerson.vargas", password_hash=password_default, titulo="", nombre_completo="Gerson Elvis Vargas Conde", cargo="Responsable de Procesos de Contratación (RPA - RPC)", rol="RPC"),
            Usuario(username="rosa.aduviri", password_hash=password_default, titulo="Tec.", nombre_completo="Rosa Aduviri Vichini", cargo="Asistente Contable", rol="ADMIN"),
            Usuario(username="maria.ventanilla", password_hash=password_default, titulo="Tec.", nombre_completo="Maria Gomez", cargo="Recepción", rol="SECRETARIA")

        ]
        
        db.bulk_save_objects(usuarios_seed)
        db.commit()
        print("¡Éxito! 9 usuarios creados con la nueva estructura.")

    except Exception as e:
        db.rollback()
        print(f"Error crítico: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    poblar_usuarios()