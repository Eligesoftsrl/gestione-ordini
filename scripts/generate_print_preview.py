"""
Generates a PDF preview of the 62mm thermal printer output
using the EXACT HTML template from handlePrintOrder in
/app/frontend/app/(tabs)/index.tsx
"""
from datetime import datetime
from pathlib import Path
from weasyprint import HTML

# --- Demo order data (rappresenta un ordine realistico) ---
order = {
    "orderNumber": 142,
    "channel": "whatsapp",          # persona | telefono | whatsapp
    "serviceType": "da_consegnare", # da_consegnare | da_ritirare | in_sede
    "customerName": "Marco Bianchi",
    "deliveryTime": "20:30",
    "notes": "Citofonare al 2° piano. Senza glutine se possibile.",
    "items": [
        {"quantity": 2, "dishName": "Pizza Margherita DOP",     "subtotal": 18.00, "notes": "Una senza basilico"},
        {"quantity": 1, "dishName": "Pizza Diavola Piccante",   "subtotal": 11.00, "notes": ""},
        {"quantity": 3, "dishName": "Coca Cola 33cl",           "subtotal": 9.00,  "notes": ""},
        {"quantity": 1, "dishName": "Tiramisù della Casa",      "subtotal": 6.50,  "notes": "Senza caffè per bambino"},
        {"quantity": 1, "dishName": "Acqua Naturale 1L",        "subtotal": 2.50,  "notes": ""},
    ],
    "total": 47.00,
    "createdAt": "2026-02-15T19:42:00",
}

customer = {
    "address": "Via Giuseppe Verdi 14, 20121 Milano",
    "phone": "+39 333 1234567",
}

CHANNELS = {
    "persona":  "Di Persona",
    "telefono": "Telefono",
    "whatsapp": "WhatsApp",
}

service_label = {
    "da_consegnare": "DA CONSEGNARE",
    "da_ritirare":   "DA RITIRARE",
    "in_sede":       "IN SEDE",
}[order["serviceType"]]

# Format items HTML
items_html = ""
for item in order["items"]:
    note_html = f'<div class="item-note">&gt; {item["notes"]}</div>' if item["notes"] else ""
    items_html += f"""
    <div class="item">
      <div class="item-row">
        <span class="item-name">{item['quantity']}x {item['dishName']}</span>
        <span class="item-price">{item['subtotal']:.2f}€</span>
      </div>
      {note_html}
    </div>
    """

created_dt = datetime.fromisoformat(order["createdAt"]).strftime("%d/%m/%Y %H:%M")

html_content = f"""
<html>
  <head>
    <meta charset="UTF-8">
    <style>
      @page {{
        size: 60mm 300mm;
        margin: 1.5mm 2mm 1.5mm 2mm;
      }}
      * {{
        box-sizing: border-box;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }}
      html, body {{
        width: 56mm;
        margin: 0;
        padding: 0;
      }}
      body {{
        font-family: 'Courier New', monospace;
        font-size: 9pt;
        line-height: 1.2;
        color: #000;
        padding: 0;
      }}
      .center {{ text-align: center; }}
      .right  {{ text-align: right; }}
      .bold   {{ font-weight: 700; }}
      .hr     {{ border: 0; border-top: 1px dashed #000; margin: 1.5mm 0; }}
      .double {{ border: 0; border-top: 1.5px solid #000; margin: 1.5mm 0; }}
      h1 {{
        font-size: 9pt;
        text-align: center;
        margin: 0 0 0.3mm 0;
        letter-spacing: 0.3px;
      }}
      .subtitle {{
        text-align: center;
        font-size: 6.5pt;
        margin: 0 0 0.5mm 0;
        line-height: 1.1;
        color: #333;
      }}
      .info p {{
        margin: 0.3mm 0;
        font-size: 8pt;
        word-wrap: break-word;
        line-height: 1.15;
      }}
      .delivery-time {{
        text-align: center;
        font-size: 11pt;
        font-weight: 700;
        margin: 1.5mm 0;
        padding: 0.8mm 0;
        border: 1px solid #000;
      }}
      .notes-box {{
        margin: 1mm 0;
        padding: 0.8mm;
        border: 1px dashed #000;
        font-size: 7.5pt;
        word-wrap: break-word;
        line-height: 1.2;
      }}
      .item {{ margin: 0.6mm 0; }}
      .item-row {{
        display: flex;
        justify-content: space-between;
        gap: 1mm;
        font-size: 8.5pt;
      }}
      .item-name {{
        flex: 1;
        font-weight: 700;
        word-wrap: break-word;
        overflow-wrap: break-word;
      }}
      .item-price {{ white-space: nowrap; }}
      .item-note {{
        font-size: 7pt;
        font-style: italic;
        padding-left: 2.5mm;
        margin-top: 0.2mm;
        line-height: 1.15;
      }}
      .total {{
        font-size: 11pt;
        font-weight: 700;
        text-align: right;
        margin-top: 1.5mm;
      }}
      .footer {{
        text-align: center;
        font-size: 6.5pt;
        margin-top: 2mm;
        padding-top: 0.8mm;
        border-top: 1px dashed #000;
      }}
    </style>
  </head>
  <body>
    <h1>ORDINE #{order['orderNumber']}</h1>
    <p class="subtitle">
      {CHANNELS.get(order['channel'], 'Persona')} · {service_label}
    </p>
    <hr class="hr" />

    <div class="info">
      <p class="bold">{order['customerName'] or 'Cliente Anonimo'}</p>
      <p>{customer['address']}</p>
      <p>Tel: {customer['phone']}</p>
    </div>

    <div class="delivery-time">ORA: {order['deliveryTime']}</div>

    <div class="notes-box"><span class="bold">NOTE:</span> {order['notes']}</div>

    <hr class="hr" />
    {items_html}
    <hr class="double" />
    <div class="total">TOT: {order['total']:.2f}€</div>
  </body>
</html>
"""

out_dir = Path("/app/scripts/preview_output")
out_dir.mkdir(parents=True, exist_ok=True)

html_path = out_dir / "thermal_62mm_preview.html"
pdf_path  = out_dir / "thermal_62mm_preview.pdf"

def _build_html(page_height_mm: float) -> str:
    return html_content.replace("size: 60mm 300mm;", f"size: 60mm {page_height_mm}mm;")


html_path.write_text(html_content, encoding="utf-8")

# 1° render con pagina alta 300mm per misurare il contenuto effettivo
HTML(string=html_content).write_pdf(str(pdf_path))

import fitz
doc = fitz.open(str(pdf_path))
page = doc[0]
blocks = page.get_text("dict")["blocks"]
max_y_pts = 0
for b in blocks:
    if "bbox" in b:
        max_y_pts = max(max_y_pts, b["bbox"][3])
doc.close()

# pymupdf y-bbox è dall'alto-pagina, quindi max_y_pts = distanza dall'alto al fondo del contenuto
content_height_mm = max_y_pts * 0.3528 + 1.5  # +1.5mm padding finale
print(f"Altezza contenuto misurata: {content_height_mm:.2f}mm")

# 2° render con altezza esatta della pagina
final_html = html_content.replace("size: 60mm 300mm;", f"size: 60mm {content_height_mm:.2f}mm;")
HTML(string=final_html).write_pdf(str(pdf_path))

# Verifica
doc = fitz.open(str(pdf_path))
print(f"HTML: {html_path}")
print(f"PDF : {pdf_path}")
print(f"PDF size finale: {doc[0].rect.width*0.3528:.2f}mm x {doc[0].rect.height*0.3528:.2f}mm")
doc.close()
