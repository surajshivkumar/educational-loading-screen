import json
import base64
import urllib.request
import urllib.parse
import ssl
import re
from pathlib import Path

URL = (
    "https://services6.arcgis.com/fvVAYtGZqN8KYrb6/arcgis/rest/services/"
    "indicators_merged_with_citywide_and_borough_averages_updated0627/FeatureServer/0/query"
)

SECRET_KEY = b"dashboard-metrics-protect-2026"
MARKER = "/*__PROTECTED_DATA__*/"

def fetch_data():
    params = {
        "where": "ntatype = 0",
        "outFields": "*",
        "returnGeometry": "true",
        "outSR": "4326",
        "f": "json"
    }
    full_url = f"{URL}?{urllib.parse.urlencode(params)}"
    print("Fetching from ArcGIS...")
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    with urllib.request.urlopen(urllib.request.Request(full_url), context=ctx) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    if "error" in data:
        raise RuntimeError(f"ArcGIS Error: {data['error']}")
    print(f"Fetched {len(data.get('features', []))} features.")
    return data

def encode(data_dict):
    raw = json.dumps(data_dict, separators=(",", ":")).encode("utf-8")
    encoded = bytearray(len(raw))
    kl = len(SECRET_KEY)
    for i in range(len(raw)):
        encoded[i] = raw[i] ^ SECRET_KEY[i % kl]
    return base64.b64encode(encoded).decode("ascii")

def main():
    root = Path(__file__).resolve().parent.parent
    html_path = root / "index.html"

    data = fetch_data()
2    print("Encoding...")
    b64 = encode(data)

    payload_path = root / "payload.js"
    payload_content = f'const PROTECTED_PAYLOAD = "{b64}";\n'
    payload_path.write_text(payload_content, encoding="utf-8")
    print(f"Successfully updated! Wrote {len(b64) // 1024} KB of new data to payload.js")

if __name__ == "__main__":
    main()
