import os
from sqlalchemy.orm import Session
from app.core.base_datos import SessionLocal, engine, Base
from app.models.tablas_base import PoaPrograma, PoaProyecto, PoaPartida

# Crea las tablas si no existen
Base.metadata.create_all(bind=engine)

def sembrar_poa():
    db: Session = SessionLocal()
    
    # Limpiar tablas para evitar duplicados si lo corres por error dos veces
    db.query(PoaPartida).delete()
    db.query(PoaProyecto).delete()
    db.query(PoaPrograma).delete()
    db.commit()

    from pathlib import Path
    txt_path = Path(__file__).resolve().parent.parent / "programas-proyectos.txt"
    if not txt_path.exists():
        txt_path = Path("programas-proyectos.txt")

    with open(txt_path, "r", encoding="utf-8") as f:
        lineas = f.readlines()

    prog_actual = None
    proy_actual = None

    for linea in lineas:
        linea = linea.strip()
        if not linea: continue

        if linea.startswith("Programa"):
            codigo, nombre = linea.replace("Programa ", "").split(":", 1)
            prog_actual = PoaPrograma(codigo=codigo.strip(), nombre=nombre.strip())
            db.add(prog_actual)
            db.flush() 

        elif linea.startswith("Proyecto/Actividad"):
            codigos, nombre = linea.replace("Proyecto/Actividad ", "").split(":", 1)
            proy, act = codigos.split("/")
            proy_actual = PoaProyecto(
                programa_id=prog_actual.id,
                codigo_proy=proy.strip().zfill(4), 
                actividad=act.strip().zfill(3),
                nombre=nombre.strip()
            )
            db.add(proy_actual)
            db.flush()

        elif linea[0].isdigit():
            # Parsear: "1.1.4 Aguinaldos - Fte. Fin: 41, Org. Fin: 113, Ent. Trf: 0000"
            partes = linea.split(" - Fte. Fin: ")
            if len(partes) == 2:
                texto_izq = partes[0].strip()
                codigo_partida = texto_izq.split(" ")[0]
                descripcion = texto_izq.replace(codigo_partida, "").strip()

                finanzas = partes[1]
                ff = finanzas.split(",")[0].strip()
                of = finanzas.split("Org. Fin: ")[1].split(",")[0].strip()

                partida = PoaPartida(
                    proyecto_id=proy_actual.id,
                    codigo=codigo_partida,
                    descripcion=descripcion,
                    ff=ff,
                    of=of
                )
                db.add(partida)

    db.commit()
    db.close()
    print("Migracion del POA completada con exito.")

if __name__ == "__main__":
    sembrar_poa()