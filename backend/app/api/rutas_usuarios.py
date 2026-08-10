from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.sql import func
from typing import List, Optional

from app.core.base_datos import get_db
from app.core.seguridad import obtener_usuario_actual, get_password_hash
from app.models.tablas_base import Usuario, Unidad
from app.schemas.usuario import (
    UsuarioCreate,
    UsuarioUpdate,
    UsuarioResetPassword,
    UsuarioResponse
)

ROLES_PERMITIDOS = ["ADMIN", "RPC", "PRESUPUESTO", "SOLICITANTE", "SECRETARIA", "AUXILIAR", "PASANTE"]

def _obtener_user_id_seguro(usuario_actual: dict) -> int:
    user_id_raw = usuario_actual.get("user_id") if isinstance(usuario_actual, dict) else None
    if user_id_raw is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token no contiene ID de usuario válido.")
    try:
        return int(user_id_raw)
    except (ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="ID de usuario inválido en token.")

def verificar_rpc(usuario_actual: dict = Depends(obtener_usuario_actual)):
    rol = usuario_actual.get("rol")
    if rol != "RPC":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado. Solamente el usuario con rol RPC puede administrar usuarios."
        )
    return usuario_actual

router = APIRouter(
    prefix="/api/usuarios",
    tags=["Gestión de Usuarios"],
    dependencies=[Depends(verificar_rpc)]
)

@router.get("/", response_model=List[UsuarioResponse])
def listar_usuarios(incluir_inactivos: bool = False, db: Session = Depends(get_db)):
    query = db.query(Usuario).options(joinedload(Usuario.unidad))
    if not incluir_inactivos:
        query = query.filter(Usuario.activo == True)
    return query.all()

@router.get("/{usuario_id}", response_model=UsuarioResponse)
def obtener_usuario(usuario_id: int, db: Session = Depends(get_db)):
    usuario = db.query(Usuario).options(joinedload(Usuario.unidad)).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    return usuario

@router.post("/", response_model=UsuarioResponse, status_code=status.HTTP_201_CREATED)
def crear_usuario(datos: UsuarioCreate, db: Session = Depends(get_db)):
    # 1. Verificar si el username ya existe
    username_clean = datos.username.strip().lower()
    existente = db.query(Usuario).filter(func.lower(Usuario.username) == username_clean).first()
    if existente:
        raise HTTPException(
            status_code=400,
            detail=f"El nombre de usuario '{datos.username}' ya está registrado."
        )
    
    # 2. Validar rol
    if datos.rol not in ROLES_PERMITIDOS:
        raise HTTPException(
            status_code=400,
            detail=f"Rol no válido. Roles permitidos: {', '.join(ROLES_PERMITIDOS)}"
        )
        
    # 3. Validar unidad si se especificó
    if datos.unidad_id:
        unidad = db.query(Unidad).filter(Unidad.id == datos.unidad_id, Unidad.activo == True).first()
        if not unidad:
            raise HTTPException(status_code=404, detail="La unidad organizacional seleccionada no existe.")

    nuevo_usuario = Usuario(
        username=datos.username.strip(),
        password_hash=get_password_hash(datos.password),
        nombre_completo=datos.nombre_completo.strip(),
        titulo=datos.titulo.strip() if datos.titulo else None,
        cargo=datos.cargo.strip() if datos.cargo else None,
        rol=datos.rol,
        unidad_id=datos.unidad_id,
        activo=True
    )
    
    db.add(nuevo_usuario)
    db.commit()
    db.refresh(nuevo_usuario)
    return nuevo_usuario

@router.put("/{usuario_id}", response_model=UsuarioResponse)
def actualizar_usuario(
    usuario_id: int, 
    datos: UsuarioUpdate, 
    db: Session = Depends(get_db),
    usuario_actual: dict = Depends(obtener_usuario_actual)
):
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
        
    current_user_id = _obtener_user_id_seguro(usuario_actual)

    # Protección contra auto-desactivación o auto-cambio de rol del RPC activo
    if usuario.id == current_user_id:
        if datos.activo is False:
            raise HTTPException(
                status_code=409,
                detail="No puedes desactivar tu propia cuenta activa de RPC."
            )
        if datos.rol and datos.rol != "RPC":
            raise HTTPException(
                status_code=409,
                detail="No puedes quitarte el rol de RPC a ti mismo."
            )

    if datos.rol:
        if datos.rol not in ROLES_PERMITIDOS:
            raise HTTPException(status_code=400, detail="Rol no válido.")
        usuario.rol = datos.rol

    if datos.nombre_completo is not None:
        usuario.nombre_completo = datos.nombre_completo.strip()
    if datos.titulo is not None:
        usuario.titulo = datos.titulo.strip() if datos.titulo else None
    if datos.cargo is not None:
        usuario.cargo = datos.cargo.strip() if datos.cargo else None
    if datos.unidad_id is not None:
        if datos.unidad_id > 0:
            unidad = db.query(Unidad).filter(Unidad.id == datos.unidad_id).first()
            if not unidad:
                raise HTTPException(status_code=404, detail="La unidad no existe.")
            usuario.unidad_id = datos.unidad_id
        else:
            usuario.unidad_id = None
            
    if datos.activo is not None:
        usuario.activo = datos.activo
        if not datos.activo:
            usuario.fecha_baja = func.now()

    db.commit()
    db.refresh(usuario)
    return usuario

@router.put("/{usuario_id}/reset-password")
def resetear_password(
    usuario_id: int,
    payload: UsuarioResetPassword,
    db: Session = Depends(get_db)
):
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    usuario.password_hash = get_password_hash(payload.nueva_password)
    db.commit()

    return {"success": True, "message": f"Contraseña del usuario {usuario.username} reseteada exitosamente."}

@router.delete("/{usuario_id}")
def desactivar_usuario(
    usuario_id: int,
    db: Session = Depends(get_db),
    usuario_actual: dict = Depends(obtener_usuario_actual)
):
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    current_user_id = _obtener_user_id_seguro(usuario_actual)
    if usuario.id == current_user_id:
        raise HTTPException(
            status_code=409,
            detail="Operación cancelada: No puedes desactivar tu propia cuenta activa de RPC."
        )

    usuario.activo = False
    usuario.fecha_baja = func.now()
    db.commit()

    return {"success": True, "message": f"Usuario '{usuario.username}' desactivado correctamente."}
