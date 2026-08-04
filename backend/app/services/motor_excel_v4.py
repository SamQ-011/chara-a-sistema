import os
import shutil
import zipfile
import re

# ── Helpers XML ──────────────────────────────────────────────────────────────

def _esc(text: str) -> str:
    return (str(text)
            .replace('&', '&amp;')
            .replace('<', '&lt;')
            .replace('>', '&gt;')
            .replace('"', '&quot;'))

def _cell_inline(ref: str, style: str, value) -> str:
    if isinstance(value, (int, float)):
        return f'<c r="{ref}" s="{style}"><v>{value}</v></c>'
    return f'<c r="{ref}" s="{style}" t="inlineStr"><is><t>{_esc(str(value))}</t></is></c>'

def _cell_empty(ref: str, style: str) -> str:
    return f'<c r="{ref}" s="{style}"/>'

# ── Generación de filas de ítems (ARQUITECTURA DE 1 FILA) ─────────────────────

def _hacer_filas_item(row_n: int, item: dict, mapeo_columnas: dict, est_f1: dict) -> list:
    def _num(val):
        try: return float(val)
        except (ValueError, TypeError): return val

    cols_inv = {v: k for k, v in mapeo_columnas.items()}
    
    # Calcular el ancho REAL basado en la plantilla, no en el mapeo
    columnas_plantilla = list(est_f1.keys())
    if columnas_plantilla:
        max_col_idx = max(ord(c) - 64 for c in columnas_plantilla)
    else:
        max_col_idx = max(mapeo_columnas.values())
        
    spans = f"2:{max_col_idx}"
    
    item_copy = item.copy()
    
    # =================================================================
    # MAGIA DE CONCATENACIÓN: Unimos Objeto Corto y Descripción Larga
    # =================================================================
    if 'objeto' in mapeo_columnas:
        obj_corto = str(item.get('objeto', '')).upper()
        desc_larga = str(item.get('descripcion', ''))
        # Si hay descripción, ponemos un Enter (\n). Si no hay, solo el objeto.
        item_copy['objeto'] = f"{obj_corto}\n{desc_larga}" if desc_larga.strip() else obj_corto

    cells_data = ""
    for col_idx in range(2, max_col_idx + 1):
        col_letra = chr(64 + col_idx)
        style = est_f1.get(col_letra, '0')
        if col_idx in cols_inv:
            val = _num(item_copy.get(cols_inv[col_idx], ''))
            cells_data += _cell_inline(f"{col_letra}{row_n}", style, val)
        else:
            cells_data += _cell_empty(f"{col_letra}{row_n}", style)

    return [f'<row r="{row_n}" spans="{spans}">{cells_data}</row>']


def _hacer_fila_oculta(row_n: int, mapeo_columnas: dict, est_f1: dict) -> str:
    columnas_plantilla = list(est_f1.keys())
    if columnas_plantilla:
        max_col_idx = max(ord(c) - 64 for c in columnas_plantilla)
    else:
        max_col_idx = max(mapeo_columnas.values())

    spans = f"2:{max_col_idx}"
    cells_data = "".join(
        _cell_empty(f"{chr(64 + i)}{row_n}", est_f1.get(chr(64 + i), "0")) 
        for i in range(2, max_col_idx + 1)
    )
    return f'<row r="{row_n}" spans="{spans}" hidden="1">{cells_data}</row>'

# ── Detección de anclas (sobre XMLs ORIGINALES) ───────────────────────────────

def _detectar_filas_y_estilos(sheet_xml: str, shared_xml: str) -> tuple:
    strings = re.findall(r'<si>(.*?)</si>', shared_xml, re.DOTALL)
    str_values = [''.join(re.findall(r'<t[^>]*>([^<]*)</t>', s)) for s in strings]

    idx_nro = next((i for i, v in enumerate(str_values) if '{NRO}' in v), None)

    palabras_footer = ["en conformidad", "recibí", "entregue", "total, precio estimado", "importe total"]
    footer_indices = {i for i, v in enumerate(str_values) if any(p in v.lower() for p in palabras_footer)}

    rows = re.findall(r'<row[^>]*r="(\d+)"[^>]*>(.*?)</row>', sheet_xml, re.DOTALL)

    fila_base = None
    fila_footer = None
    est_f1 = {}

    for row_num, row_content in rows:
        n = int(row_num)
        shared_refs = set(int(v) for v in re.findall(r't="s"[^>]*><v>(\d+)</v>', row_content))

        # Capturar estilos de la fila Base
        if fila_base is None and idx_nro is not None and idx_nro in shared_refs:
            fila_base = n
            for c, s in re.findall(r'<c r="([A-Z]+)\d+"[^>]*s="(\d+)"', row_content):
                est_f1[c] = s
            continue

        if fila_base and fila_footer is None and n > fila_base:
            if shared_refs & footer_indices:
                fila_footer = n
                break

    return fila_base, fila_footer, est_f1

