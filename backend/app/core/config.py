from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # Configuración de Base de Datos
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_DB: str
    POSTGRES_HOST: str
    POSTGRES_PORT: int
    DATABASE_URL: str
    
    # Seguridad y JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 horas de jornada laboral

    # Configuración de carga automática de archivos de entorno (Estándar Pydantic v2)
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8", 
        extra="ignore"
    )

MATRIZ_REQUISITOS = {
    "ESTANDAR": {
        "solicitud_cp",
        "cert_presupuestaria",
        "solicitud_inicio",
        "autorizacion_inicio",
        "informe_cotizacion",
        "orden_compra",
        "notificacion_adjudicacion",
        "almacenes",
        "acta_recepcion",
        "informe_conformidad"
    }
}

settings = Settings()