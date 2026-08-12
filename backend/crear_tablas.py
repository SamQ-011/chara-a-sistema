from app.core.base_datos import engine, Base
from sqlalchemy import text

from app.models.tablas_base import Configuracion, TipoDocumento, Proveedor, Proyecto, Unidad, Usuario, UnidadMedida
from app.models.tablas_transaccionales import Proceso, ItemProceso, GastoProceso, DocumentoProceso, LogAuditoria, HojaRuta, Correspondencia, DerivacionHojaRuta

print("Borrando estructura antigua...")
with engine.connect() as conn:
    conn.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public;"))
    conn.commit()

print("Conectando a PostgreSQL y creando tablas...")
Base.metadata.create_all(bind=engine)
print("¡Estructura de la base de datos creada con éxito!")