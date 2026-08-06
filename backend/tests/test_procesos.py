def test_listar_procesos_unauthorized(client):
    """
    Verifica que listar procesos de contratación sin estar autenticado retorne 401 Unauthorized.
    """
    response = client.get("/api/procesos/")
    assert response.status_code == 401

def test_crear_proceso_unauthorized(client):
    """
    Verifica que la creación de procesos exija autenticación.
    """
    payload = {
        "variables_ui": {
            "proveedor": "PROVEEDOR TEST",
            "nit": "123456789",
            "codigo": "PROC-2026-001",
            "objeto": "COMPRA DE MATERIAL DE OFICINA",
            "desca": "GASTO CORRIENTE",
            "cod_proy": "PROY-01",
            "uni_solic": "ADMINISTRACION",
            "monto_total": 1500.00
        },
        "items": [],
        "gastos": []
    }
    response = client.post("/api/procesos/", json=payload)
    assert response.status_code == 401
