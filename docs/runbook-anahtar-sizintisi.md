# Olay müdahale runbook'u: "API anahtarım sızdı"

Ürün: Kütüphane Popülerlik Karşılaştırıcı · Sorumlu: Müesser İrem Gecici · Son gözden geçirme: 28.10.2026

Bu projede şu an anahtar gerektiren bir kaynak yok. Ancak hesaplara bağlı token'lar var (GitHub kişisel erişim token'ı, Cloudflare API token'ı). Bu runbook, bunlardan biri ya da ileride eklenecek bir API anahtarı sızarsa uygulanır. **Hedef: tespitten sonraki 15 dakika içinde iptal.**

## 1. Tespit (0–5 dk)

Sızıntı şu yollardan biriyle fark edilir:

- **gitleaks** iş akışı kırmızı olur ve e-posta gelir (her push, her PR ve her pazartesi çalışır).
- GitHub **secret scanning** uyarısı ya da push protection engeli (Security sekmesi → Secret scanning).
- Sağlayıcıdan gelen otomatik e-posta (GitHub ve Cloudflare, herkese açık depoda bulunan token'ları bildirir).
- Beklenmeyen etkinlik: tanımadığın bir commit, yayın, ayar değişikliği; izleme iş akışının ALARM issue'su.

Not al: hangi anahtar, nerede görüldü (dosya, commit, log), ilk görülme zamanı.

## 2. İptal (5–15 dk) — önce iptal, sonra temizlik

Commit'i silmek yetmez: anahtar sızdığı anda kopyalanmış sayılır. **İlk iş iptal.**

| Anahtar türü | Nereden iptal edilir |
| --- | --- |
| GitHub kişisel erişim token'ı | GitHub → Settings → Developer settings → Personal access tokens → ilgili token → **Delete** |
| Cloudflare API token'ı | Cloudflare → My Profile → API Tokens → ilgili token → **Roll** veya **Delete** |
| GitHub Secrets'taki bir değer | Önce sağlayıcıda iptal et, sonra depo → Settings → Secrets and variables → Actions → güncelle |
| Veri sağlayıcı API anahtarı (ileride) | Sağlayıcının panelinde anahtarı iptal et / yenile |

Hesabın kendisinden şüpheleniyorsan: şifreyi değiştir, tüm oturumları kapat (GitHub → Settings → Sessions; Cloudflare → My Profile → Sessions).

## 3. Yenileme (15–30 dk)

1. Yeni anahtarı **en az yetkiyle** ve **son kullanma tarihiyle** oluştur (yalnızca gereken izin ve kaynak).
2. Yalnızca **GitHub Secrets**'a kaydet; koda, `.env` dosyasına ya da sohbete yapıştırma.
3. İlgili iş akışını elle çalıştırıp (Actions → Run workflow) yeni anahtarla çalıştığını doğrula.

## 4. İnceleme (aynı gün)

- **Kapsam:** Anahtar ne zamandan beri açıktaydı? `git log -S "<anahtarın ilk 6 karakteri>" --all` ile ilk commit'i bul.
- **Kötüye kullanım var mı?** GitHub → Settings → Security log; Cloudflare → Manage account → Audit logs; Actions çalışma geçmişi; Cloudflare Pages yayın listesi.
- **Temizlik:** Anahtarı içeren dosyayı düzelt. Geçmişten silmek gerekirse `git filter-repo` kullan; anahtar zaten iptal edildiği için bu ikincil adımdır.
- **Kök neden:** Anahtar nasıl sızdı (koda yazıldı, log'a basıldı, ekran görüntüsünde göründü)? Aynı hatayı önleyecek kontrolü ekle.

## 5. Bildirim (aynı gün)

- Sağlayıcıya (gerekirse destek kaydı) ve proje ekibine / öğretim elemanına kısa bilgi: ne oldu, ne zaman, ne yapıldı.
- Kişisel veri etkilendiyse (bu üründe yok) KVKK kapsamında değerlendirme gerekir.
- Olay kaydını aşağıdaki şablonla `docs/olaylar/` altına yaz.

```text
Tarih/saat:      ...
Anahtar:         ...  (yalnızca türü ve son 4 karakteri)
Nasıl fark edildi: ...
İptal zamanı:    ...
Kötüye kullanım: var / yok (kanıt: ...)
Kök neden:       ...
Alınan önlem:    ...
```

## Önleyici kontroller (zaten açık)

- gitleaks iş akışı: `.github/workflows/guvenlik-taramasi.yml`
- GitHub secret scanning ve push protection
- `.gitignore` içinde `.env`, `*.pem`, `*.key`
- İş akışlarında en az yetki ve log'a gizli değer basmama
