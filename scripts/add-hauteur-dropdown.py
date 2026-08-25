"""Ajoute l'onglet donnée + listes déroulantes colonne U (hauteur_tiroir)."""
import os
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC_XLS = ROOT / "src/1_STRUCTURE/03_bibliotheque/modele_boutique.xls"
TMP = Path(tempfile.gettempdir()) / "philae-boutique-xlsx"
PATCHED = TMP / "modele_boutique_dv.xlsx"

DV = (
    '<dataValidations count="1">'
    '<dataValidation type="list" allowBlank="1" showInputMessage="1" '
    'showErrorMessage="1" errorStyle="stop" errorTitle="Hauteur tiroir" '
    'error="Choisir une hauteur de l\'onglet donnee" '
    'promptTitle="Hauteur tiroir" '
    'prompt="Hauteurs predefinies (onglet donnee)" sqref="U2:U500">'
    "<formula1>'donnée'!$A$2:$A$10</formula1>"
    "</dataValidation></dataValidations>"
)


def inject_validation(src_xlsx: Path, dest_xlsx: Path) -> None:
    tmpdir = Path(tempfile.mkdtemp())
    with zipfile.ZipFile(src_xlsx, "r") as zin:
        zin.extractall(tmpdir)
    sheet = tmpdir / "xl" / "worksheets" / "sheet1.xml"
    xml = sheet.read_text(encoding="utf-8")
    if "<dataValidations" not in xml:
        if "</worksheet>" not in xml:
            raise SystemExit("sheet1.xml: balise </worksheet> introuvable")
        xml = xml.replace("</worksheet>", DV + "</worksheet>")
        sheet.write_text(xml, encoding="utf-8")
    if dest_xlsx.exists():
        dest_xlsx.unlink()
    with zipfile.ZipFile(dest_xlsx, "w", compression=zipfile.ZIP_DEFLATED) as zout:
        for dirpath, _, files in os.walk(tmpdir):
            for name in files:
                fp = Path(dirpath) / name
                zout.write(fp, fp.relative_to(tmpdir).as_posix())
    shutil.rmtree(tmpdir, ignore_errors=True)


def convert_to_xls(xlsx: Path, out_dir: Path) -> None:
    soffice = Path(r"C:\Program Files (x86)\OpenOffice 4\program\soffice.exe")
    if not soffice.exists():
        print("OpenOffice introuvable — xlsx conservé seulement")
        return
    profile = Path(tempfile.gettempdir()) / "philae-oo-profile"
    profile.mkdir(parents=True, exist_ok=True)
    uri = "file:///" + profile.as_posix().lstrip("/")
    cmd = [
        str(soffice),
        "-headless",
        f"-env:UserInstallation={uri}",
        "-convert-to",
        "xls",
        "-outdir",
        str(out_dir),
        str(xlsx),
    ]
    print("convert", " ".join(cmd))
    r = subprocess.run(cmd, capture_output=True, text=True)
    print("code", r.returncode)
    if r.stdout:
        print(r.stdout)
    if r.stderr:
        print(r.stderr)


def main() -> None:
    src = TMP / "modele_boutique.xlsx"
    if not src.exists():
        raise SystemExit(f"xlsx source manquant: {src}")
    inject_validation(src, PATCHED)
    dest_xlsx = SRC_XLS.with_suffix(".xlsx")
    shutil.copy2(PATCHED, dest_xlsx)
    print("xlsx", dest_xlsx, dest_xlsx.stat().st_size)
    convert_to_xls(dest_xlsx, SRC_XLS.parent)
    xls = SRC_XLS
    print("xls", xls.exists(), xls.stat().st_size if xls.exists() else 0)


if __name__ == "__main__":
    main()
