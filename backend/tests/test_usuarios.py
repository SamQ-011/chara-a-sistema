def test_listar_usuarios_unauthorized(client):
    """
    Verifica que listar usuarios sin token JWT sea rechazado con 401 Unauthorized.
    """
    response = client.get("/api/usuarios/")
    assert response.status_code == 401
    assert "detail" in response.json()

def test_crear_usuario_unauthorized(client):
    """
    Verifica que crear usuario sin estar autenticado sea rechazado con 401.
    """
    payload = {
        "username": "test_new_user",
        "password": "securepassword123",
        "nombre_completo": "Test User",
        "rol": "SOLICITANTE"
    }
    response = client.post("/api/usuarios/", json=payload)
    assert response.status_code == 401
