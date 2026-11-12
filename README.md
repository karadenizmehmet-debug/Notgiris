# Not Giriş

Sınav kâğıdının fotoğrafından soru bazlı puanları okuyup e-Okul not giriş ekranına aktarmaya yardım eden telefon uygulaması.

**Veriler telefondan çıkmaz.** Yazı okuma (Tesseract.js) ve el yazısı rakam tanıma (küçük bir sinir ağı) tamamen tarayıcıda çalışır. Kayıtlar telefonun yerel hafızasında tutulur.

## Nasıl çalışır
Girdi, tüm sınıfın puan listesidir: bir sütunda ad soyad, yanında “1.soru, 2.soru …” başlıklı sütunlar.

1. **Puanlar** sekmesinde üç yoldan biriyle listeyi okutun:
   - **Fotoğraf**: basılı liste, puanlar elle (mavi/siyah kalem) ya da bilgisayarda yazılmış. Her hücrenin fotoğraftan kesilmiş küçük resmi okunan değerin üstünde gösterilir; sarı = kontrol edin, kırmızı = boş ya da sorunun puanından büyük.
   - **Excel / CSV dosyası** ya da **Excel'den yapıştır**: puanlar zaten Excel'deyse en güvenilir yol (okuma hatası olmaz).
2. **Ayarlar**'da soru puanları (ör. `10,20,30,40`) ve isteğe bağlı sınıf listesi girilebilir. Liste girilirse okunan adlar düzeltilir, öğrenci numarası eklenir.
3. **e-Okul için kopyala**.
4. Firefox'ta (Android) Tampermonkey kurulu olarak e-Okul not giriş sayfasını açın, sağ alttaki **Not Giriş** panelinde metni yapıştırıp **Puanları Doldur**'a basın. Satırlar numaraya, yoksa ada göre eşleşir. Kontrol edip e-Okul'un **Kaydet** düğmesine siz basın.

## e-Okul eklentisi
`eokul.user.js` — Tampermonkey kullanıcı betiği. Uygulamadaki bağlantıdan kurulur. Betik yalnızca sayfadaki kutuları doldurur, e-Okul'a kendi başına bir şey göndermez.

## Dosyalar
- `index.html`, `css/`, `js/app.js` — arayüz
- `js/table.js` — fotoğraf/Excel/CSV/yapıştırmadan tablo okuma
- `js/digits.js`, `model/digits.json` — el yazısı rakam modeli (MNIST, %98,5 test doğruluğu)
- `vendor/` — Tesseract.js 7 ve SheetJS (yerel kopyalar), `lang/tur.traineddata.gz` — Türkçe dil verisi
- `sw.js` — çevrimdışı çalışma

Mehmet Karadeniz, 2026-2027
