from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.base_datos import Base

# Mixin para auditoría y borrado lógico (Soft Delete)
class AuditoriaMixin:
    activo = Column(Boolean, default=True)
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())
    fecha_actualizacion = Column(DateTime(timezone=True), onupdate=func.now())
    fecha_baja = Column(DateTime(timezone=True), nullable=True)

class Configuracion(Base, AuditoriaMixin):
    __tablename__ = "configuracion"
    id = Column(Integer, primary_key=True, index=True)
    clave = Column(String(50), unique=True, index=True) # ej: "ALCALDE", "RUTA_PLANTILLAS"
    valor = Column(String(255))
    descripcion = Column(String(255), nullable=True)

class TipoDocumento(Base, AuditoriaMixin):
    __tablename__ = "tipos_documento"
    id = Column(Integer, primary_key=True, index=True)
    codigo = Column(String(50), unique=True, index=True) # ej: "ORDEN_COMPRA"
    nombre = Column(String(100)) # ej: "Orden de Compra"
    extension = Column(String(10)) # ej: "xlsx", "docx"
    motor = Column(String(20)) # ej: "EXCEL", "WORD"
    plantilla = Column(String(255)) # ej: "Plantillas/orden_compra.xlsx"

class Proveedor(Base, AuditoriaMixin):
    __tablename__ = "proveedores"
    id = Column(Integer, primary_key=True, index=True)
    razon_social = Column(String(200), index=True)
    nit_ci = Column(String(50), unique=True, index=True)
    direccion = Column(String(255), nullable=True)
    telefono = Column(String(50), nullable=True)

class Proyecto(Base, AuditoriaMixin):
    __tablename__ = "proyectos"
    id = Column(Integer, primary_key=True, index=True)
    codigo_proyecto = Column(String(50), unique=True, index=True)
    nombre_proyecto = Column(String(255))
    desca = Column(String(255), nullable=True)

class Unidad(Base, AuditoriaMixin):
    __tablename__ = "unidades"
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(150), unique=True, index=True)
    sigla = Column(String(20), nullable=True)
    responsable_id = Column(Integer, ForeignKey("usuarios.id", use_alter=True, name="fk_unidades_responsable_id"), nullable=True)

    responsable = relationship("Usuario", foreign_keys=[responsable_id], lazy="select")

class Usuario(Base, AuditoriaMixin):
    __tablename__ = "usuarios"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True)
    password_hash = Column(String(255))

    titulo = Column(String(20), nullable=True) 
    nombre_completo = Column(String(150)) 
    cargo = Column(String(150), nullable=True)

    rol = Column(String(50)) # ej: ADMIN, SECRETARIA
    unidad_id = Column(Integer, ForeignKey("unidades.id"), nullable=True)

    unidad = relationship("Unidad", foreign_keys=[unidad_id], lazy="joined")

class UnidadMedida(Base, AuditoriaMixin):
    __tablename__ = "unidades_medida"
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(50), unique=True)
    sigla = Column(String(10))

class PoaPrograma(Base, AuditoriaMixin):
    __tablename__ = "poa_programas"
    id = Column(Integer, primary_key=True, index=True)
    codigo = Column(String(10), index=True) 
    nombre = Column(String(255))
    
    proyectos = relationship("PoaProyecto", back_populates="programa")

class PoaProyecto(Base, AuditoriaMixin):
    __tablename__ = "poa_proyectos"
    id = Column(Integer, primary_key=True, index=True)
    programa_id = Column(Integer, ForeignKey("poa_programas.id"))
    codigo_proy = Column(String(10), index=True) 
    actividad = Column(String(10), index=True)
    nombre = Column(String(255))
    
    programa = relationship("PoaPrograma", back_populates="proyectos")
    partidas = relationship("PoaPartida", back_populates="proyecto")

class PoaPartida(Base, AuditoriaMixin):
    __tablename__ = "poa_partidas"
    id = Column(Integer, primary_key=True, index=True)
    proyecto_id = Column(Integer, ForeignKey("poa_proyectos.id"))
    codigo = Column(String(20)) 
    descripcion = Column(String(255))
    ff = Column(String(20))
    of = Column(String(20))
    
    proyecto = relationship("PoaProyecto", back_populates="partidas")
