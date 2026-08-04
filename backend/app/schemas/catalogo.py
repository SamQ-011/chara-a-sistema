from pydantic import BaseModel
from typing import Optional

# Esquema para PROVEEDORES
class ProveedorBase(BaseModel):
    razon_social: str
    nit_ci: str
    direccion: Optional[str] = None
    telefono: Optional[str] = None

class ProveedorCreate(ProveedorBase):
    pass

class ProveedorResponse(ProveedorBase):
    id: int
    class Config:
        from_attributes = True

# Esquema para PROYECTOS ({desca})
class ProyectoBase(BaseModel):
    codigo_proyecto: str
    nombre_proyecto: str
    desca: str

class ProyectoCreate(ProyectoBase):
    pass

class ProyectoResponse(ProyectoBase):
    id: int
    class Config:
        from_attributes = True


# Esquema para UNIDADES
class UnidadBase(BaseModel):
    nombre: str

class UnidadCreate(UnidadBase):
    pass

class UnidadResponse(UnidadBase):
    id: int
    class Config:
        from_attributes = True


class PoaProgramaCreate(BaseModel):
    codigo: str
    nombre: str

class PoaProyectoCreate(BaseModel):
    programa_id: int
    codigo_proy: str
    actividad: str
    nombre: str

class PoaPartidaCreate(BaseModel):
    proyecto_id: int
    codigo: str
    descripcion: str
    ff: str
    of: str

class PoaPartidaResponse(PoaPartidaCreate):
    id: int
    class Config:
        from_attributes = True

class PoaProyectoResponse(PoaProyectoCreate):
    id: int
    partidas: list[PoaPartidaResponse] = []
    class Config:
        from_attributes = True

class PoaProgramaResponse(PoaProgramaCreate):
    id: int
    proyectos: list[PoaProyectoResponse] = []
    class Config:
        from_attributes = True