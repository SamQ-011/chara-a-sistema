import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_correspondencia_flow():
    # 1. Login como Secretaria / Recepción
    resp = client.post("/api/auth/login", data={"username": "maria.ventanilla", "password": "gamch2026"})
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Registrar ingreso de correspondencia
    payload_corr = {
        "tipo_remitente": "INSTITUCIONAL",
        "nombre_remitente": "Junta Vecinal Central Charaña",
        "cargo_remitente": "Presidente de OTB",
        "telefono_remitente": "71234567",
        "cite_origen": "CITE N° 045/2026",
        "fecha_doc_origen": "2026-08-10",
        "tipo_documento": "SOLICITUD",
        "asunto": "Solicitud de adquisición de materiales escolares para 18 U.E. Charaña",
        "nro_fojas": 4,
        "anexos": "1 CD de fotos",
        "unidad_destino_id": 2,
        "instruccion_proveido": "Para su atención e informe técnico"
    }

    create_resp = client.post("/api/correspondencia/", json=payload_corr, headers=headers)
    assert create_resp.status_code == 201
    hr_data = create_resp.json()["data"]
    assert "numero_hr" in hr_data
    hr_id = hr_data["hoja_ruta_id"]

    # 3. Listar correspondencia
    list_resp = client.get("/api/correspondencia/", headers=headers)
    assert list_resp.status_code == 200
    items = list_resp.json()["data"]
    assert len(items) >= 1

    # 4. Obtener detalle de correspondencia
    detail_resp = client.get(f"/api/correspondencia/{hr_id}", headers=headers)
    assert detail_resp.status_code == 200
    assert detail_resp.json()["data"]["numero_hr"] == hr_data["numero_hr"]

    # 5. Promover a Proceso de Contratación
    promo_resp = client.post(f"/api/correspondencia/{hr_id}/promover-contratacion", headers=headers)
    assert promo_resp.status_code == 200
    assert promo_resp.json()["success"] is True
    proceso_id = promo_resp.json()["data"]["proceso_id"]
    assert proceso_id is not None
