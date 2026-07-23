# Exposure Member Access — Proje Tanıtımı ve Arka Plan
*(Bu dosyayı yeni Claude Project'in "Project Knowledge" kısmına ekle.)*

## 1. Exposure nedir?

Exposure, Türkiye'deki AI/startup kurucuları için özel, başvuru ile kabul edilen bir üyelik topluluğu. Web sitesi: https://exposureai.org — Next.js + Supabase ile yazılmış.

## 2. İki ayrı mobil proje var, karıştırma

- **Exposure Members Mobile** (önceki/ana proje): web sitesinin **tamamını** — herkese açık ana sayfa + başvuru formu + AI Academy tanıtımı + üye alanı — uygulamaya çeviren proje. Zaten önemli ölçüde ilerlemiş durumda.
- **Exposure Member Access** (bu yeni proje): bir toplantıda alınan geri bildirim üzerine açıldı — şirket aslında sadece web sitesindeki `https://exposureai.org/members/dashboard?section=directory` sayfasının (yani giriş yapmış üyenin gördüğü alanın) uygulamaya çevrilmesiyle ilgileniyor. Herkese açık pazarlama sayfaları (ana sayfa, başvuru formu, AI Academy) bu projenin kapsamı **dışında.**
- İki proje bilinçli olarak ayrı repo / ayrı Claude Project olarak yürütülüyor ki ana projedeki çalışan şeyler bozulmasın.

## 3. Önemli: bu iki proje aslında büyük ölçüde çakışıyor

Ana projede zaten "Member Access → giriş → üye paneli" akışı kurulmuştu: kullanıcının oturumu varsa doğrudan panele, yoksa giriş ekranına gidiyordu. O panelde Üye Rehberi (Directory), Etkinlikler (Events), bir web-görünümü sekmesi (Dashboard/WebView) ve Profil ekranları vardı, hepsi gerçek backend API'siyle konuşuyordu (Supabase sadece giriş için, veri hep `exposureai.org/api/members/...`'den).

**Bu şu demek:** şirketin şimdi istediği şey, ana projede zaten prototiplenmiş bir parça. Sıfırdan başlamak yerine, o parçanın **çalışan** kodunu — özellikle giriş ekranı ve API bağlantı katmanı, ikisi de gerçek hatalarla test edilip düzeltilmişti — yeni, temiz bir projeye taşımak mantıklı bir başlangıç noktası olabilir. (Örnek: üye rehberi ekranı bir ara "member_types" alanı yüzünden çöküyordu çünkü backend'den dizi değil, virgülle ayrılmış bir metin geliyordu — bu hata bulunup düzeltilmişti. Sıfırdan yazarsak aynı hatayı muhtemelen tekrar keşfederiz.)

Tasarımı henüz web sitesiyle birebir eşleşmemiş ekranlar (Rehber, Etkinlikler, Profil) yine de görsel olarak yeniden ele alınmalı — ama veri çekme mantığı sağlam.

*(Bu bir öneri, kesin karar değil — aşağıdaki "5. Birlikte Karar Vermemiz Gereken Noktalar" bölümüne bak.)*

## 4. Ana projede kurulan SİSTEM (bu projede de aynen uygulanacak)

### a) PROJECT.md = projenin hafızası
Tek bir Markdown dosyası, her oturumun başında baştan sona okunuyor. İçinde: proje özeti, mimari, kesin kurallar, alınmış kararlar, ekran durumu tablosu, açık sorular ve tarihli bir "oturum günlüğü" (her görev bitince altına yeni kayıt ekleniyor, eskiler silinmiyor). Bu sayede Claude Code her yeni görevde "hafızasını" bu dosyadan geri kazanıyor.

### b) API.md = backend'in tek doğru kaynağı
Backend ekibinin API'sinin tüm endpoint'leri, istek/cevap şekilleri burada. Kural: cevap şekli burada yoksa ya da gerçekle uyuşmuyorsa **tahmin etme, sor.**

### c) Mimari prensip: Supabase sadece giriş için
Giriş: email → 6-10 haneli kod → Supabase oturumu. Bütün diğer veri (rehber, etkinlikler, profil, iş ilanları...) `https://exposureai.org/api/members/...`'den, Bearer token ile. Uygulama asla veritabanına direkt bağlanmıyor.

### d) Kesin kurallar
Ödeme/abonelik UI yok, gizli anahtar yok, basit tut (state-management kütüphanesi yok), API'de emin olmadan tahmin etme, web'deki bilinçsiz hataları/tuhaflıkları düzeltmeden birebir yansıt.

### e) Keşif disiplini
Gerçek siteye bakarken her zaman **mobil ekran genişliğinde** (ör. 375px) incele — masaüstü görünümü yanıltıcı olabiliyor. Ana projede birkaç kez masaüstünde yapılan keşif yanlış sonuç verdi, mobilde tekrar kontrol edilince düzeltildi.

### f) Doğrulama disiplini
Geliştirme ortamında gerçek telefon/Mac yok (Windows + Expo Go üzerinden test). Bu yüzden hiçbir değişiklik, kullanıcı kendi telefonunda gözle görüp onaylamadan "bitti" sayılmıyor / commit edilmiyor.

### g) Teknik yığın (ana projede kanıtlanmış, aynen kullanılabilir)
- Expo (React Native + TypeScript) — Windows'ta geliştirme, iOS build'leri bulutta (EAS Build) yapılıyor çünkü Mac yok.
- Apple Developer hesabı henüz açılmadı, ileride açılacak.
- NativeWind (Tailwind for RN) ile web sitesinin renk/görünüm dilini birebir taklit ediliyor. Marka renkleri: `brand-blue #0339A6`, `brand-cream #FFFCF6`.
- Expo SDK sürümü, App Store'daki Expo Go uygulamasının desteklediği en güncel sürüme göre seçiliyor — bu sürekli değişebiliyor, kodlamaya başlamadan güncel durumu kontrol etmek gerekiyor.

## 5. Birlikte karar vermemiz gereken noktalar

Bunlar için detaylı konuşacağız — şimdilik bir yön öneriliyor ama son söz kullanıcıda.

1. **Kod yeniden kullanımı**: ana projedeki giriş ekranı + API bağlantı dosyalarını yeni projeye kopyalayıp mı başlayalım, yoksa tamamen sıfırdan mı yazalım? (Öneri: kopyala — gerekçesi Bölüm 3'te.)
2. **İş İlanları / Haftalık Eşleştirme / diğer içerik**: ana projede bunlar native ekran olarak yapılmamıştı, sadece web görünümünün (WebView) içinde geliyordu. Bu proje artık sadece üye alanına odaklandığı için, bu ekranları bu sefer native (uygulamaya özel, daha hızlı/şık) mı yapalım, yoksa yine WebView ile mi bırakalım?
3. **Uygulamanın açılış ekranı**: uygulama direkt giriş ekranıyla mı açılsın, yoksa Apple'ın "girişsiz de bir şeyler görülebilmeli" beklentisini karşılamak için çok kısa bir karşılama ekranı mı olsun?

## 6. Kaynak referanslar

- Web sitesi: https://exposureai.org
- Üye paneli (giriş gerekli): https://exposureai.org/members/dashboard?section=directory
- Backend API dokümantasyonu: bu projeye eklenen `API.md` (ana projedeki API.md ile aynı — backend AYNI, sadece hangi endpoint'leri kullanacağımız değişebilir).
