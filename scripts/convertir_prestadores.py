# -*- coding: utf-8 -*-
"""
Convierte data_geocoded.csv al clasificador destino.

Reglas:
  - El diccionario origen -> destino se toma de la columna "bis" de
    CLASIFICADORES DESTINO.xlsx (pares: columna destino / columna equivalencia).
  - Se aplica una capa de alias para variantes de escritura del origen
    (Traumatologia y Ortopedia, Diabetologia, variantes "Infantil", typos...).
  - GuardiaPasiva, Traslados y todo lo que no tenga equivalente se descarta.
  - Guardia activa sin equivalente -> GUARDIA GENERAL.
  - Se eliminan duplicados (mismo prestador + sucursal + plan + tipo + hoja).

Uso:
  python scripts/convertir_prestadores.py
"""

import csv
import os
import shutil
import tempfile
import unicodedata

import openpyxl

ORIGEN_CSV = r"C:\Users\facun\OneDrive\Escritorio\CONVERSION CLASIFICADORES\data_geocoded.csv"
DESTINO_XLSX = r"C:\Users\facun\OneDrive\Escritorio\CONVERSION CLASIFICADORES\CLASIFICADORES DESTINO.xlsx"

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SALIDA_CSV = os.path.join(BASE, "src", "data", "prestadores.csv")

# Encabezado de la columna destino -> nombre de la prestacion en la app
CATEGORIAS = {
    "ESPECIALIADES": "ESPECIALIDADES",
    "DIAGNOSTICO Y TRATAMIENTO": "DIAGNOSTICO Y TRATAMIENTO",
    "CLINICAS Y SANATORIOS PARA INTERNACION": "CLINICAS Y SANATORIOS PARA INTERNACION",
    "SALUD MENTAL": "SALUD MENTAL",
    "ODONTOLOGIA": "ODONTOLOGIA",
    "GUARDIA": "GUARDIA",
    "FARMACIAS": "FARMACIAS",
}

# Tipo de prestador del CSV -> categoria del clasificador origen
TIPO_ORIGEN = {
    "ESPECIALIDADESAMBULATORIO": "ESPECIALIDADES EN AMBULATORIO",
    "DIAGNOSTICOYTRATAMIENTO": "DIAGNOSTICO Y TRATAMIENTO",
    "CIRUGIAS": "CIRUGIAS",
    "GUARDIAACTIVA": "GUARDIA ACTIVA",
    "GUARDIAPASIVA": "GUARDIA PASIVA",
    "INTERNACION": "INTERNACION",
}

