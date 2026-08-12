import pytest
from app.services.proceso_service import evaluar_estado_proceso, resolver_firmante_solicitante, generar_codigo_proceso
from app.models.tablas_transaccionales import Proceso, EstadoProceso, DocumentoProceso, EstadoDocumento

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
        "objeto": "COMPRA DE MATERIAL DE OFICINA"
    }
    response = client.post("/api/procesos/", json=payload)
    assert response.status_code == 401

def test_evaluar_estado_proceso_borrador():
    """
    Prueba unitaria para la evaluación de estado BORRADOR cuando no hay documentos finalizados.
    """
    proceso = Proceso(id=1, estado=EstadoProceso.BORRADOR)
    proceso.documentos = []
    evaluar_estado_proceso(proceso)
    assert proceso.estado == EstadoProceso.BORRADOR

def test_evaluar_estado_proceso_en_curso():
    """
    Prueba unitaria para la evaluación de estado EN_CURSO cuando existen documentos parciales.
    """
    proceso = Proceso(id=1, estado=EstadoProceso.BORRADOR)
    proceso.documentos = [
        DocumentoProceso(clave_documento="solicitud_cp", estado=EstadoDocumento.FINALIZADO)
    ]
    evaluar_estado_proceso(proceso)
    assert proceso.estado == EstadoProceso.EN_CURSO

def test_evaluar_estado_proceso_anulado():
    """
    Verifica que un proceso ANULADO no cambie de estado al evaluarse.
    """
    proceso = Proceso(id=1, estado=EstadoProceso.ANULADO)
    evaluar_estado_proceso(proceso)
    assert proceso.estado == EstadoProceso.ANULADO
