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
        margin: 1mm;
      }}
      * {{
        box-sizing: border-box;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }}
      html, body {{
        width: 60mm;
        margin: 0;
        padding: 0;
      }}
      body {{
        font-family: 'Courier New', monospace;
        font-size: 11pt;
        line-height: 1.25;
        color: #000;
        padding: 1mm;
      }}
      .center {{ text-align: center; }}
      .right  {{ text-align: right; }}
      .bold   {{ font-weight: 700; }}
      .hr     {{ border: 0; border-top: 1px dashed #000; margin: 2mm 0; }}
      .double {{ border: 0; border-top: 2px solid #000; margin: 2mm 0; }}
      h1 {{
        font-size: 14pt;
        text-align: center;
        margin: 0 0 1mm 0;
        letter-spacing: 1px;
      }}
      .subtitle {{
        text-align: center;
        font-size: 9pt;
        margin: 0 0 1mm 0;
      }}
      .info p {{
        margin: 0.5mm 0;
        font-size: 9.5pt;
        word-wrap: break-word;
      }}
      .delivery-time {{
        text-align: center;
        font-size: 13pt;
        font-weight: 700;
        margin: 2mm 0;
        padding: 1mm 0;
        border: 1.5px solid #000;
      }}
      .notes-box {{
        margin: 1.5mm 0;
        padding: 1mm;
        border: 1px dashed #000;
        font-size: 9pt;
        word-wrap: break-word;
      }}
      .item {{ margin: 1mm 0; }}
      .item-row {{
        display: flex;
        justify-content: space-between;
        gap: 1mm;
        font-size: 10pt;
      }}
      .item-name {{
        flex: 1;
        font-weight: 700;
        word-wrap: break-word;
        overflow-wrap: break-word;
      }}
      .item-price {{ white-space: nowrap; }}
      .item-note {{
        font-size: 8.5pt;
        font-style: italic;
        padding-left: 3mm;
        margin-top: 0.3mm;
      }}
      .total {{
        font-size: 14pt;
        font-weight: 700;
        text-align: right;
        margin-top: 2mm;
      }}
      .footer {{
        text-align: center;
        font-size: 8pt;
        margin-top: 3mm;
        padding-top: 1mm;
        border-top: 1px dashed #000;
      }}
    </style>
  </head>
  <body>
    <h1>ORDINE #{order['orderNumber']}</h1>
    <p class="subtitle bold">
      {CHANNELS.get(order['channel'], 'Persona')}<br/>
      {service_label}
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

    <div class="footer">{created_dt}</div>
  </body>
</html>
"""

out_dir = Path("/app/scripts/preview_output")
out_dir.mkdir(parents=True, exist_ok=True)

html_path = out_dir / "thermal_62mm_preview.html"
pdf_path  = out_dir / "thermal_62mm_preview.pdf"

html_path.write_text(html_content, encoding="utf-8")
HTML(string=html_content).write_pdf(str(pdf_path))

print(f"HTML: {html_path}")
print(f"PDF : {pdf_path}")
