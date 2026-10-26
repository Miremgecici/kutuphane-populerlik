# Kütüphane Popülerlik Karşılaştırıcı

> BVA 2245 Kullanıcı Arayüzü Tasarımı · Haftalık Sprint: Canlı Veri Ürünü
> Müesser İrem Gecici · 2516016027

Bir yazılım/veri bilimi eğitim programının müfredat ekibi için, hangi kütüphanelerin öğretileceğine karar vermeye yardım eden canlı veri ürünü. npm ve PyPI paketlerinin günlük indirme sayılarını karşılaştırır.

*Müşteri kurgusaldır; ürün gerçek bir kurumla yapılmış bir çalışma değildir.*

## Durum (ara kontrol – 26 Ekim 2026)

- [x] Herkese açık depo
- [x] Otomatik veri çekimi: GitHub Actions, günde 1 kez (`.github/workflows/fetch-data.yml`)
- [x] Arayüz taslağı: [`docs/taslak.png`](docs/taslak.png)
- [ ] Arayüz, ileri özellik, durumlar (27–28 Ekim)
- [ ] Kullanıcı testi, portfolyo vaka sayfası, demo videosu (30 Ekim)

## Canlı link

*(Final teslimde eklenecek – GitHub Pages)*

## Mimari

```
npm downloads API ─┐
                   ├─► GitHub Actions (cron, günde 1) ─► scripts/fetch_data.py ─► data/*.json (depoya commit)
pypistats.org API ─┘                                                                   │
                                                                                       ▼
                                                     Tarayıcı (GitHub Pages) ─► grafikler, KPI, tablo
```

- Veri her çalıştırmada mevcut JSON ile tarihe göre birleştirilir; böylece kaynakların verdiği aralığın ötesinde kendi zaman serimiz birikir.
- İki kaynak da API anahtarı gerektirmez; istemci kodunda anahtar yoktur.
- Rate limit'e uymak için istekler arasında 2 sn beklenir, iş akışı günde yalnızca 1 kez çalışır.
- API çalışmazsa ürün depodaki son başarılı JSON ile açılır.

## Veri kaynakları ve lisans

| Kaynak | Bağlantı | Not |
| --- | --- | --- |
| npm downloads API | https://github.com/npm/registry/blob/main/docs/download-counts.md | Anahtarsız, son 18 aya kadar günlük veri |
| pypistats.org API | https://pypistats.org/api/ | Anahtarsız, son ~180 gün; PyPI BigQuery verisinden türetilmiştir |

Gösterilen veriler toplulaştırılmış indirme sayılarıdır; kişisel veri içermez.

## Kurulum

```bash
git clone https://github.com/Miremgecici/kutuphane-populerlik.git
cd kutuphane-populerlik
python scripts/fetch_data.py   # data/npm.json ve data/pypi.json oluşur
```

Python 3.10+ yeterlidir, ek paket gerekmez.

## CV cümlesi

*(Final teslimde eklenecek)*

## Yapay zekâ kullanım beyanı

| Araç | Ne için | Nasıl değiştirdim |
| --- | --- | --- |
| Claude (Anthropic) | Ödev yönergesini özetleme, veri çekme script'i ve GitHub Actions iş akışının ilk taslağı, README iskeleti, arayüz taslağı | *(doldurulacak)* |
