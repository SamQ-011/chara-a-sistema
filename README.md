# Sistema Charaña - GAMCH 🚀

Sistema de Gestión de Hoja de Ruta y Tramitación de Procesos de Contratación para el Gobierno Autónomo Municipal de Charaña (GAMCH).

---

## 🏗️ Arquitectura del Proyecto

- **Backend:** Python 3.10+ | FastAPI | SQLAlchemy 2.0 | PostgreSQL | Pydantic v2
- **Frontend:** Vanilla HTML5 / JavaScript ES6+ | Tailwind CSS v3
- **Base de Datos:** PostgreSQL 15 en Docker

---

## ⚡ Inicio Rápido (Desarrollo)

### 1. Variables de Entorno
Asegúrate de contar con el archivo `.env` en la raíz del proyecto configurado con tus credenciales locales:
```env
POSTGRES_USER=admin
POSTGRES_PASSWORD=adminpassword
POSTGRES_DB=db_hoja_ruta
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
DATABASE_URL=postgresql://admin:adminpassword@localhost:5432/db_hoja_ruta
SECRET_KEY=tu_clave_secreta_jwt
```

### 2. Base de Datos (Docker)
Inicia el contenedor de la base de datos PostgreSQL:
```bash
docker-compose up -d
```

### 3. Backend (FastAPI)
Instala las dependencias y ejecuta el servidor de desarrollo:
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```
Acceso a la documentación interactiva Swagger: [http://localhost:8000/docs](http://localhost:8000/docs)

### 4. Frontend & Tailwind CSS
Ejecuta el compilador en tiempo real de Tailwind CSS:
```bash
npm run dev:css
```

---

## 🧪 Pruebas Automatizadas (Backend)

Para ejecutar la suite de pruebas unitarias e integración:
```bash
pytest backend/tests
```
O usando npm:
```bash
npm run test:backend
```

---

## 👥 Estructura del Código

```text
├── backend/
│   ├── app/
│   │   ├── api/          # Rutas y endpoints (auth, procesos, catalogos, usuarios)
│   │   ├── core/         # Configuración base, DB y seguridad JWT
│   │   ├── models/       # Modelos SQLAlchemy
│   │   └── schemas/      # Esquemas Pydantic v2
│   └── tests/            # Tests automatizados (pytest)
├── frontend/
│   ├── css/              # Archivos de estilos e input/output Tailwind CSS
│   ├── js/               # Controladores y servicios de la interfaz
│   └── *.html            # Vistas del sistema
├── docker-compose.yml
└── package.json
```
