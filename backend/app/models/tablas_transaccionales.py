from sqlalchemy import Column, Integer, String, Numeric, ForeignKey, Enum, DateTime, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.core.base_datos import Base
from app.models.tablas_base import AuditoriaMixin

class EstadoProceso(str, enum.Enum):
    BORRADOR = "BORRADOR"
    EN_CURSO = "EN CURSO"
    CON_PENDIENTES = "CON PENDIENTES"
    FINALIZADO = "FINALIZADO"
    ANULADO = "ANULADO"

# --- NUEVO: ESTADOS INDIVIDUALES POR DOCUMENTO ---
class EstadoDocumento(str, enum.Enum):
    PENDIENTE = "PENDIENTE"
    BORRADOR = "BORRADOR"
    FINALIZADO = "FINALIZADO"

class Proceso(Base, AuditoriaMixin):
    __tablename__ = "procesos"
    id = Column(Integer, primary_key=True, index=True)
    codigo_proceso = Column(String(50), unique=True, index=True)
    hoja_ruta = Column(String(50), nullable=True)
    nro_orden = Column(String(50), nullable=True)
    objeto_contratacion = Column(String(500))
    desca_contextual = Column(String(255), nullable=True)
    tipo_pago = Column(String(100), nullable=True)
    tipo_contratacion = Column(String(100), nullable=True)
    plazo_entrega = Column(Integer, default=0)
    
    monto_total = Column(Numeric(12, 2))
    monto_adjudicado = Column(Numeric(12, 2), nullable=True)
    retencion_monto = Column(Numeric(12, 2), default=0.00)
    
    responsable_presupuesto = Column(String(150), nullable=True)
    tecnico_solicitante = Column(String(150), nullable=True)
    cargo_tecnico_solicitante = Column(String(150), nullable=True)

    distrito_comunidad = Column(String(255), nullable=True)
    fecha_solicitud = Column(String(20), nullable=True)
    
    estado = Column(Enum(EstadoProceso), default=EstadoProceso.EN_CURSO)
    
    # --- NUEVO: RASTREO DE LA CARPETA FÍSICA ---
    ubicacion_actual = Column(String(150), default="SOLICITANTE")
    fusionado_en_id = Column(Integer, ForeignKey("procesos.id"), nullable=True)

    proveedor_id = Column(Integer, ForeignKey("proveedores.id"), nullable=True)
    proyecto_id = Column(Integer, ForeignKey("proyectos.id"), nullable=True)
    unidad_solicitante_id = Column(Integer, ForeignKey("unidades.id"), nullable=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)

    items = relationship("ItemProceso", back_populates="proceso", cascade="all, delete-orphan")
    gastos = relationship("GastoProceso", back_populates="proceso", cascade="all, delete-orphan")
    documentos = relationship("DocumentoProceso", back_populates="proceso", cascade="all, delete-orphan")
    proveedor = relationship("Proveedor", lazy="joined")
    proyecto = relationship("Proyecto", lazy="joined")
    unidad_solicitante = relationship("Unidad", lazy="joined")

class ItemProceso(Base, AuditoriaMixin):
    __tablename__ = "items_proceso"
    id = Column(Integer, primary_key=True, index=True)
    proceso_id = Column(Integer, ForeignKey("procesos.id"))
    nro_item = Column(Integer)
    objeto_corto = Column(String(250))
    descripcion_larga = Column(String(1000), nullable=True)
    unidad = Column(String(50)) 
    cantidad = Column(Numeric(10, 2))
    precio_unitario = Column(Numeric(10, 2))
    total_item = Column(Numeric(12, 2))
    
    proceso = relationship("Proceso", back_populates="items")

class GastoProceso(Base, AuditoriaMixin):
    __tablename__ = "gastos_proceso"
    id = Column(Integer, primary_key=True, index=True)
    proceso_id = Column(Integer, ForeignKey("procesos.id"))
    partida = Column(String(50))
    prog = Column(String(50))
    proy = Column(String(50))
    act = Column(String(50))
    ff = Column(String(50))
    of = Column(String(50))
    descripcion = Column(String(255))
    monto = Column(Numeric(12, 2))
    
    proceso = relationship("Proceso", back_populates="gastos")

class DocumentoProceso(Base, AuditoriaMixin):
    __tablename__ = "documentos_proceso"
    id = Column(Integer, primary_key=True, index=True)
    proceso_id = Column(Integer, ForeignKey("procesos.id"))
    
    # Enlazamos directamente con el identificador del frontend (ej: 'cert_presupuestaria')
    clave_documento = Column(String(100), index=True) 
    
    # PENDIENTE, BORRADOR, FINALIZADO
    estado = Column(Enum(EstadoDocumento), default=EstadoDocumento.PENDIENTE)
    
    # --- NUEVO: GUARDADO A MEDIAS ---
    datos_formulario = Column(JSON, nullable=True) 
    
    ruta_archivo = Column(String(500), nullable=True)
    version = Column(Integer, default=1)
    
    proceso = relationship("Proceso", back_populates="documentos")

class LogAuditoria(Base):
    __tablename__ = "logs_auditoria"
    id = Column(Integer, primary_key=True, index=True)
    proceso_id = Column(Integer, ForeignKey("procesos.id"))
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    accion = Column(String(100)) # Ej: "DERIVACION", "CREACION_DOCUMENTO"
    estado_anterior = Column(String(50), nullable=True)
    estado_nuevo = Column(String(50), nullable=True) # Ej: "RPC" (Nueva oficina)
    detalle = Column(String(500), nullable=True) # Ej: "Adela no asistió, se deriva directo"
    fecha = Column(DateTime(timezone=True), server_default=func.now())
    ip = Column(String(50), nullable=True)