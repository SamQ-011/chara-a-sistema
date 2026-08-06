def test_login_invalid_credentials(client):
    """
    Verifica que intentar iniciar sesión con credenciales inválidas retorne 401 Unauthorized.
    """
    response = client.post(
        "/api/auth/login",
        data={"username": "invalid_user", "password": "wrong_password"}
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Usuario o contraseña incorrectos"
