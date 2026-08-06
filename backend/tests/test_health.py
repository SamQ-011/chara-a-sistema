def test_root_redirection(client):
    """
    Verifica que la ruta raíz (/) redirija correctamente a la interfaz estática (/static/index.html).
    """
    response = client.get("/", follow_redirects=False)
    assert response.status_code in [302, 307, 303]
    assert response.headers["location"] == "/static/index.html"

def test_static_index_availability(client):
    """
    Verifica que el archivo estático index.html sea accesible.
    """
    response = client.get("/static/index.html")
    assert response.status_code == 200
    assert "text/html" in response.headers.get("content-type", "")
