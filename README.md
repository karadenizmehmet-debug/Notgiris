# Not Giriş

Sınav kâğıdının fotoğrafından soru bazlı puanları okuyup e-Okul not giriş ekranına aktarmaya yardım eden telefon uygulaması.

**Veriler telefondan çıkmaz.** Yazı okuma (Tesseract.js) ve el yazısı rakam tanıma (küçük bir sinir ağı) tamamen tarayıcıda çalışır. Kayıtlar telefonun yerel hafızasında tutulur.

## Nasıl çalışır
1. **Sınav** sekmesinde sınıf listesini girin (her satıra `numara ad soyad`). Soru puanlarını boş bırakırsanız ilk kâğıttaki `1. SORU (5 PUAN)` etiketlerinden alınır.
2. **Kâğıt Oku**: fotoğrafı çekin. Uygulama soru etiketlerini bulur, her sorunun yanına **kırmızı (veya yeşil) kalemle** yazdığınız puanı okur.
   - Yeşil kutu: emin. Sarı: kontrol edin. Kırmızı: boş ya da en yüksek puandan büyük.
   - Kâğıtta `No: 15` yazıyorsa öğrenci otomatik seçilir; yoksa sıradaki öğrenci önerilir.
   - İki sayfalık sınavda **+ Sayfa ekle** ile ikinci sayfayı okutun.
3. **Liste** sekmesinde **e-Okul için kopyala**.
4. Firefox'ta (Android) Tampermonkey kurulu olarak e-Okul not giriş sayfasını açın, sağ alttaki **Not Giriş** panelinde metni yapıştırıp **Puanları Doldur**'a basın. Kontrol edip e-Okul'un **Kaydet** düğmesine siz basın.

## e-Okul eklentisi
`eokul.user.js` — Tampermonkey kullanıcı betiği. Uygulamadaki bağlantıdan kurulur. Betik yalnızca sayfadaki kutuları doldurur, e-Okul'a kendi başına bir şey göndermez.

## Dosyalar
- `index.html`, `css/`, `js/app.js` — arayüz
- `js/reader.js` — fotoğraf işleme, soru etiketi bulma, puan eşleştirme
- `js/digits.js`, `model/digits.json` — el yazısı rakam modeli (MNIST, %98,5 test doğruluğu)
- `vendor/` — Tesseract.js 7 (yerel kopya), `lang/tur.traineddata.gz` — Türkçe dil verisi
- `sw.js` — çevrimdışı çalışma

Mehmet Karadeniz, 2026-2027
