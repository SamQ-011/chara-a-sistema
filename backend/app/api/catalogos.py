from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.base_datos import get_db
from app.models.tablas_base import Proveedor, Proyecto, Unidad
from app.schemas.catalogo import ProveedorCreate, ProveedorResponse, ProyectoCreate, ProyectoResponse, UnidadCreate, UnidadResponse

router = APIRouter(prefix="/api/catalogos", tags=["Catálogos"])

@router.post("/proveedores", response_model=ProveedorResponse)
def crear_proveedor(proveedor: ProveedorCreate, db: Session = Depends(get_db)):
    # Verificar si el NIT ya existe
    db_prov = db.query(Proveedor).filter(Proveedor.nit_ci == proveedor.nit_ci).first()
    if db_prov:
        raise HTTPException(status_code=400, detail="El NIT ya está registrado.")
    
    nuevo_proveedor = Proveedor(**proveedor.model_dump())
    db.add(nuevo_proveedor)
    db.commit()
    db.refresh(nuevo_proveedor)
    return nuevo_proveedor

@router.get("/proveedores", response_model=list[ProveedorResponse])
def listar_proveedores(db: Session = Depends(get_db)):
    return db.query(Proveedor).filter(Proveedor.activo == True).all()

@router.post("/proyectos", response_model=ProyectoResponse)
def crear_proyecto(proyecto: ProyectoCreate, db: Session = Depends(get_db)):
    db_proy = db.query(Proyecto).filter(Proyecto.codigo_proyecto == proyecto.codigo_proyecto).first()
    if db_proy:
        raise HTTPException(status_code=400, detail="El código de proyecto ya existe.")
    nuevo_proyecto = Proyecto(**proyecto.model_dump())
    db.add(nuevo_proyecto)
    db.commit()
    db.refresh(nuevo_proyecto)
    return nuevo_proyecto

@router.post("/unidades", response_model=UnidadResponse)
def crear_unidad(unidad: UnidadCreate, db: Session = Depends(get_db)):
    db_uni = db.query(Unidad).filter(Unidad.nombre == unidad.nombre).first()
    if db_uni:
        raise HTTPException(status_code=400, detail="La unidad ya existe.")
    nueva_unidad = Unidad(**unidad.model_dump())
    db.add(nueva_unidad)
    db.commit()
    db.refresh(nueva_unidad)
    return nueva_unidad