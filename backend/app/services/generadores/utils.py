from datetime import datetime
from num2words import num2words

def formatear_fecha_literal(fecha_str):
    if not fecha_str: return ""
    try:
        dt = datetime.strptime(fecha_str, "%Y-%m-%d" if "-" in fecha_str else "%d/%m/%Y")
        meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
        return f"{dt.day:02d} de {meses[dt.month - 1]} de {dt.year}"
    except Exception:
        return fecha_str

def monto_a_letras_bolivianos(monto: float):
    entero = int(monto)
    decimal = round((monto - entero) * 100)
    texto = num2words(entero, lang="es").title()
    if texto.startswith("Mil "): texto = "Un " + texto
    elif texto == "Mil": texto = "Un Mil"
    return f"{texto} {decimal:02d}/100 Bolivianos"