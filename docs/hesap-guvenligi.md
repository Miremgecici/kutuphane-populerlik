# Hesap güvenliği denetim listesi ve erişim incelemesi

Kart: **Geliştirici ve bulut hesabının ele geçirilmesi** · Kontrol: MFA (TOTP; passkey sonraki adım), kök hesabın kilitlenmesi, ayrı en az yetkili kimlik, kurtarma kodları, erişim incelemesi.
Denetim tarihi: 28.10.2026 · Denetleyen: Müesser İrem Gecici

Ekran görüntüleri güvenlik raporundadır (28.10.2026). Kurtarma kodları hiçbir görüntüde, depoda veya sohbette yer almaz.

## 1. GitHub hesabı (Miremgecici)

| # | Kontrol | Nasıl doğrulanır | Durum | Kanıt |
| --- | --- | --- | --- | --- |
| G1 | Passkey tanımlı | Settings → Password and authentication → Passkeys | Yapılmadı (sonraki adım) | — |
| G2 | İki adımlı doğrulama (TOTP uygulaması) açık | Aynı sayfa → Two-factor authentication: Enabled | ✅ | Rapor 4.1 |
| G3 | Kurtarma kodları indirildi ve çevrimdışı saklanıyor | Aynı sayfa → Recovery codes → Viewed | ✅ | — (kodlar gösterilmez) |
| G4 | Şifre benzersiz ve parola yöneticisinde | Beyan | Beyan | — |
| G5 | Tanınmayan oturum yok | Settings → Sessions | Kendi kontrolü | — |
| G6 | Yetkili uygulamalar incelendi | Settings → Applications → Authorized / Installed GitHub Apps | ✅ | Rapor 4.1 (Cloudflare uygulaması tek depo) |
| G7 | Kişisel erişim token'ı yok ya da hepsi süreli ve gerekli | Settings → Developer settings → Personal access tokens | Kendi kontrolü (dağıtım token'ı kullanılmıyor) | — |
| G8 | main dalı korumalı (PR zorunlu, force push ve silme yasak) | Depo → Settings → Rules → Rulesets | ✅ | Rapor 4.2; doğrudan push reddi rapor 5.3 |
| G9 | Secret scanning ve push protection açık | Depo → Settings → Advanced Security | ✅ | Rapor 4.2 |
| G10 | Dependabot alerts açık | Aynı sayfa → Dependabot alerts | ✅ | Rapor 4.2 |

## 2. Cloudflare hesabı (bulut)

| # | Kontrol | Nasıl doğrulanır | Durum | Kanıt |
| --- | --- | --- | --- | --- |
| C1 | İki adımlı doğrulama açık (güvenlik anahtarı / passkey veya TOTP) | My Profile → Authentication → Two-Factor Authentication | ✅ (TOTP) | Rapor 4.1 |
| C2 | Kurtarma kodları çevrimdışı saklanıyor | Aynı sayfa → Backup codes | ✅ | — (kodlar gösterilmez) |
| C3 | **Kök hesap kilitli:** Super Administrator yalnızca hesap ve üye yönetimi için kullanılıyor, MFA'lı | Manage account → Members | ✅ | Rapor 4.1 (Members) |
| C4 | **Ayrı, en az yetkili kimlik** tanımlı | Members listesinde ikinci üye ya da API token'ı (aşağıdaki tablo) | ✅ okul e-postası, Administrator Read Only, 2FA açık | Rapor 4.1 (Members) |
| C5 | Ödeme yöntemi tanımlı değil, plan ücretsiz | Manage account → Billing | ✅ | Rapor 7 |
| C6 | Audit log erişilebilir | Manage account → Audit logs | Kendi kontrolü | — |
| C7 | Başarısız yayın bildirimi açık | Notifications → Add → Pages | Yapılmadı; yerine izleme iş akışı ve GitHub commit durum kontrolü | Rapor 6 |

## 3. Erişim incelemesi (kim neye erişebiliyor?)

| Kimlik | Nerede | Rol / yetki | Neden gerekli | Karar |
| --- | --- | --- | --- | --- |
| iremgecici2@gmail.com | Cloudflare | Super Administrator (kök) | Hesap, üye ve faturalama yönetimi | Tut; yalnızca yönetim için, MFA'lı |
| 2516016027@ogr.cbu.edu.tr | Cloudflare | Administrator Read Only | Günlük inceleme ve demo; değişiklik yapamaz | Tut |
| Miremgecici | GitHub | Depo sahibi | Geliştirme | Tut; TOTP 2FA |
| Cloudflare Workers and Pages (GitHub App) | GitHub | Yalnızca `kutuphane-populerlik` deposu | Push'ları görüp siteyi yayınlamak | Tut; tek depoyla sınırlı |
| github-actions[bot] (`GITHUB_TOKEN`) | GitHub | İş bazında: contents/pull-requests/issues | Veri güncelleme, ZAP raporu, alarm | Tut; her çalışmada yeni ve kısa ömürlü |
| Dependabot | GitHub | Güncelleme PR'ı açma | Bağımlılık taraması | Tut |
| *(listede olmayan her şey)* | — | — | — | Kaldır |

Sonraki inceleme: final tesliminden sonra ve en geç 3 ayda bir.

## 4. Doğrulama testi: en az yetkili kimliğin yapamadığı işlem

**Amaç:** Okuma yetkili kimliğin site üzerinde değişiklik yapamadığını göstermek.

| Adım | Beklenen | Sonuç | Kanıt |
| --- | --- | --- | --- |
| Okuma yetkili kimlikle Workers & Pages → kutuphane-populerlik projesini aç | Proje ve yayın listesi **görünür** | Demoda canlı | — |
| Aynı kimlikle Settings → Builds → derleme komutunu değiştirmeyi dene | **Reddedilir** (düğme pasif ya da yetki hatası) | Demoda canlı | — |
| Aynı kimlikle bir yayını silmeyi ya da yeniden başlatmayı dene | **Reddedilir** | Demoda canlı | — |
| Ruleset açıkken `main`'e doğrudan push | **Reddedilir** | ✅ 28.10.2026 19:22, "GH013 … Changes must be made through a pull request" | Rapor 5.3 |

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