# Alias de origen: variantes de escritura -> valor canonico del clasificador origen.
# Solo se incluyen sinonimos / typos / variantes infantiles del MISMO concepto.
ALIAS = {
    # Traumatologia
    "ESPECIALIDADES EN AMBULATORIO;TRAUMATOLOGIA": "ESPECIALIDADES EN AMBULATORIO;TRAUMATOLOGIA",
    "ESPECIALIDADES EN AMBULATORIO;TRAUMATOLOGIA Y ORTOPEDIA": "ESPECIALIDADES EN AMBULATORIO;TRAUMATOLOGIA",
    "ESPECIALIDADES EN AMBULATORIO;TRAUMATOLOGIA Y ORTOPEDIA INFANTIL": "ESPECIALIDADES EN AMBULATORIO;TRAUMATOLOGIA",
    "ESPECIALIDADES EN AMBULATORIO;TRAUMATOLOGIA Y OROTOPEDIA": "ESPECIALIDADES EN AMBULATORIO;TRAUMATOLOGIA",
    # Diabetes
    "ESPECIALIDADES EN AMBULATORIO;DIABETOLOGIA": "ESPECIALIDADES EN AMBULATORIO;DIABETES",
    "ESPECIALIDADES EN AMBULATORIO;DIABETOLOGIA INFANTIL": "ESPECIALIDADES EN AMBULATORIO;DIABETES",
    # Variantes infantiles -> especialidad base
    "ESPECIALIDADES EN AMBULATORIO;ALERGIA E INMUNOLOGIA INFANTIL": "ESPECIALIDADES EN AMBULATORIO;ALERGIA E INMUNOLOGIA",
    "ESPECIALIDADES EN AMBULATORIO;CARDIOLOGIA INFANTIL": "ESPECIALIDADES EN AMBULATORIO;CARDIOLOGIA",
    "ESPECIALIDADES EN AMBULATORIO;DERMATOLOGIA INFANTIL": "ESPECIALIDADES EN AMBULATORIO;DERMATOLOGIA",
    "ESPECIALIDADES EN AMBULATORIO;ENDOCRINOLOGIA INFANTIL": "ESPECIALIDADES EN AMBULATORIO;ENDOCRINOLOGIA",
    "ESPECIALIDADES EN AMBULATORIO;GASTROENTEROLOGIA INFANTIL": "ESPECIALIDADES EN AMBULATORIO;GASTROENTEROLOGIA",
    "ESPECIALIDADES EN AMBULATORIO;GINECOLOGIA INFANTO JUVENIL": "ESPECIALIDADES EN AMBULATORIO;GINECOLOGIA",
    "ESPECIALIDADES EN AMBULATORIO;NEFROLOGIA INFANTIL": "ESPECIALIDADES EN AMBULATORIO;NEFROLOGIA",
    "ESPECIALIDADES EN AMBULATORIO;NEUMONOLOGIA INFANTIL": "ESPECIALIDADES EN AMBULATORIO;NEUMONOLOGIA",
    "ESPECIALIDADES EN AMBULATORIO;NEUMONOLOGIA PEDIATRICA": "ESPECIALIDADES EN AMBULATORIO;NEUMONOLOGIA",
    "ESPECIALIDADES EN AMBULATORIO;NEUROLOGIA INFANTIL": "ESPECIALIDADES EN AMBULATORIO;NEUROLOGIA",
    "ESPECIALIDADES EN AMBULATORIO;NUTRICION INFANTIL": "ESPECIALIDADES EN AMBULATORIO;NUTRICION",
    "ESPECIALIDADES EN AMBULATORIO;OFTALMOLOGIA INFANTIL": "ESPECIALIDADES EN AMBULATORIO;OFTALMOLOGIA",
    "ESPECIALIDADES EN AMBULATORIO;ONCOLOGIA INFANTIL": "ESPECIALIDADES EN AMBULATORIO;ONCOLOGIA",
    "ESPECIALIDADES EN AMBULATORIO;OTORRINOLARINGOLOGIA INFANTIL": "ESPECIALIDADES EN AMBULATORIO;OTORRINOLARINGOLOGIA",
    "ESPECIALIDADES EN AMBULATORIO;PSIQUIATRIA INFANTIL": "ESPECIALIDADES EN AMBULATORIO;PSIQUIATRIA",
    "ESPECIALIDADES EN AMBULATORIO;PSICOLOGIA INFANTIL": "ESPECIALIDADES EN AMBULATORIO;PSICOLOGIA",
    "ESPECIALIDADES EN AMBULATORIO;UROLOGIA INFANTIL": "ESPECIALIDADES EN AMBULATORIO;UROLOGIA",
    # Kinesiologia
    "ESPECIALIDADES EN AMBULATORIO;KINESIOLOGIA DOMICILIARIA": "ESPECIALIDADES EN AMBULATORIO;KINESIOLOGIA",
    "DIAGNOSTICO Y TRATAMIENTO;KINESIOLOGIA": "ESPECIALIDADES EN AMBULATORIO;KINESIOLOGIA",
    "DIAGNOSTICO Y TRATAMIENTO;REHABILITACION NEUROLOGICA": "DIAGNOSTICO Y TRATAMIENTO;REHABILITACION VESTIBULAR",
    # Typos / variantes
    "ESPECIALIDADES EN AMBULATORIO;DERMATOLOLGIA": "ESPECIALIDADES EN AMBULATORIO;DERMATOLOGIA",
    "ESPECIALIDADES EN AMBULATORIO;MEDICA CLINICA": "ESPECIALIDADES EN AMBULATORIO;CLINICA MEDICA",
    "ESPECIALIDADES EN AMBULATORIO;MEDICINA INTERNA": "ESPECIALIDADES EN AMBULATORIO;CLINICA MEDICA",
    "ESPECIALIDADES EN AMBULATORIO;UTOLOGIA": "ESPECIALIDADES EN AMBULATORIO;UROLOGIA",
    "ESPECIALIDADES EN AMBULATORIO;ALERGISTA": "ESPECIALIDADES EN AMBULATORIO;ALERGIA E INMUNOLOGIA",
    "ESPECIALIDADES EN AMBULATORIO;MEDICO DIAGNOSTICO POR IMAGENES": "DIAGNOSTICO Y TRATAMIENTO;RADIOLOGIA",
    # Diagnostico y tratamiento
    "DIAGNOSTICO Y TRATAMIENTO;ECOGRAFIA INFANTIL": "DIAGNOSTICO Y TRATAMIENTO;ECOGRAFIA",
    "DIAGNOSTICO Y TRATAMIENTO;ECOGRAFIA 4D/5D": "DIAGNOSTICO Y TRATAMIENTO;ECOGRAFIA",
    "DIAGNOSTICO Y TRATAMIENTO;ECOGRAFIA TN": "DIAGNOSTICO Y TRATAMIENTO;ECOGRAFIA",
    "DIAGNOSTICO Y TRATAMIENTO;ECOTRAFIA 4D/5D": "DIAGNOSTICO Y TRATAMIENTO;ECOGRAFIA",
    "DIAGNOSTICO Y TRATAMIENTO;TOMOGRAFIA": "DIAGNOSTICO Y TRATAMIENTO;TOMOGRAFIA COMPUTADA",
    "DIAGNOSTICO Y TRATAMIENTO;TOMAGRAFIA COMPUTADA": "DIAGNOSTICO Y TRATAMIENTO;TOMOGRAFIA COMPUTADA",
    "DIAGNOSTICO Y TRATAMIENTO;TOMOGRAFO ABIERTO": "DIAGNOSTICO Y TRATAMIENTO;TOMOGRAFIA COMPUTADA",
    "DIAGNOSTICO Y TRATAMIENTO;RESONANCIA": "DIAGNOSTICO Y TRATAMIENTO;RESONANCIA MAGNETICA NUCLEAR",
    "DIAGNOSTICO Y TRATAMIENTO;RESONADOR ABIERTO": "DIAGNOSTICO Y TRATAMIENTO;RESONANCIA MAGNETICA NUCLEAR",
    "DIAGNOSTICO Y TRATAMIENTO;ESPINOGRAFIA": "DIAGNOSTICO Y TRATAMIENTO;ESPINOGRAMA",
    "DIAGNOSTICO Y TRATAMIENTO;DENSITOMETRIA": "DIAGNOSTICO Y TRATAMIENTO;DENSITOMETRIA OSEA",
    "DIAGNOSTICO Y TRATAMIENTO;RADIOLOGIA INFANTIL": "DIAGNOSTICO Y TRATAMIENTO;RADIOLOGIA",
    # Guardia activa: variantes -> etiqueta existente
    "GUARDIA ACTIVA;OBSTETRICIA": "GUARDIA ACTIVA;OBSTETRICA",
    "GUARDIA ACTIVA;PEDIATRIA": "GUARDIA ACTIVA;PEDIATRICA",
    "GUARDIA ACTIVA;TRAUMATOLOGIA": "GUARDIA ACTIVA;TRAUMATOLOGICA",
    "GUARDIA ACTIVA;PSICOLOGIA": "GUARDIA ACTIVA;PSIQUIATRICA",
    # Guardia activa sin etiqueta propia -> GUARDIA GENERAL
    "GUARDIA ACTIVA;GENERAL": "GUARDIA ACTIVA;CLINICA",
    "GUARDIA ACTIVA;QUIRURGICA": "GUARDIA ACTIVA;CLINICA",
    "GUARDIA ACTIVA;QUIRUGICA": "GUARDIA ACTIVA;CLINICA",
    "GUARDIA ACTIVA;OTORRINOLARINGOLOGIA": "GUARDIA ACTIVA;CLINICA",
    "GUARDIA ACTIVA;GASTROENTEROLOGICA": "GUARDIA ACTIVA;CLINICA",
    "GUARDIA ACTIVA;QUEMADOS": "GUARDIA ACTIVA;CLINICA",
    "GUARDIA ACTIVA;POR MORDEDURA DE ANIMALES": "GUARDIA ACTIVA;CLINICA",
    "GUARDIA ACTIVA;POR ELECTROCUCION": "GUARDIA ACTIVA;CLINICA",
    "GUARDIA ACTIVA;POR INTOXICACION": "GUARDIA ACTIVA;CLINICA",
    "GUARDIA ACTIVA;POR ENVENENAMIENTO": "GUARDIA ACTIVA;CLINICA",
}

