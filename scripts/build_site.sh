#!/usr/bin/env bash
# Yalnızca sitenin kendi dosyalarını _site/ klasörüne kopyalar (izin listesi).
# scripts/, docs/, .github/ gibi klasörler yayınlanmaz.
set -euo pipefail
rm -rf _site
mkdir -p _site
cp index.html _headers _site/
cp -r assets data .well-known _site/
find _site -type f | sort
