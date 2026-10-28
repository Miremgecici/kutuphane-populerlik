# Güvenlik politikası

## Güvenlik açığı bildirimi

Bu projede bir güvenlik açığı bulursanız lütfen herkese açık bir issue açmayın.
GitHub'ın özel bildirim formunu kullanın:
https://github.com/Miremgecici/kutuphane-populerlik/security/advisories/new

Bildirimlere en geç 7 gün içinde yanıt verilir. Aynı adres `/.well-known/security.txt`
dosyasında da yayınlanır.

## Kapsam

- Canlı ürün: https://kutuphane-populerlik.pages.dev
- Bu depo ve GitHub Actions iş akışları

Kapsam dışı: veri sağlayıcıların (npm, pypistats.org) ve Cloudflare'in kendi sistemleri.

## Ürünün güvenlik özellikleri

- Ürün anahtar gerektiren hiçbir kaynak kullanmaz; depoda, istemci kodunda ve log'larda gizli bilgi yoktur.
- Her push'ta ve haftalık olarak gitleaks ile gizli anahtar taraması yapılır.
- Dependabot, GitHub Actions bağımlılıklarını haftalık kontrol eder; tüm Actions sürümleri commit SHA'sı ile sabitlenmiştir.
- İş akışları en az yetkiyle çalışır (varsayılan `permissions: {}`).
- Site, CSP (`script-src 'self'`), HSTS ve diğer güvenlik başlıklarıyla yayınlanır.

Olay müdahale adımları için: [docs/runbook-anahtar-sizintisi.md](docs/runbook-anahtar-sizintisi.md)
