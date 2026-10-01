#!/usr/bin/env python3
"""Puntúa los tratos de Trato Hecho desde la terminal, con la misma regla que la web.

    python3 puntuar.py S1-BEDCD S2-SIN-CBCBB-T S3-CBCBB
      (S<sala>-<5 letras> si hubo trato; S<sala>-SIN[-<última propuesta>][-A|C|T] si no:
       A rechazó la agencia, C el cliente, T se acabó el tiempo)
    python3 puntuar.py < chat.txt          # pega el chat completo; los códigos se buscan solos
    python3 puntuar.py --optimo            # el mejor trato posible y la frontera de valor

Lee datos.js de esta misma carpeta, así que cambiar un número ahí cambia los dos.
"""
import json
import re
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent


def cargar():
    src = (AQUI / "datos.js").read_text(encoding="utf-8")
    return json.loads(src[src.index("{"): src.rindex("}") + 1])


D = cargar()
TEMAS = D["temas"]
PLAN_B = {l: D["lados"][l]["planB"]["puntos"] for l in ("agencia", "cliente")}
RE_CODIGO = re.compile(r"\bS\s*(\d{1,2})\s*-\s*(?:SIN(?:\s*-\s*([A-Za-z]{5}))?(?:\s*-\s*([ACT]))?\b|([A-Za-z]{5})\b)", re.I)
QUIEN = {"A": "la agencia", "C": "el cliente", "T": "se acabó el tiempo"}


def opcion(i, letra):
    return next((o for o in TEMAS[i]["opciones"] if o["letra"] == letra), None)


def puntos(letras, lado):
    return sum(opcion(i, l)[lado] for i, l in enumerate(letras))


def indice(a, c):
    return a + c - abs(a - c) / 2


def evaluar(sala, cierre):
    """`cierre` es {"letras": [...]} si hubo trato, o {"letras": None, "ultima": [...] | None,
    "quien": "A" | "C" | "T" | None} si no lo hubo."""
    pa, pc = PLAN_B["agencia"], PLAN_B["cliente"]
    letras = cierre.get("letras")
    if letras is None:
        r = dict(sala=sala, trato="SIN", a=pa, c=pc, indice=indice(pa, pc), valido=True, perdido=0,
                 quien=cierre.get("quien"), ultima=None,
                 motivo="sin acuerdo: cada parte se queda con su plan B")
        ultima = cierre.get("ultima")
        if ultima:
            ua, uc = puntos(ultima, "agencia"), puntos(ultima, "cliente")
            ui = indice(ua, uc)
            r["ultima"] = dict(letras="".join(ultima), a=ua, c=uc, indice=ui)
            bien_a, bien_c = ua >= pa, uc >= pc
            if bien_a and bien_c:
                r["perdido"] = max(0, ui - r["indice"])
                cabeza = "se acabó el tiempo con un buen trato en la mesa" if r["quien"] == "T" else "trato perdido"
                r["motivo"] = (f"{cabeza}: la última propuesta daba {ua} a la agencia y {uc} al cliente "
                               f"(índice {ui:g}), mejor que el plan B de los dos")
            else:
                perjudicados = " y ".join(n for n, bien in (("a la agencia", bien_a), ("al cliente", bien_c)) if not bien)
                correcto = (r["quien"] == "A" and not bien_a) or (r["quien"] == "C" and not bien_c)
                cabeza = "levantarse fue correcto" if correcto else "la última propuesta no servía"
                r["motivo"] = f"{cabeza}: dejaba {perjudicados} por debajo de su plan B" + ("; se acabó el tiempo" if r["quien"] == "T" else "")
        elif r["quien"]:
            r["motivo"] += "; se acabó el tiempo" if r["quien"] == "T" else f"; se levantó {QUIEN[r['quien']]}"
        return r
    a, c = puntos(letras, "agencia"), puntos(letras, "cliente")
    bajo = [l for l, p in (("agencia", a), ("cliente", c)) if p < PLAN_B[l]]
    motivo = "trato válido" if not bajo else "no cuenta: " + " y ".join(
        f"{l} por debajo de su plan B ({PLAN_B[l]})" for l in bajo)
    return dict(sala=sala, trato="".join(letras), a=a, c=c, indice=indice(a, c),
                valido=not bajo, perdido=0, motivo=motivo)