# ── Reemplazo de bloque de filas en el XML ───────────────────────────────────

def _reemplazar_bloque_filas(sheet_xml: str, desde: int, hasta: int, nuevas: list[str]) -> str:
    patron = re.compile(r'<row[^>]*r="(\d+)"[^>]*>(?:(?!</row>).)*</row>', re.DOTALL)
    resultado = []
    pos = 0
    bloque_insertado = False

    for m in patron.finditer(sheet_xml):
        n = int(re.search(r'r="(\d+)"', m.group()).group(1))
        if desde <= n < hasta:
            if not bloque_insertado:
                resultado.append(sheet_xml[pos:m.start()])
                resultado.append('\n'.join(nuevas))
                bloque_insertado = True
                pos = m.end()
            else:
                pos = m.end()

    resultado.append(sheet_xml[pos:])
    return ''.join(resultado)

# ── Motor principal ───────────────────────────────────────────────────────────

def generar_documento_excel(
    ruta_plantilla: str,
    ruta_salida:    str,
    datos_variables: dict,
    tabla_items:    list,
    mapeo_columnas: dict,
    tipo_cabecera:  str
) -> str:

    if not os.path.exists(ruta_plantilla):
        raise FileNotFoundError(f"No se encontró la plantilla: {ruta_plantilla}")

    os.makedirs(os.path.dirname(ruta_salida) or '.', exist_ok=True)
    shutil.copy2(ruta_plantilla, ruta_salida)

    with zipfile.ZipFile(ruta_salida, 'r') as z:
        contenidos = {name: z.read(name) for name in z.namelist()}

    # XMLs que recibirán reemplazo de variables de texto
    xmls_texto = ['xl/sharedStrings.xml', 'xl/worksheets/sheet1.xml']
    for name in list(contenidos.keys()):
        if name.startswith('xl/drawings/') and name.endswith('.xml'):
            xmls_texto.append(name)

    sheet_original  = contenidos.get('xl/worksheets/sheet1.xml', b'').decode('utf-8')
    shared_original = contenidos.get('xl/sharedStrings.xml', b'').decode('utf-8')

    # Detectamos la estructura basada en 1 sola fila por ítem
    fila_base, fila_footer, est_f1 = _detectar_filas_y_estilos(sheet_original, shared_original)

    for xml_path in xmls_texto:
        if xml_path not in contenidos:
            continue
        texto = contenidos[xml_path].decode('utf-8')
        for etiqueta, valor in datos_variables.items():
            texto = texto.replace(etiqueta, _esc(str(valor).upper()))
        contenidos[xml_path] = texto.encode('utf-8')

    if fila_base and fila_footer:
        # AHORA SIEMPRE ES 1 FILA POR ÍTEM, ya no dividimos entre 2
        espacio_disponible = fila_footer - fila_base
        max_items = espacio_disponible

        nuevas_filas = []
        items_a_usar = tabla_items[:max_items]

        for i, item in enumerate(items_a_usar):
            row_n = fila_base + i
            nuevas_filas.extend(_hacer_filas_item(row_n, item, mapeo_columnas, est_f1))

        filas_usadas = len(items_a_usar)
        for offset in range(filas_usadas, espacio_disponible):
            nuevas_filas.append(_hacer_fila_oculta(fila_base + offset, mapeo_columnas, est_f1))

        sheet_modificado = _reemplazar_bloque_filas(
            contenidos['xl/worksheets/sheet1.xml'].decode('utf-8'),
            fila_base, fila_footer, nuevas_filas
        )
        contenidos['xl/worksheets/sheet1.xml'] = sheet_modificado.encode('utf-8')
        
    tmp = ruta_salida + ".tmp"
    with zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as zout:
        for name, blob in contenidos.items():
            if name == 'xl/calcChain.xml':
                continue
            zout.writestr(name, blob)
    os.replace(tmp, ruta_salida)

    return ruta_salida