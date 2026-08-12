from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class CorrespondenciaCrear(BaseModel):
    tipo_remitente: str = Field(default="INSTITUCIONAL", description="INSTITUCIONAL o PARTICULAR")
    nombre_remitente: str = Field(..., description="Nombre completo del firmante / remitente")
    cargo_remitente: Optional[str] = None
    telefono_remitente: Optional[str] = None
    
    cite_origen: Optional[str] = None
    fecha_doc_origen: Optional[str] = None
    tipo_documento: str = Field(default="CARTA", description="CARTA, MEMORIAL, SOLICITUD, OFICIO")
    asunto: str = Field(..., description="Resumen o tema principal de la correspondencia")
    nro_fojas: int = Field(default=1, ge=1)
    anexos: Optional[str] = None
    
    unidad_destino_id: int = Field(..., description="ID de la Unidad Administrativa a la que se deriva")
    instruccion_proveido: Optional[str] = Field(default="Para su atención y trámite correspondiente")

class CorrespondenciaAtender(BaseModel):
    cite_respuesta: Optional[str] = None
    resumen_respuesta: str = Field(..., description="Resumen del informe de respuesta o dictamen")
    ruta_archivo_respuesta: Optional[str] = None

class DerivacionCrear(BaseModel):
    unidad_destino_id: int
    instruccion_proveido: str

class DerivacionOut(BaseModel):
    id: int
    unidad_origen: str
    unidad_destino: str
    usuario_emisor: str
    instruccion_proveido: str
    fecha_derivacion: str

class MovimientoOut(BaseModel):
    id: int
    tipo: str
    descripcion: str
    usuario_nombre: str
    fecha: str

class NotaCrear(BaseModel):
    descripcion: str = Field(..., description="Contenido de la nota u observación de avance")

class CorrespondenciaOut(BaseModel):
    id: int
    numero_hr: str
    fecha_recepcion: str
    usuario_recepcion: str
    
    tipo_remitente: str
    nombre_remitente: str
    cargo_remitente: Optional[str] = None
    telefono_remitente: Optional[str] = None
    
    cite_origen: Optional[str] = None
    fecha_doc_origen: Optional[str] = None
    tipo_documento: str
    asunto: str
    nro_fojas: int
    anexos: Optional[str] = None
    
    unidad_actual_id: int
    unidad_actual: str
    estado_general: str
    
    estado_correspondencia: Optional[str] = "PENDIENTE"
    acusado_por: Optional[str] = None
    fecha_acuse: Optional[str] = None
    
    cite_respuesta: Optional[str] = None
    resumen_respuesta: Optional[str] = None
    fecha_atencion: Optional[str] = None
    tiene_pdf: bool = False
    
    proceso_id: Optional[int] = None
    derivaciones: List[DerivacionOut] = []
    movimientos: List[MovimientoOut] = []

    class Config:
        from_attributes = True

