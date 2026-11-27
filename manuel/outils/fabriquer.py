# Fabrique trois modèles de test contenant des balises {{…}} : Word (via textutil), Excel et PowerPoint minimaux
import subprocess, zipfile, os, re
D = os.path.dirname(os.path.abspath(__file__)) + '/'
html = """<html><body><h1>Note de cadrage {{projet}}</h1>
<p>Code : {{code}} · Chef de projet : <b>{{chef_de_projet}}</b> · Sponsor : {{sponsor}}</p>
<p>Du {{date_debut}} au {{date_fin}} (document du {{date_du_jour}})</p>
<p>Objectifs :</p><p>{{objectifs}}</p>
<p>Prochain jalon : {{prochain_jalon}} · Mise en production : {{mise_en_production}}</p>
<p>Balise inconnue : {{inconnue}}</p></body></html>"""
open(D + 'cadrage.html', 'w', encoding='utf-8').write(html)
subprocess.run(['textutil', '-convert', 'docx', D + 'cadrage.html', '-output', D + 'Modele cadrage.docx'], check=True)
# découpe volontairement une balise en deux morceaux, comme le fait parfois Word
z = zipfile.ZipFile(D + 'Modele cadrage.docx'); parts = {n: z.read(n) for n in z.namelist()}; z.close()
doc = parts['word/document.xml'].decode('utf-8')
doc, n = re.subn(r'\{\{sponsor\}\}', '{{spon</w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>sor}}', doc, count=1)
assert n == 1, 'balise sponsor introuvable'
parts['word/document.xml'] = doc.encode('utf-8')
with zipfile.ZipFile(D + 'Modele cadrage.docx', 'w', zipfile.ZIP_DEFLATED) as z:
    for k, v in parts.items(): z.writestr(k, v)
# Excel minimal
X = {
 '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>',
 '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
 'xl/workbook.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Budget" sheetId="1" r:id="rId1"/></sheets></workbook>',
 'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>',
 'xl/worksheets/sheet1.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" t="s"><v>3</v></c></row></sheetData></worksheet>',
 'xl/sharedStrings.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="4" uniqueCount="4"><si><t>Projet</t></si><si><t>{{projet}} ({{code}})</t></si><si><t>Budget</t></si><si><t>{{budget}}</t></si></sst>',
}
with zipfile.ZipFile(D + 'Budget previsionnel.xlsx', 'w', zipfile.ZIP_DEFLATED) as z:
    for k, v in X.items(): z.writestr(k, v)
# PowerPoint minimal (une diapo avec du texte)
P = {
 '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>',
 'ppt/slides/slide1.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Copil {{projet}} – étape : {{etape}}</a:t></a:r></a:p><a:p><a:r><a:t>Périmètre : {{perimetre_inclus}}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>',
}
with zipfile.ZipFile(D + 'Trame copil.pptx', 'w', zipfile.ZIP_DEFLATED) as z:
    for k, v in P.items(): z.writestr(k, v)
open(D + 'Mail lancement.txt', 'w', encoding='utf-8').write("Bonjour,\nLe projet {{projet}} démarre le {{date_debut}}.\nObjectifs :\n{{objectifs}}\n")
print(sorted(os.listdir(D)))