CAMPOS = [
    "Nombre", "CUIT", "NroPrestador", "Sucursal", "Provincia", "Seccional",
    "Partido", "Localidad", "Domicilio", "Telefono", "Clasificacion prestador",
    "Tipo de prestador", "Especialidad", "Plan", "lat", "lon", "estrategia",
    "Prestacion",
]


def norm(valor):
    txt = (valor or "").strip()
    txt = unicodedata.normalize("NFKD", txt)
    txt = "".join(c for c in txt if not unicodedata.combining(c))
    txt = txt.replace("-", " ")
    txt = txt.replace("_", " ")
    return " ".join(txt.upper().split())


def cargar_diccionario():
    """Devuelve {origen_normalizado: (hoja_destino, categoria_destino)}."""
    tmp = os.path.join(tempfile.gettempdir(), "clasificadores_destino.xlsx")
    shutil.copy2(DESTINO_XLSX, tmp)  # puede estar abierto en Excel
    wb = openpyxl.load_workbook(tmp, data_only=True)
    ws = wb.active
    filas = list(ws.iter_rows(values_only=True))
    encabezado = filas[0]

    dicc = {}
    for col in range(0, len(encabezado) - 1, 2):
        categoria = CATEGORIAS.get((encabezado[col] or "").strip(), (encabezado[col] or "").strip())
        for fila in filas[1:]:
            hoja, origen = fila[col], fila[col + 1]
            if not hoja or not origen:
                continue
            hoja = str(hoja).replace("\ufffd", "Á").strip()
            clave = norm(origen)
            if clave in dicc and dicc[clave][0] != hoja:
                raise ValueError("Origen con dos destinos distintos: %s" % clave)
            dicc[clave] = (hoja, categoria)
    return dicc


