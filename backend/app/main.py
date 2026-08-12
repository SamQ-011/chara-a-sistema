from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from app.api import catalogos, procesos, rutas_auth, rutas_usuarios, rutas_correspondencia

app = FastAPI(title="API Hoja de Ruta - GAMCH")

from app.core.config import settings

# Configuración de CORS segura para entorno local y red LAN institucional
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

class SmartStaticCacheMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        path = request.url.path
        if path.startswith("/static/"):
            if path.endswith(".html"):
                response.headers["Cache-Control"] = "no-cache, must-revalidate"
            elif any(path.endswith(ext) for ext in [".js", ".css", ".png", ".jpg", ".jpeg", ".svg", ".woff2"]):
                response.headers["Cache-Control"] = "public, max-age=3600"
        return response

app.add_middleware(SmartStaticCacheMiddleware)

from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"
if not FRONTEND_DIR.exists():
    FRONTEND_DIR = Path("../frontend")

app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

# Registrar las rutas
app.include_router(catalogos.router)
app.include_router(procesos.router)
app.include_router(rutas_auth.router, prefix="/api/auth", tags=["Autenticación"])
app.include_router(rutas_usuarios.router)
app.include_router(rutas_correspondencia.router)

@app.get("/")
def read_index():
    return RedirectResponse(url="/static/index.html")