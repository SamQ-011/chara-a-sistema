# backend/crear_tablas.py
from app.core.base_datos import engine, Base

from app.models.tablas_base import Configuracion, TipoDocumento, Proveedor, Proyecto, Unidad, Usuario, UnidadMedida
from app.models.tablas_transaccionales import Proceso, ItemProceso, GastoProceso, DocumentoProceso, LogAuditoria

print("Borrando estructura antigua...")
Base.metadata.drop_all(bind=engine) # <--- ESTO ELIMINA LAS TABLAS EXISTENTES

print("Conectando a PostgreSQL y creando tablas...")
Base.metadata.create_all(bind=engine) # <--- ESTO LAS CREA DE NUEVO CON LA COLUMNA AÑADIDA
print("¡Estructura de la base de datos creada con éxito!")