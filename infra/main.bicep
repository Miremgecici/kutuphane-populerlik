// Kütüphane Popülerlik Karşılaştırıcı — Azure altyapısı (kod olarak altyapı)
// Ürün statik bir veri ürünüdür: sunucu kodu ve API anahtarı yoktur.
// Tek kaynak: Azure Static Web Apps (Free katman, 0 TL).

@description('Static Web Apps bölgesi: westeurope, westus2, centralus, eastus2 veya eastasia')
param location string = 'westeurope'

@description('Static Web App adı')
param name string = 'swa-kutuphane-populerlik'

resource swa 'Microsoft.Web/staticSites@2023-12-01' = {
  name: name
  location: location
  tags: {
    proje: 'kutuphane-populerlik'
    ders: 'bulut-bilisim-siber-guvenlik'
    maliyetHedefi: '0TL'
  }
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    // Dağıtım GitHub Actions + dağıtım token'ı ile yapılır (.github/workflows/azure-dagitim.yml)
    allowConfigFileUpdates: true
    stagingEnvironmentPolicy: 'Disabled' // PR önizleme ortamı açılmaz
  }
}

output siteUrl string = 'https://${swa.properties.defaultHostname}'
output staticWebAppName string = swa.name
