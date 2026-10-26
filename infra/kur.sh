#!/usr/bin/env bash
# Azure Cloud Shell (Bash) içinde deponun kökünden:  bash infra/kur.sh
set -euo pipefail

RG="${RG:-rg-kutuphane-populerlik}"
LOC="${LOC:-westeurope}"

az group create -n "$RG" -l "$LOC" --tags proje=kutuphane-populerlik -o none
az deployment group create -g "$RG" -n swa -f infra/main.bicep -p location="$LOC" -o none

SITE="$(az deployment group show -g "$RG" -n swa --query properties.outputs.siteUrl.value -o tsv)"
NAME="$(az deployment group show -g "$RG" -n swa --query properties.outputs.staticWebAppName.value -o tsv)"

echo "Site adresi: $SITE"
echo
echo "Dağıtım token'ı -> GitHub > Settings > Secrets and variables > Actions"
echo "Ad: AZURE_STATIC_WEB_APPS_API_TOKEN   (ekran görüntüsü ALMAYIN)"
az staticwebapp secrets list -n "$NAME" -g "$RG" --query properties.apiKey -o tsv
