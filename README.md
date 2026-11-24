# 👑 Parti Sarayı — Semih & Kraliçe Ceyda’nın Gecesi

> **Bursa 16 ✦ Tekirdağ 59.** İki telefon. Tek oda. Aynı görev. Ortak skor. Bol kahkaha.
>
> Gece, Semih ile Kraliçe Ceyda’nın sarayında geçer. Gecenin kazananı tacı giyer:
> **👸🏽 Kraliçe Ceyda** ya da **🤴🏽 Kral Semih**.

“Party Arcade” planından yola çıkılarak hazırlanmış, **telefon tarayıcısında** çalışan,
kurulum ve hesap gerektirmeyen iki kişilik parti oyunu.

## Nasıl oynanır?
1. Siteyi aç → takma adını yaz → **🎉 Oda Kur**.
2. **Davet et / WhatsApp** butonuyla linki arkadaşına gönder (ya da 6 haneli kodu söyle).
3. İkiniz de **🙌 Hazırım** deyince lobi açılır, oyunu seçin.
4. Sıradaki oyuncu kart çeker; görev, sıra, tur ve skor iki ekranda **anında** aynı görünür.
5. Hedef puana (varsayılan 5) ilk ulaşan tacı kapar (**Kraliçe Ceyda / Kral Semih**, yani gecenin Party Boss’u). Beraberlikte final düellosu oynanır.

Sesli/görüntülü konuşma için WhatsApp ya da telefon görüşmesini açık tutun.

## Oyunlar
| Oyun | Kısaca |
|---|---|
| 🎲 Şans mı, Rezillik mi? | Dans, taklit, reklam, şarkı, doğaçlama görevleri. Kişi başı 1 pas hakkı. |
| 😂 Beni Güldür | Güldüren ya da dayanan puanı alır. |
| 🕵️ Doğru mu, Uydurdum mu? | 3 hikâye, 1’i yalan. Anlatıcı yalanı gizlice işaretler, rakip tahmin eder. |
| 🚫 Yasaklı Kelime | Sohbet edin; yasaklı kelimeyi söyleyen turu kaybeder. |
| 🎡 Kader Çarkı | Animasyonlu çark 8 kategoriden birini seçer. 👑 Kraliyet görevi 2 puan. |
| 👸 Kraliçenin Fermanı | Saraydan fermanlar; 👑 büyük fermanlar 2 puan. |
| 📒 Beyaz Kaplı Defter | Kraliçeyi ne kadar tanıyorsun? 4 şıklı sorular; bilemezsen puan kraliçeye. |
| ⚡ Bonus Görevler | Şarkı tahmini, emojiyle anlatım, ters röportaj, hayalî restoran… |

Görev havuzunda Bursa (İskender, Uludağ, Karagöz–Hacivat, kestane şekeri) ve Tekirdağ (köfte, Kiraz Festivali, Şarköy) ve Parti Sarayı yol gezisi temalı kartlar var. Ana sayfada **🤴 Semih / 👸 Ceyda** hızlı seçim butonları bulunur.

Ayrıca: **📱 Tek Telefonda Oyna** modu (internet gerekmez), tur geçmişi, önerilen gece programı (22:00–23:50),
ses/titreşim efektleri, ekranın kapanmasını engelleme, ana ekrana ekleme (PWA).

## Teknik
- Saf HTML/CSS/JS, derleme yok. Depo kökü doğrudan yayınlanabilir statik bir sitedir.
- **Canlı senkronizasyon:** Herkese açık MQTT (WebSocket) sunucuları (`broker.emqx.io`, `broker.hivemq.com`,
  `test.mosquitto.org`). Oda **üçüne aynı anda** bağlanır ve her mesajı hepsine yazar; biri çökse ya da bir
  ağda engelliyse oyun diğerlerinden sürer. Firebase/Supabase hesabı ya da anahtar gerekmez.
  Ana sayfadaki **📡 Bağlantı testi** hangi sunuculara ulaşılabildiğini gösterir.
  - Oda durumu *retained* mesajla saklanır → sayfa yenilense ya da bağlantı kopsa oyun kaldığı yerden devam eder.
  - Tüm kararları oda sahibi uygular, diğer oyuncu sadece aksiyon gönderir → çakışan tur / çift puan olmaz.
  - Bağlı / yeniden bağlanıyor durumu otomatik gösterilir. Oda sahibi uzun süre düşerse diğer oyuncu yönetimi devralabilir.
- **Gizlilik:** Sadece takma ad ve skor paylaşılır; kişisel bilgi istenmez. Oda kodu 6 karakterlik
  rastgele koddur (~1 milyar ihtimal), odalar 24 saat sonra geçersiz olur. Açık sunucu kullanıldığı
  için hassas bilgi yazmayın.

## Yayınlama
**GitHub Pages:** Bu depoyu GitHub'a gönderin → *Settings → Pages → Source: GitHub Actions*.
`.github/workflows/pages.yml` her `main` güncellemesinde siteyi yayınlar:
`https://<kullanıcı>.github.io/<depo>/`

**Alternatif:** Klasörü [Netlify Drop](https://app.netlify.com/drop)’a sürükleyip bırakın.

> Dosyayı telefonda doğrudan açmak (`file://`) yalnızca tek telefon modunda çalışır; online oda için
> sitenin `https://` adresinden açılması gerekir.

## Yerel test
```sh
python3 -m http.server 8080
# telefondan aynı Wi-Fi'da http://<bilgisayar-ip>:8080
```
