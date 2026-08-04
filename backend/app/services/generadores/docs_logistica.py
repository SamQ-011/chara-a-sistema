import os
from app.services.motor_excel_v4 import generar_documento_excel
from app.services.generadores.utils import formatear_fecha_literal

RUTA_PLANTILLAS = "Plantillas"
RUTA_RESULTADOS = "Resultados"
MAPEO_LOGISTICA = {'nro': 2, 'descripcion': 3, 'tipuni': 4, 'cant': 5}

def procesar_items_logistica(ctx, datos_modal):
    items_crudos = datos_modal.get("items_almacen", ctx['items_mapeados'])
    items_locales = []
    for i in items_crudos:
        obj = i.get("objeto", i.get("objeto_corto", ""))
        desc = i.get("descripcion", i.get("descripcion_larga", ""))
        texto_unido = f"{obj}\n{desc}" if desc else obj
        
        items_locales.append({
            "nro": i.get("nro", i.get("nro_item", "")),
            "descripcion": texto_unido,
            "tipuni": i.get("tipuni", i.get("unidad", "")),
            "cant": i.get("cant", i.get("cantidad", ""))
        })
    return items_locales

def generar_ingreso_almacenes(ctx):
    # INYECCIÓN DEL ID ÚNICO
    ruta = os.path.join(ctx['ruta_directorio'], f"{ctx['proceso'].id}_1_IngresoAlmacenes.xlsx")
    doc_alm = next((d for d in ctx['proceso'].documentos if d.clave_documento == "almacenes"), None)
    datos_modal = doc_alm.datos_formulario if doc_alm and doc_alm.datos_formulario else {}

    vars_ing = {
        "{FECHA}": formatear_fecha_literal(datos_modal.get("fecha_ingreso", ctx['fecha_corta'])),
        "{FECHA_ACTUAL}": formatear_fecha_literal(datos_modal.get("fecha_ingreso", ctx['fecha_corta'])),
        "{DESC}": ctx['proceso'].objeto_contratacion or "",
        "{PROV}": ctx['proceso'].proveedor.razon_social if ctx['proceso'].proveedor else "S/N",
        "{CINIT}": ctx['proceso'].proveedor.nit_ci if ctx['proceso'].proveedor else "S/N",
        "{CEL}": ctx['proceso'].proveedor.telefono if ctx['proceso'].proveedor else "S/N"
    }

    items_locales = procesar_items_logistica(ctx, datos_modal)
    generar_documento_excel(f"{RUTA_PLANTILLAS}/ingreso_almacenes.xlsx", ruta, {**ctx['variables'], **vars_ing}, items_locales, MAPEO_LOGISTICA, "logistica")
    return ruta

def generar_salida_almacenes(ctx):
    # INYECCIÓN DEL ID ÚNICO
    ruta = os.path.join(ctx['ruta_directorio'], f"{ctx['proceso'].id}_2_SalidaAlmacenes.xlsx")
    doc_alm = next((d for d in ctx['proceso'].documentos if d.clave_documento == "almacenes"), None)
    datos_modal = doc_alm.datos_formulario if doc_alm and doc_alm.datos_formulario else {}

    vars_sal = {
        "{FECHA}": formatear_fecha_literal(datos_modal.get("fecha_salida", ctx['fecha_corta'])),
        "{FECHA_ACTUAL}": formatear_fecha_literal(datos_modal.get("fecha_salida", ctx['fecha_corta'])),
        "{DESCA}": datos_modal.get("proyecto_corto", ""),
        "{DESC}": ctx['proceso'].objeto_contratacion or "",
        "{PROV}": ctx['proceso'].proveedor.razon_social if ctx['proceso'].proveedor else "S/N",
        "{CINIT}": ctx['proceso'].proveedor.nit_ci if ctx['proceso'].proveedor else "S/N",
        "{CEL}": ctx['proceso'].proveedor.telefono if ctx['proceso'].proveedor else "S/N"
    }

    items_locales = procesar_items_logistica(ctx, datos_modal)
    generar_documento_excel(f"{RUTA_PLANTILLAS}/salida_almacenes.xlsx", ruta, {**ctx['variables'], **vars_sal}, items_locales, MAPEO_LOGISTICA, "logistica")
    return ruta

def generar_ambos_almacenes(ctx):
    generar_ingreso_almacenes(ctx)
    return generar_salida_almacenes(ctx)