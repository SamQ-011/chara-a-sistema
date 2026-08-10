from pydantic import BaseModel, Field, ConfigDict
from typing import Optional

class UsuarioBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    nombre_completo: str = Field(..., min_length=3, max_length=150)
    titulo: Optional[str] = None
    cargo: Optional[str] = None
    rol: str = Field(..., description="ADMIN, RPC, PRESUPUESTO, SOLICITANTE, SECRETARIA, AUXILIAR, PASANTE")
    unidad_id: Optional[int] = None

class UsuarioCreate(UsuarioBase):
    password: str = Field(..., min_length=6)

class UsuarioUpdate(BaseModel):
    nombre_completo: Optional[str] = None
    titulo: Optional[str] = None
    cargo: Optional[str] = None
    rol: Optional[str] = None
    unidad_id: Optional[int] = None
    activo: Optional[bool] = None

class UsuarioResetPassword(BaseModel):
    nueva_password: str = Field(..., min_length=6)

class UnidadSimpleResponse(BaseModel):
    id: int
    nombre: str
    sigla: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class UsuarioResponse(BaseModel):
    id: int
    username: str
    nombre_completo: str
    titulo: Optional[str] = None
    cargo: Optional[str] = None
    rol: str
    unidad_id: Optional[int] = None
    unidad: Optional[UnidadSimpleResponse] = None
    activo: bool

    model_config = ConfigDict(from_attributes=True)