def main():
    dicc = cargar_diccionario()

    descartes = {}
    convertidas = 0
    total = 0
    prestadores_entrada = set()
    salida = []
    vistos = set()
    duplicados = 0

    with open(ORIGEN_CSV, encoding="utf-8-sig", newline="") as archivo:
        lector = csv.DictReader(archivo, delimiter=";")
        for fila in lector:
            total += 1
            prestadores_entrada.add((fila.get("NroPrestador", ""), fila.get("Sucursal", "")))
            tipo = fila.get("Tipo de prestador", "").strip()
            esp = fila.get("Especialidad", "").strip()

            if norm(tipo) == "GUARDIAPASIVA":
                descartes["Guardia pasiva"] = descartes.get("Guardia pasiva", 0) + 1
                continue
            if norm(esp) == "TRASLADOS":
                descartes["Traslados"] = descartes.get("Traslados", 0) + 1
                continue
            if not tipo or not esp:
                descartes["Sin tipo/especialidad"] = descartes.get("Sin tipo/especialidad", 0) + 1
                continue

            categoria_origen = TIPO_ORIGEN.get(norm(tipo), norm(tipo))
            clave = "%s;%s" % (categoria_origen, norm(esp))
            clave = ALIAS.get(clave, clave)

            destino = dicc.get(clave)
            if not destino:
                if categoria_origen == "GUARDIA ACTIVA":
                    destino = ("GUARDIA GENERAL", "GUARDIA")
                else:
                    motivo = "%s sin equivalente" % categoria_origen.title()
                    descartes[motivo] = descartes.get(motivo, 0) + 1
                    continue

            hoja, categoria = destino
            clave_unica = (
                fila.get("NroPrestador", ""), fila.get("Sucursal", ""), fila.get("Plan", ""),
                tipo, hoja,
            )
            if clave_unica in vistos:
                duplicados += 1
                continue
            vistos.add(clave_unica)

            nueva = dict(fila)
            nueva["Especialidad"] = hoja
            nueva["Prestacion"] = categoria
            salida.append(nueva)
            convertidas += 1

    os.makedirs(os.path.dirname(SALIDA_CSV), exist_ok=True)
    with open(SALIDA_CSV, "w", encoding="utf-8-sig", newline="") as archivo:
        escritor = csv.DictWriter(archivo, fieldnames=CAMPOS, delimiter=";", extrasaction="ignore")
        escritor.writeheader()
        escritor.writerows(salida)

    prestadores = {(f["NroPrestador"], f["Sucursal"]) for f in salida}

    print("Entrada : %6d filas  (%d prestadores)" % (total, len(prestadores_entrada)))
    print("Salida  : %6d filas  (%d prestadores)" % (convertidas, len(prestadores)))
    print("Duplicados eliminados: %d" % duplicados)
    print()
    print("Descartados:")
    for motivo, cant in sorted(descartes.items(), key=lambda x: -x[1]):
        print("  %-45s %6d" % (motivo, cant))
    print("  %-45s %6d" % ("TOTAL", sum(descartes.values())))
    print()
    print("Archivo: %s" % SALIDA_CSV)


if __name__ == "__main__":
    main()
