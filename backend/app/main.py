from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from app.api import catalogos, procesos, rutas_auth

app = FastAPI(title="API Hoja de Ruta - GAMCH")

# Configuración de CORS para permitir que el frontend se conecte sin bloqueos
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

class NoCacheStaticMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        if request.url.path.startswith("/static/") and (
            request.url.path.endswith(".js") or request.url.path.endswith(".css")
        ):
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        return response

app.add_middleware(NoCacheStaticMiddleware)

app.mount("/static", StaticFiles(directory="../frontend"), name="static")

# Registrar las rutas
app.include_router(catalogos.router)
app.include_router(procesos.router)
app.include_router(rutas_auth.router, prefix="/api/auth", tags=["Autenticación"])

@app.get("/")
def read_index():
    return RedirectResponse(url="/static/index.html")