def parsear(texto):
    filas, errores = {}, []
    for m in RE_CODIGO.finditer(texto):
        sala = int(m.group(1))
        if m.group(4):
            letras = list(m.group(4).upper())
            malas = [f"posición {i + 1} ({TEMAS[i]['nombre']}) no tiene opción {l}"
                     for i, l in enumerate(letras) if opcion(i, l) is None]
            if malas:
                errores.append(f"{m.group(0).strip()}: " + "; ".join(malas))
                continue
            filas[sala] = {"letras": letras}
            continue
        cierre = {"letras": None, "ultima": None, "quien": m.group(3).upper() if m.group(3) else None}
        if m.group(2):
            letras = list(m.group(2).upper())
            malas = [f"posición {i + 1} ({TEMAS[i]['nombre']}) no tiene opción {l}"
                     for i, l in enumerate(letras) if opcion(i, l) is None]
            if malas:
                errores.append(f"{m.group(0).strip()}: " + "; ".join(malas))
                continue
            cierre["ultima"] = letras
        filas[sala] = cierre
    return filas, errores


def ordenar(filas):
    lista = [evaluar(s, l) for s, l in filas.items()]
    lista.sort(key=lambda f: (not f["valido"], -f["indice"], f["perdido"], -min(f["a"], f["c"]), f["sala"]))
    return lista


def combos():
    acumulado = [[]]
    for t in TEMAS:
        acumulado = [c + [o["letra"]] for c in acumulado for o in t["opciones"]]
    return [(c, puntos(c, "agencia"), puntos(c, "cliente")) for c in acumulado]


def optimo():
    todos = combos()
    mejor = max(todos, key=lambda x: indice(x[1], x[2]))
    unicos = {(a, c): l for l, a, c in todos}
    frontera = sorted(((a, c, l) for (a, c), l in unicos.items()
                       if not any(qa >= a and qc >= c and (qa > a or qc > c) for (qa, qc) in unicos)))
    return mejor, frontera


def detalle(letras):
    return " · ".join(f"{t['nombre']}: {opcion(i, l)['texto']} ({opcion(i, l)['agencia']}/{opcion(i, l)['cliente']})"
                      for i, (t, l) in enumerate(zip(TEMAS, letras)))


def main(argv):
    if "--optimo" in argv:
        (letras, a, c), frontera = optimo()
        print(f"Mejor trato posible: {''.join(letras)}  agencia {a}  cliente {c}  índice {indice(a, c)}")
        print("  " + detalle(letras))
        print("Frontera de valor (agencia/cliente):", " ".join(f"{a}/{c}" for a, c, _ in frontera))
        return 0
    texto = " ".join(argv) if argv else sys.stdin.read()
    filas, errores = parsear(texto)
    for e in errores:
        print("Código inválido:", e)
    lista = ordenar(filas)
    if not lista:
        print("No se encontraron códigos. Formato: S<sala>-<5 letras>, o S<sala>-SIN[-<última propuesta>][-A|C|T].")
        return 1
    (_, oa, oc), _ = optimo()
    print(f"{'#':>2}  {'Sala':<6} {'Trato':<12} {'Agencia':>7} {'Cliente':>7} {'Total':>5} {'Índice':>6}  Estado")
    for k, f in enumerate(lista, 1):
        trato = f["trato"] + (f" ({f['ultima']['letras']})" if f.get("ultima") else "")
        print(f"{k:>2}  {'S' + str(f['sala']):<6} {trato:<12} {f['a']:>7} {f['c']:>7} {f['a'] + f['c']:>5} {f['indice']:>6g}  {f['motivo']}")
    mejor = next((f for f in lista if f["valido"] and f["trato"] != "SIN"), None)
    if mejor:
        print(f"\nMejor negociación: sala {mejor['sala']} ({mejor['trato']}), índice {mejor['indice']:g} de {indice(oa, oc):g} posibles.")
        print("  " + detalle(list(mejor["trato"])))
    else:
        print("\nNingún trato válido: la mejor jugada fue no cerrar.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
