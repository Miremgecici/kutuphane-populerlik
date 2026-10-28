# Hesap güvenliği denetim listesi ve erişim incelemesi

Kart: **Geliştirici ve bulut hesabının ele geçirilmesi** · Kontrol: MFA (passkey), kök hesabın kilitlenmesi, ayrı en az yetkili kimlik, kurtarma kodları, erişim incelemesi.
Denetim tarihi: 28.10.2026 · Denetleyen: Müesser İrem Gecici

Ekran görüntüleri `docs/kanit/` klasöründedir. Gizli bilgiler (kurtarma kodları, token'lar, e-postanın bir kısmı) karartılmıştır ve her görüntüde tarih/saat görünür.

## 1. GitHub hesabı (Miremgecici)

| # | Kontrol | Nasıl doğrulanır | Durum | Kanıt |
| --- | --- | --- | --- | --- |
| G1 | Passkey tanımlı | Settings → Password and authentication → Passkeys | [ ] | `kanit/github-passkey.png` |
| G2 | İki adımlı doğrulama (TOTP uygulaması) açık | Aynı sayfa → Two-factor authentication: Enabled | [ ] | `kanit/github-2fa.png` |
| G3 | Kurtarma kodları indirildi ve çevrimdışı saklanıyor | Aynı sayfa → Recovery codes → Viewed | [ ] | `kanit/github-kurtarma.png` (kodlar karartılmış) |
| G4 | Şifre benzersiz ve parola yöneticisinde | Beyan | [ ] | — |
| G5 | Tanınmayan oturum yok | Settings → Sessions | [ ] | `kanit/github-oturumlar.png` |
| G6 | Yetkili uygulamalar incelendi | Settings → Applications → Authorized / Installed GitHub Apps | [ ] | `kanit/github-uygulamalar.png` |
| G7 | Kişisel erişim token'ı yok ya da hepsi süreli ve gerekli | Settings → Developer settings → Personal access tokens | [ ] | `kanit/github-tokenlar.png` |
| G8 | main dalı korumalı (PR zorunlu, force push ve silme yasak) | Depo → Settings → Rules → Rulesets | [ ] | `kanit/github-ruleset.png` |
| G9 | Secret scanning ve push protection açık | Depo → Settings → Advanced Security | [ ] | `kanit/github-secret-scanning.png` |
| G10 | Dependabot alerts açık | Aynı sayfa → Dependabot alerts | [ ] | aynı görüntü |

## 2. Cloudflare hesabı (bulut)

| # | Kontrol | Nasıl doğrulanır | Durum | Kanıt |
| --- | --- | --- | --- | --- |
| C1 | İki adımlı doğrulama açık (güvenlik anahtarı / passkey veya TOTP) | My Profile → Authentication → Two-Factor Authentication | [ ] | `kanit/cloudflare-2fa.png` |
| C2 | Kurtarma kodları çevrimdışı saklanıyor | Aynı sayfa → Backup codes | [ ] | — (kodlar gösterilmez) |
| C3 | **Kök hesap kilitli:** Super Administrator yalnızca hesap ve üye yönetimi için kullanılıyor, MFA'lı | Manage account → Members | [ ] | `kanit/cloudflare-uyeler.png` |
| C4 | **Ayrı, en az yetkili kimlik** tanımlı | Members listesinde ikinci üye ya da API token'ı (aşağıdaki tablo) | [ ] | `kanit/cloudflare-uyeler.png` |
| C5 | Ödeme yöntemi tanımlı değil, plan ücretsiz | Manage account → Billing | [ ] | `kanit/cloudflare-billing.png` |
| C6 | Audit log erişilebilir | Manage account → Audit logs | [ ] | `kanit/cloudflare-audit.png` |
| C7 | Başarısız yayın bildirimi açık | Notifications → Add → Pages | [ ] | `kanit/cloudflare-bildirim.png` |

## 3. Erişim incelemesi (kim neye erişebiliyor?)

| Kimlik | Nerede | Rol / yetki | Neden gerekli | Karar |
| --- | --- | --- | --- | --- |
| iremgecici2@gmail.com | Cloudflare | Super Administrator (kök) | Hesap, üye ve faturalama yönetimi | Tut; yalnızca yönetim için, MFA'lı |
| 2516016027@ogr.cbu.edu.tr veya API token'ı | Cloudflare | Okuma yetkisi (Administrator Read Only / Pages Read) | Günlük inceleme ve demo; değişiklik yapamaz | Tut |
| Miremgecici | GitHub | Depo sahibi | Geliştirme | Tut; passkey + 2FA |
| Cloudflare Workers and Pages (GitHub App) | GitHub | Yalnızca `kutuphane-populerlik` deposu | Push'ları görüp siteyi yayınlamak | Tut; tek depoyla sınırlı |
| github-actions[bot] (`GITHUB_TOKEN`) | GitHub | İş bazında: contents/pull-requests/issues | Veri güncelleme, ZAP raporu, alarm | Tut; her çalışmada yeni ve kısa ömürlü |
| Dependabot | GitHub | Güncelleme PR'ı açma | Bağımlılık taraması | Tut |
| *(listede olmayan her şey)* | — | — | — | Kaldır |

Sonraki inceleme: final tesliminden sonra ve en geç 3 ayda bir.

## 4. Doğrulama testi: en az yetkili kimliğin yapamadığı işlem

**Amaç:** Okuma yetkili kimliğin site üzerinde değişiklik yapamadığını göstermek.

| Adım | Beklenen | Sonuç | Kanıt |
| --- | --- | --- | --- |
| Okuma yetkili kimlikle Workers & Pages → kutuphane-populerlik projesini aç | Proje ve yayın listesi **görünür** | [ ] | `kanit/test-okuma-ok.png` |
| Aynı kimlikle Settings → Builds → derleme komutunu değiştirmeyi dene | **Reddedilir** (düğme pasif ya da yetki hatası) | [ ] | `kanit/test-yazma-red.png` |
| Aynı kimlikle bir yayını silmeyi ya da yeniden başlatmayı dene | **Reddedilir** | [ ] | `kanit/test-silme-red.png` |

API token'ı ile yapılırsa (token yalnızca "Account → Cloudflare Pages → Read" izinli; token'ı kimseyle paylaşma, terminale kendin yaz):

```bash
# Okuma: başarılı olmalı ("success": true)
curl -s -H "Authorization: Bearer $CF_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$HESAP_ID/pages/projects/kutuphane-populerlik" | head -c 300

# Yazma: reddedilmeli ("success": false, kod 10000 Authentication error)
curl -s -X PATCH -H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json" \
  -d '{"build_config":{"build_command":"echo test"}}' \
  "https://api.cloudflare.com/client/v4/accounts/$HESAP_ID/pages/projects/kutuphane-populerlik"
```

Test bitince token'ı Cloudflare'den sil.
