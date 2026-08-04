from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.base_datos import get_db
from app.core.seguridad import obtener_usuario_actual
from app.models.tablas_base import Proveedor, Proyecto, Unidad, PoaPrograma, PoaProyecto, PoaPartida
from app.schemas.catalogo import ProveedorCreate, ProveedorResponse, ProyectoCreate, ProyectoResponse, UnidadCreate, UnidadResponse, PoaProgramaCreate, PoaProgramaResponse, PoaProyectoCreate, PoaProyectoResponse, PoaPartidaCreate, PoaPartidaResponse

def verificar_admin(usuario_actual = Depends(obtener_usuario_actual)):
    if usuario_actual.rol not in ["ADMIN", "RPC", "PRESUPUESTO"]:
        raise HTTPException(
            status_code=403, 
            detail="Acceso denegado. Rol no autorizado para modificar catálogos."
        )
    return usuario_actual


router = APIRouter(prefix="/api", tags=["Catálogos"])

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

@router.get("/unidades", response_model=list[UnidadResponse])
def listar_unidades(db: Session = Depends(get_db)):
    """Retorna todas las unidades organizacionales activas para los selectores."""
    return db.query(Unidad).filter(Unidad.activo == True).order_by(Unidad.nombre.asc()).all()

@router.get("/poa/arbol")
def obtener_arbol_poa(db: Session = Depends(get_db)):
    programas = db.query(PoaPrograma).filter(PoaPrograma.activo == True).all()
    resultado = []
    
    for prog in programas:
        proy_list = []
        for proy in prog.proyectos:
            part_list = []
            for part in proy.partidas:
                part_list.append({
                    "id": part.id, 
                    "codigo": part.codigo, 
                    "descripcion": part.descripcion,
                    "ff": part.ff, 
                    "of": part.of
                })
            proy_list.append({
                "id": proy.id, 
                "codigo_proy": proy.codigo_proy, 
                "actividad": proy.actividad,
                "nombre": proy.nombre, 
                "partidas": part_list
            })
        resultado.append({
            "id": prog.id, 
            "codigo": prog.codigo, 
            "nombre": prog.nombre,
            "proyectos": proy_list
        })
        
    return resultado

@router.post("/poa/programas", response_model=PoaProgramaResponse, dependencies=[Depends(verificar_admin)])
def crear_programa_poa(programa: PoaProgramaCreate, db: Session = Depends(get_db)):
    db_prog = db.query(PoaPrograma).filter(PoaPrograma.codigo == programa.codigo).first()
    if db_prog:
        raise HTTPException(status_code=400, detail="El código de programa ya existe.")
    
    nuevo_programa = PoaPrograma(**programa.model_dump())
    db.add(nuevo_programa)
    db.commit()
    db.refresh(nuevo_programa)
    return nuevo_programa

@router.post("/poa/proyectos", response_model=PoaProyectoResponse, dependencies=[Depends(verificar_admin)])
def crear_proyecto_poa(proyecto: PoaProyectoCreate, db: Session = Depends(get_db)):
    # Verificar que el programa padre existe
    db_prog = db.query(PoaPrograma).filter(PoaPrograma.id == proyecto.programa_id).first()
    if not db_prog:
        raise HTTPException(status_code=404, detail="El programa especificado no existe.")
        
    nuevo_proyecto = PoaProyecto(**proyecto.model_dump())
    db.add(nuevo_proyecto)
    db.commit()
    db.refresh(nuevo_proyecto)
    return nuevo_proyecto

@router.post("/poa/partidas", response_model=PoaPartidaResponse, dependencies=[Depends(verificar_admin)])
def crear_partida_poa(partida: PoaPartidaCreate, db: Session = Depends(get_db)):
    # Verificar que el proyecto padre existe
    db_proy = db.query(PoaProyecto).filter(PoaProyecto.id == partida.proyecto_id).first()
    if not db_proy:
        raise HTTPException(status_code=404, detail="El proyecto/actividad especificado no existe.")
        
    nueva_partida = PoaPartida(**partida.model_dump())
    db.add(nueva_partida)
    db.commit()
    db.refresh(nueva_partida)
    return nueva_partida