from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from decimal import Decimal
from enum import Enum

# Enum idéntico al de la base de datos
class EstadoProcesoEnum(str, Enum):
    BORRADOR = "BORRADOR"
    EN_CURSO = "EN CURSO"
    CON_PENDIENTES = "CON PENDIENTES"
    FINALIZADO = "FINALIZADO"
    ANULADO = "ANULADO"

class ItemProcesoBase(BaseModel):
    nro_item: int
    objeto_corto: str
    descripcion_larga: Optional[str] = ""
    unidad: str
    cantidad: Decimal
    precio_unitario: Decimal
    total_item: Decimal

class VariablesUI(BaseModel):
    proveedor: str
    nit: str
    direccion: Optional[str] = ""
    telefono: Optional[str] = ""
    codigo: str
    hoja_ruta: str = ""
    n_orden: Optional[str] = ""
    objeto: str
    desca: str
    cod_proy: str
    uni_solic: str
    distrito_comunidad: str = ""
    
    tipo_pago: str = "TRANSFERENCIA ELECTRÓNICA"
    tipo_contratacion: str = "BIENES"
    plazo: int = 0
    monto_total: Decimal
    retencion_val: Decimal = 0.00
    
    fecha_corta: str = ""
    fecha_larga: str = ""
    fecha_info: str = ""
    
    enc_finanzas: str = ""
    nom_tecnico: str = ""
    cargo_tecnico: str = ""
    
    seleccionados: List[str] = []

class GastoBase(BaseModel):
    partida: str
    prog: str
    proy: str
    act: str
    ff: str
    of: str
    descripcion: str
    monto: Decimal

class ProcesoCreate(BaseModel):
    variables_ui: VariablesUI
    items: List[ItemProcesoBase]
    gastos: List[GastoBase]

class PayloadDocumento(BaseModel):
    clave_documento: str
    estado: str
    datos_formulario: Dict[str, Any]


class ProcesoUpdate(ProcesoCreate):
    # Hereda variables_ui, items y gastos de ProcesoCreate.
    # Si en el futuro necesitas un campo extra solo para la edición (ej: motivo_edicion), iría aquí.
    pass

class FusionPayload(BaseModel):
    ids_origen: List[int]
    objeto_unificado: str
    hoja_ruta_master: str