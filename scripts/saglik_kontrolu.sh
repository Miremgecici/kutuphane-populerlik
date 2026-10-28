#!/usr/bin/env bash
# Canlı ürünün sağlık kontrolü: erişilebilirlik, güvenlik başlıkları, veri tazeliği.
# Kullanım: bash scripts/saglik_kontrolu.sh [site_adresi]
# Her kontrol bir satır log yazar; bir kontrol bile başarısızsa çıkış kodu 1 olur.
set -uo pipefail

SITE="${1:-https://kutuphane-populerlik.pages.dev}"
MAX_YAS_SAAT="${MAX_YAS_SAAT:-48}"
HATA=0
TMP="$(mktemp -d)"

ok()   { echo "[TAMAM] $1"; }
fail() { echo "[HATA]  $1"; HATA=1; }

# 1) Ana sayfa 200 dönüyor mu, ne kadar sürüyor?
: > "$TMP/headers.txt"
SONUC="$(curl -sS -o "$TMP/index.html" -D "$TMP/headers.txt" -w '%{http_code} %{time_total}' --max-time 20 "$SITE/" 2>/dev/null)" || SONUC="000 0"
read -r KOD SURE <<< "$SONUC"
[ "$KOD" = "200" ] || : > "$TMP/headers.txt"   # başarısız yanıtın başlıkları sayılmasın
if [ "$KOD" = "200" ]; then ok "Ana sayfa HTTP $KOD (${SURE} sn)"; else fail "Ana sayfa HTTP $KOD"; fi

# 2) Zorunlu güvenlik başlıkları yerinde mi?
for H in content-security-policy strict-transport-security x-content-type-options referrer-policy permissions-policy; do
  if grep -qi "^$H:" "$TMP/headers.txt"; then ok "Başlık var: $H"; else fail "Başlık eksik: $H"; fi
done
if grep -i '^content-security-policy:' "$TMP/headers.txt" | grep -qiE "unsafe-inline|unsafe-eval"; then
  fail "CSP içinde unsafe-inline / unsafe-eval var"
else
  ok "CSP içinde unsafe-inline / unsafe-eval yok"
fi

# 3) HTTP isteği HTTPS'e yönleniyor mu?
HTTP_KOD="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "${SITE/https:/http:}/" 2>/dev/null)" || HTTP_KOD="000"
case "$HTTP_KOD" in 301|302|307|308) ok "HTTP -> HTTPS yönlendirmesi ($HTTP_KOD)";; *) fail "HTTP yönlendirmesi yok ($HTTP_KOD)";; esac

# 4) security.txt yayında mı?
if curl -sS --max-time 15 "$SITE/.well-known/security.txt" 2>/dev/null | grep -q '^Contact:'; then ok "security.txt yayında"; else fail "security.txt yok"; fi

# 5) Veri taze mi? (last_updated en fazla MAX_YAS_SAAT saat önce)
for KAYNAK in npm pypi; do
  if curl -sSf --max-time 20 "$SITE/data/$KAYNAK.json" -o "$TMP/$KAYNAK.json" 2>/dev/null; then
    python3 - "$TMP/$KAYNAK.json" "$KAYNAK" "$MAX_YAS_SAAT" <<'PY' || HATA=1
import json, sys
from datetime import datetime, timezone
yol, ad, limit = sys.argv[1], sys.argv[2], float(sys.argv[3])
d = json.load(open(yol, encoding="utf-8"))
t = datetime.fromisoformat(d["last_updated"])
yas = (datetime.now(timezone.utc) - t).total_seconds() / 3600
hatalar = len(d.get("errors") or [])
if yas <= limit:
    print(f"[TAMAM] {ad} verisi {yas:.1f} saat önce güncellendi, paket hatası: {hatalar}")
else:
    print(f"[HATA]  {ad} verisi {yas:.1f} saattir güncellenmedi (sınır {limit:.0f} saat)")
    sys.exit(1)
PY
  else
    fail "$KAYNAK.json indirilemedi"
  fi
done

rm -rf "$TMP"
if [ "$HATA" -eq 0 ]; then echo "SONUÇ: tüm kontroller başarılı"; else echo "SONUÇ: en az bir kontrol başarısız"; fi
exit "$HATA"
