import pytest
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture(scope="module")
def client():
    """
    Fixture de pytest que provee un TestClient para realizar peticiones a la API en pruebas.
    """
    with TestClient(app) as test_client:
        yield test_client
