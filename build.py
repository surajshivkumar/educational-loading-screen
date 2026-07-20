import urllib.request
import urllib.parse
import ssl
from pathlib import Path

URL_NTA = (
    "https://services6.arcgis.com/fvVAYtGZqN8KYrb6/arcgis/rest/services/"
    "indicators_merged_with_citywide_and_borough_averages_updated0627/FeatureServer/0/query"
)

URL_BOROUGHS = (
    "https://services6.arcgis.com/fvVAYtGZqN8KYrb6/arcgis/rest/services/"
    "Borough_Boundaries_20260327/FeatureServer/0/query"
)

def fetch_geojson(url, out_path):
    params = {
        "where": "1=1",
        "outFields": "*",
        "returnGeometry": "true",
        "outSR": "4326",
        "f": "geojson"
    }
    
    full_url = f"{url}?{urllib.parse.urlencode(params)}"
    print(f"Fetching GeoJSON from {url}...")
    
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    
    try:
        with urllib.request.urlopen(urllib.request.Request(full_url), context=ctx) as resp:
            data = resp.read()
            
        out_path.write_bytes(data)
        print(f"Successfully downloaded {len(data) // 1024} KB to {out_path.name}!")
    except Exception as e:
        print(f"Failed to fetch from {url}: {e}")

def main():
    root = Path(__file__).resolve().parent.parent
    fetch_geojson(URL_NTA, root / "data.geojson")
    fetch_geojson(URL_BOROUGHS, root / "boroughs.geojson")

if __name__ == "__main__":
    main()
