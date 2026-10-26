"""
npm downloads API ve pypistats.org API'den günlük indirme sayılarını çeker.
Yeni günleri data/ klasöründeki mevcut JSON'un üstüne ekler (zaman serisi birikir).
Anahtar gerekmez. Kaynak sınırlarına uymak için istekler arasında kısa bekleme vardır.
"""
import json
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

# Karşılaştırılacak paketler (istediğin gibi değiştirebilirsin)
NPM_PACKAGES = ["react", "vue", "svelte", "express", "d3"]
PYPI_PACKAGES = ["pandas", "polars", "numpy", "scikit-learn", "matplotlib", "plotly"]

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
HEADERS = {"User-Agent": "kutuphane-populerlik-karsilastirici (egitim projesi)"}


def get_json(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def load_existing(path):
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {"packages": {}}


def merge(old_series, new_series):
    """Tarihe göre birleştirir; aynı gün varsa yeni değeri kullanır."""
    merged = {row["date"]: row["downloads"] for row in old_series}
    for row in new_series:
        merged[row["date"]] = row["downloads"]
    return [{"date": d, "downloads": merged[d]} for d in sorted(merged)]


def fetch_npm(pkg):
    url = f"https://api.npmjs.org/downloads/range/last-year/{pkg}"
    data = get_json(url)
    return [{"date": r["day"], "downloads": r["downloads"]} for r in data["downloads"]]


def fetch_pypi(pkg):
    url = f"https://pypistats.org/api/packages/{pkg}/overall?mirrors=false"
    data = get_json(url)
    return [
        {"date": r["date"], "downloads": r["downloads"]}
        for r in data["data"]
        if r.get("category") == "without_mirrors"
    ]


def update(source_name, packages, fetcher, source_url):
    path = DATA_DIR / f"{source_name}.json"
    store = load_existing(path)
    errors = []
    for pkg in packages:
        try:
            series = fetcher(pkg)
            old = store["packages"].get(pkg, [])
            store["packages"][pkg] = merge(old, series)
            print(f"[{source_name}] {pkg}: {len(series)} gün alındı")
        except Exception as e:  # bir paket hata verirse diğerleri devam eder
            errors.append(f"{pkg}: {e}")
            print(f"[{source_name}] {pkg}: HATA {e}")
        time.sleep(2)  # rate limit'e saygı

    store["source"] = source_url
    store["last_updated"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    store["errors"] = errors
    path.write_text(json.dumps(store, ensure_ascii=False, indent=1), encoding="utf-8")


def main():
    DATA_DIR.mkdir(exist_ok=True)
    update("npm", NPM_PACKAGES, fetch_npm, "https://github.com/npm/registry/blob/main/docs/download-counts.md")
    update("pypi", PYPI_PACKAGES, fetch_pypi, "https://pypistats.org/api/")


if __name__ == "__main__":
    main()
