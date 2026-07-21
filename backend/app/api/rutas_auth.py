from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.core.base_datos import get_db # Ajusta la importación de tu DB
from app.models.tablas_base import Usuario
from app.core.seguridad import verificar_password, crear_token_acceso

router = APIRouter()

@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.username == form_data.username, Usuario.activo == True).first()
    
    if not usuario or not verificar_password(form_data.password, usuario.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    access_token = crear_token_acceso(data={"sub": str(usuario.id), "rol": usuario.rol})
    
    return {
        "access_token": access_token, 
        "token_type": "bearer", 
        "rol": usuario.rol,
        "nombre": usuario.nombre_completo,
        "cargo": usuario.cargo # <--- AÑADE ESTA LÍNEA
    }