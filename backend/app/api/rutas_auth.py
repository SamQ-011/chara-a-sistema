from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.core.base_datos import get_db
from app.models.tablas_base import Usuario, Unidad
from app.core.seguridad import verificar_password, crear_token_acceso

router = APIRouter()

def obtener_rol_efectivo(usuario: Usuario, db: Session) -> str:
    if usuario.rol in ["PASANTE", "AUXILIAR"]:
        if usuario.unidad_id:
            unidad = db.query(Unidad).filter(Unidad.id == usuario.unidad_id).first()
            if unidad and unidad.responsable_id:
                resp = db.query(Usuario).filter(Usuario.id == unidad.responsable_id, Usuario.activo == True).first()
                if resp and resp.rol not in ["PASANTE", "AUXILIAR"]:
                    return resp.rol
            
            titular = db.query(Usuario).filter(
                Usuario.unidad_id == usuario.unidad_id,
                Usuario.activo == True,
                Usuario.rol.notin_(["PASANTE", "AUXILIAR"])
            ).first()
            if titular:
                return titular.rol
        return "SOLICITANTE"
    return usuario.rol

@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.username == form_data.username, Usuario.activo == True).first()
    
    if not usuario or not verificar_password(form_data.password, usuario.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    rol_efectivo = obtener_rol_efectivo(usuario, db)
    access_token = crear_token_acceso(data={"sub": str(usuario.id), "rol": usuario.rol, "rol_efectivo": rol_efectivo})
    
    # ==========================================
    # CONCATENACIÓN SEGURA DEL TÍTULO
    # ==========================================
    titulo_limpio = f"{usuario.titulo.strip()} " if usuario.titulo and str(usuario.titulo).strip() else ""
    nombre_final = f"{titulo_limpio}{usuario.nombre_completo}"
    
    return {
        "access_token": access_token, 
        "token_type": "bearer", 
        "rol": usuario.rol,
        "rol_efectivo": rol_efectivo,
        "nombre": nombre_final,  
        "cargo": usuario.cargo
    }