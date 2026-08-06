def test_listar_proveedores(client):
    """
    Verifica que la consulta de proveedores retorne código 200 y una lista.
    """
    response = client.get("/api/proveedores")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_listar_unidades(client):
    """
    Verifica que la consulta de unidades organizacionales retorne código 200 y una lista.
    """
    response = client.get("/api/unidades")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_obtener_arbol_poa(client):
    """
    Verifica que el árbol POA sea accesible públicamente para los selectores.
    """
    response = client.get("/api/poa/arbol")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_crear_programa_poa_unauthorized(client):
    """
    Verifica que intentar crear un programa POA sin autenticación sea rechazado.
    """
    payload = {
        "codigo": "PROG-TEST-01",
        "nombre": "Programa de Prueba"
    }
    response = client.post("/api/poa/programas", json=payload)
    # Debe ser rechazado al no enviar encabezado de autenticación (401 o 403)
    assert response.status_code in [401, 403]
