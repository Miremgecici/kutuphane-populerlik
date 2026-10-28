#!/usr/bin/env bash
# Otomatik iş akışlarının main dalına güvenli yazması için ortak yardımcı.
# Değişikliği ayrı bir dala commit eder, PR açar ve birleştirir (branch protection ile uyumlu).
# PR açılamazsa doğrudan main'e push dener; main korumalıysa bu push reddedilir ve iş akışı
# başarısız olur (e-posta bildirimi = alarm).
#
# Kullanım: bash scripts/pr_ile_birlestir.sh <dal-oneki> "<commit mesajı>" <yol> [<yol>...]
set -euo pipefail

ONEK="$1"; MESAJ="$2"; shift 2

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

git add -- "$@"
if git diff --cached --quiet; then
  echo "Değişiklik yok, commit atılmadı."
  exit 0
fi

DAL="$ONEK/$(date -u +'%Y%m%d-%H%M%S')"
git switch -c "$DAL"
git commit -m "$MESAJ"
git push origin "$DAL"

if gh pr create --base main --head "$DAL" --title "$MESAJ" \
     --body "GitHub Actions tarafından otomatik açıldı (${GITHUB_WORKFLOW:-iş akışı})." \
   && gh pr merge "$DAL" --squash --delete-branch; then
  echo "PR ile main'e birleştirildi."
  exit 0
fi

echo "::warning::PR açılamadı veya birleştirilemedi; doğrudan main'e push deneniyor."
git push origin --delete "$DAL" || true
git push origin "HEAD:main"
