# Claude Code — Exposure Member Access: Proje Kurulum Promptu
*(Bunu, yeni proje klasöründe açtığın Claude Code'a olduğu gibi yapıştır.)*

---

Ben Exposure adlı bir topluluğun (https://exposureai.org) web sitesindeki "üye alanını" — giriş yapmış üyenin gördüğü kısım: üye rehberi, etkinlikler, iş ilanları, haftalık eşleştirme, profil — bir iOS uygulamasına çeviriyorum.

Bu, daha önce başlanmış "Exposure Members Mobile" adlı **ayrı, daha büyük** bir projeden (o proje sitenin tamamını kapsıyordu) bilinçli olarak ayrılmış, yeni ve odaklı bir proje. Şu anda bu yeni projenin klasöründeyiz, boş bir başlangıç noktasındayız.

## 0. Önce bana sor, tahmin etme

Koda başlamadan önce bana şunları sor (aşağıdaki varsayılan önerilerle birlikte, ben onaylayayım ya da değiştireyim):

1. **Eski proje klasörü**: "Exposure Members Mobile" projesinin klasör yolu bende bilgisayarımda var mı, varsa nerede? (Varsa oradan bazı ÇALIŞAN dosyaları — giriş ekranı, API bağlantı katmanı — kopyalayıp başlangıç noktası olarak kullanmak istiyorum, sıfırdan yazmak yerine. Yoksa dosyaları ben sana ayrıca yapıştıracağım / sıfırdan yazacaksın.)
2. **Repo adı**: yeni GitHub reposunun adı ne olsun? (öneri: `Exposure-Member-Access`)
3. **İş İlanları / Haftalık Eşleştirme**: bu ekranları bu projede native mi yapalım, yoksa şimdilik web görünümü (WebView) içinde mi bırakalım? (Ana projede WebView'daydı.)

## 1. Proje kapsamı (kesin — dışına çıkma)

Sadece şunlar var: Giriş (email → kod → Supabase oturumu), sonrasında üye paneli — Üye Rehberi, Etkinlikler, İş İlanları, Haftalık Eşleştirme, Profil, topluluk içeriği (linkler/haber bülteni/YouTube). Herkese açık pazarlama sayfaları (ana sayfa/başvuru formu/AI Academy) YOK — onlar ayrı bir projede.

## 2. Mimari (değişmez, ana projeden aynen taşınıyor)

- Supabase **sadece giriş için**: email → kod → `supabase.auth.verifyOtp({ email, token, type: 'email' })`. Kod uzunluğu sabit 6 değil — 6 ile 10 hane arası kabul et (backend bazen 8 haneli kod gönderiyor, doğrulanmış gerçek bir durum).
- Oturum telefonda saklanıyor (AsyncStorage + `persistSession:true` + `autoRefreshToken:true`), uygulama her açıldığında arka planda geri yükleniyor — tam ekran splash olmadan.
- **Tüm veri** `https://exposureai.org/api/members/...`'den, `Authorization: Bearer <token>` header'ıyla. Uygulama veritabanına asla direkt bağlanmıyor.
- Basit tut: state-management kütüphanesi yok, her ekran kendi verisini kendi çeker (`lib/api.ts` içindeki yardımcılarla).

## 3. Kesin kurallar (asla ihlal etme)

1. Ödeme/abonelik/fiyat UI'ı **ekleme.** Apple bu yüzden reddeder.
2. `lib/config.ts`'teki Supabase URL/anon key gibi public değerler hariç, hiçbir gizli anahtar/token koda gömme.
3. API cevap şekli belirsizse tahmin etme, bana sor.
4. Gereksiz kütüphane/soyutlama ekleme.

## 4. Kurulum adımları

1. Kodlamaya başlamadan önce https://docs.expo.dev adresinden **güncel** kurulum komutunu ve önerilen SDK sürümünü doğrula — Expo sık değişiyor, ezbere gitme.
2. Yeni bir Expo + TypeScript projesi oluştur. SDK sürümünü, App Store'daki güncel Expo Go uygulamasının desteklediği en son sürüme göre seç (Apple Developer hesabımız henüz yok, geliştirme Expo Go üzerinden yapılıyor). Hangi sürümü seçtiğini ve nedenini `PROJECT.md`'ye yaz.
3. NativeWind v4 kur (Tailwind for RN) — `babel.config.js`, `metro.config.js`, `global.css`, `tailwind.config.js`. Marka renklerini tanımla: `brand-blue #0339A6`, `brand-cream #FFFCF6`.
4. Şu klasör/dosya yapısını oluştur:
   - `lib/config.ts` (Supabase URL/anon key + `API_BASE`)
   - `lib/supabase.ts` (auth client, AsyncStorage persist)
   - `lib/api.ts` (`apiFetch`/`apiJson`, Bearer token ekleme, 401 gelirse otomatik `signOut`)
   - `types.ts`
   - `screens/`, `components/`
5. **(0. adımda onay aldıysan)** eski projeden şu dosyaları başlangıç noktası olarak kullan — birebir kopyalama, bu projenin PROJECT.md/API.md'sine göre gözden geçirerek uyarla:
   - `lib/config.ts`, `lib/supabase.ts`, `lib/api.ts`
   - `types.ts` — **dikkat**: `member_types` alanı backend'den bir dizi (`string[]`) değil, virgülle ayrılmış bir **metin (string)** olarak geliyor. Eski projede bu, tip tanımıyla gerçek veri uyuşmadığı için bir çökmeye yol açmıştı. Güvenli bir `toTypeList(raw: unknown): string[]` yardımcısı kullan (hem dizi hem string hem null/undefined durumunu güvenle karşılasın).
   - `screens/LoginScreen.tsx` — email + kod ekranı, kod uzunluğu 6-10 hane arası kabul ediyor olmalı (bkz. Bölüm 2).
6. `App.tsx`: kök navigasyonu basit tut — bu projede "Home" (herkese açık ana sayfa) yok, uygulama doğrudan `session ? Panel : Login` mantığıyla açılıyor (0.3'te farklı bir karar aldıysak ona göre uyarla).
7. `PROJECT.md` dosyasını oluştur (bu projenin hafızası) — bölümler: Proje Özeti, Mimari, Kesin Kurallar, Alınmış Kararlar, Ekran Durumu tablosu, Açık Sorular, Oturum Günlüğü (boş, ilk kayıt kurulumla başlasın).
8. `API.md` dosyasını ekle — ayrı olarak sana vereceğim, ana projedeki API.md ile aynı backend'i belgeliyor (üye rehberi, etkinlikler, iş ilanları, eşleştirme, profil, içerik endpoint'leri).
9. Git: yeni, **boş** bir private repo oluştur — eski projeyle git geçmişi/fork bağlantısı **olmasın**, ilk commit'i at.
10. `npx expo-doctor` ve `npx tsc --noEmit` ile kurulumu doğrula, sonucu `PROJECT.md`'ye yaz.

## 5. Çalışma disiplini (unutma)

- Her yeni görevden önce `PROJECT.md`'yi baştan sona oku.
- Web sitesini incelerken her zaman mobil ekran genişliğinde (375px gibi) bak — masaüstü görünümü farklı davranabiliyor.
- Gerçek cihaz/Mac yok — hiçbir değişiklik, kullanıcı kendi telefonunda Expo Go ile görüp onaylamadan commit edilmez.
- Her görev bitince `PROJECT.md`'nin Oturum Günlüğü'ne yeni kayıt ekle (eskiler silinmez, sadece üstüne eklenir).

---

*Not: Bu prompt'u gönderdikten sonra, Claude Code'a `API.md` dosyasını da ayrıca vermen gerekecek (proje köküne kaydedecek) — o dosya bu paketle birlikte ayrıca hazır.*
