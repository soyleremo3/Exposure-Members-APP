# PROJECT.md — Exposure Member Access

> Bu dosya projenin hafızasıdır. **Her yeni göreve başlamadan önce baştan sona oku.**
> `API.md` backend'in tek doğru kaynağıdır — veri şekliyle ilgili her soruda önce oraya bak.

---

## 1. Proje Özeti

- **Exposure**: Türkiye'deki AI/startup kurucuları için başvuruyla kabul edilen üyelik topluluğu. Web: https://exposureai.org
- Bu proje, web sitesinin **sadece giriş yapmış üyelerin gördüğü bölümünü** iOS uygulamasına çeviriyor. Sonra Android.
- Geliştirme Windows'ta, Mac yok. Apple Developer hesabı **henüz açılmadı** — test **Expo Go** ile telefonda yapılıyor.

### Kapsam — dışına çıkma

**Var:** Giriş (email → kod) · Üye Rehberi · İş İlanları · Haftalık Eşleştirme · Etkinlikler · Topluluk içeriği (linkler / haber bülteni / YouTube) · Profil

**Yok:** Herkese açık pazarlama sayfaları (ana sayfa, Apply başvuru formu, AI Academy). Onlar ayrı bir projede — `Exposure-APP` (repo: `soyleremo3/Exposure-APP`).

**Kapsam dışı bırakılan:** Community Brain (AI arama). SSE gerektiriyor (`react-native-sse`), kurulum kapsamında değildi. İstenirse ayrı görev olarak eklenir.

---

## 2. Mimari

```
App.tsx ── session ? Stack(Tabs + push ekranları) : LoginScreen
   │
   ├─ booting state: kayıtlı oturum okunana kadar boş cream ekran (tam splash YOK)
   └─ supabase.auth.onAuthStateChange → session state → ağaç otomatik değişir

Tabs
├─ Directory   Rehber          → MemberDetail (push)
├─ Jobs        İş İlanları     → JobDetail → JobCompose / JobApplicants / JobRefer (push)
├─ Match       Haftalık Eşleşme→ MemberDetail (push)
├─ Discover    Etkinlikler | Linkler | Bülten | Videolar (segment)
└─ Profile     Profil
```

- **Supabase SADECE giriş için**: email → kod → `supabase.auth.verifyOtp({ email, token, type: 'email' })`.
  Kod uzunluğu **sabit 6 değil** — 6 ile 10 hane arası kabul edilir. Backend bazen 8 haneli kod gönderiyor (doğrulanmış gerçek durum). `LoginScreen.tsx` içindeki `MIN_CODE_LENGTH`/`MAX_CODE_LENGTH` sabitlerine bak.
- **Oturum telefonda saklanır**: AsyncStorage + `persistSession: true` + `autoRefreshToken: true`. `lib/supabase.ts` ayrıca `AppState` dinliyor — uygulama arka plandayken token yenilemesi duruyor, öne gelince başlıyor.
- **Tüm veri** `https://exposureai.org/api/members/...` üzerinden, `Authorization: Bearer <token>` ile. Uygulama **veritabanına asla direkt bağlanmıyor**.
- **State-management kütüphanesi yok.** Her ekran kendi verisini `lib/api.ts` yardımcılarıyla kendi çeker.
- **401 → otomatik çıkış**: `lib/api.ts` 401 alınca `supabase.auth.signOut()` çağırır → `SIGNED_OUT` → `App.tsx`'teki `session` null olur → Login ekranı kendiliğinden gelir. `navigation.reset()` yok, `navigationRef` yok.

### Dosya yapısı

| Yol | İçerik |
|---|---|
| `lib/config.ts` | Supabase URL + anon key (PUBLIC), `API_BASE`, `USE_LOCAL_API` anahtarı |
| `lib/supabase.ts` | Tek auth client, AsyncStorage persist, AppState refresh köprüsü |
| `lib/api.ts` | `apiFetch`/`apiJson` + her endpoint için tipli yardımcı + `readableError` |
| `lib/format.ts` | `toTypeList`, `initialsOf`, `formatDate`, `timeAgo` |
| `lib/theme.ts` | `BRAND_BLUE` / `BRAND_CREAM` — class ile stillenemeyen prop'lar için |
| `types.ts` | API cevap şekilleri |
| `navigation.ts` | Route adları + parametreleri (`RootStackParamList`, `TabParamList`) |
| `components/` | `Avatar`, `Chip`, `Buttons`, `Feedback` (Loading/ErrorNotice/Empty) |
| `screens/` | Ekranlar; iş ilanları `screens/jobs/` altında |

---

## 3. Kesin Kurallar (asla ihlal etme)

1. **Ödeme / abonelik / fiyat UI'ı YOK.** Ne fiyat yazısı, ne "aboneliği yönet" linki, ne Stripe bağlantısı. Apple kendi IAP sistemini %30 komisyonla zorunlu kılıyor ve dışarıya link vermek bile ret sebebi. Ödeme sadece web sitesinde kalır. `ProfileScreen.tsx` başındaki uyarıyı silme.
2. `lib/config.ts`'teki Supabase URL/anon key gibi **public** değerler hariç hiçbir gizli anahtar/token koda gömülmez. "Başka bir gizli anahtar gerekiyor" hissi oluşursa dur — o mantık backend'e aittir.
3. **API cevap şekli belirsizse tahmin etme, sor.** `API.md` ile gerçek cevap uyuşmuyorsa API.md'yi de düzelt.
4. **Gereksiz kütüphane / soyutlama ekleme.** Redux yok, form kütüphanesi yok, HTTP client yok.
5. Web sitesinde bilinçsiz bir yazım hatası/tuhaflık varsa **kullanıcı onayı olmadan "iyileştirme" yapma** — birebir yansıt.

---

## 4. Alınmış Kararlar

### 4.1 Expo SDK 54 (SDK 57 değil)

SDK 57 en güncel sürüm (30 Haziran 2026'da çıktı) **ama App Store'daki Expo Go henüz SDK 57'yi desteklemiyor** — Expo'nun kendi changelog'u: *"We'd like to release a new version for SDK 57, but we're still waiting on approval."* Apple Developer hesabımız olmadığı için tek test yolumuz Expo Go. Ayrıca `npx create-expo-app@latest` şu an bayraksız **SDK 54** projesi üretiyor — Expo'nun kendi güvenli varsayılanı.

Ek kanıt: eski proje (`Exposure-APP`) aynı sebeple SDK 57'den 54'e düşürülmüştü ve telefonda çalışıyor.

**Ne zaman yükseltilir:** Apple Developer hesabı açılıp EAS Build'e (gerçek build) geçilince, yani Expo Go bağımlılığı kalkınca. SDK 54 desteği ~Eylül/Ekim 2026'ya kadar sürüyor.

Kesin sürümler: `expo ~54.0.35` · `react-native 0.81.5` · `react 19.1.0` · `typescript ~5.9.2`

### 4.2 Eski projeden ne alındı, ne alınmadı

`Desktop\Exposure-APP` (repo `soyleremo3/Exposure-APP`) çalışan kaynak olarak kullanıldı.

**Alındı (uyarlanarak):** `lib/config.ts`, `lib/supabase.ts`, `lib/api.ts` tabanı, `LoginScreen`, `DirectoryScreen`, `EventsScreen` (artık Discover'ın bir bölümü), `ProfileScreen`, NativeWind config dosyaları, `assets/`.

**Alınmadı:** `HomeScreen`, `ApplyScreen`, `AIAcademy*` (kapsam dışı), `WebTab` (WebView tamamen kaldırıldı), pazarlama `components/*`, eski 134 KB'lık `CLAUDE.md`.

**Git bağı yok** — yeni, boş repo. Fork/upstream ilişkisi kurulmadı.

### 4.3 `member_types` — çökme sebebi ve çözümü

Backend `member_types` alanını **virgülle ayrılmış bir string** olarak gönderiyor (bazı hesaplarda dizi, bazılarında hiç yok). Eski projede tip `string[]` yazıldığı için `member_types.join(...)` çağrısı stringde patladı ve **tüm rehber listesi çöktü**.

Çözüm: `types.ts`'te tip `string | string[] | null` olarak gevşek bırakıldı, okuma **her zaman** `lib/format.ts`'teki `toTypeList()` üzerinden yapılıyor. Aynı koruma iş ilanlarındaki `tags` alanına da uygulandı (API.md dizi diyor ama aynı riski almıyoruz).

> **Kural:** liste benzeri hiçbir API alanını doğrudan okuma — `toTypeList()` kullan.

### 4.4 Events 401 tuzağı

`/api/members/events` `subscription_status = 'active'` istiyor ve başarısızlıkta **401** dönüyor — token bozukluğuyla aynı statü. `apiFetch` 401'i "oturum bitti" sayıp `signOut()` çağırdığı için, aboneliği pasif bir üye Etkinlikler'e girdiğinde **tüm uygulamadan atılacaktı**.

Çözüm (`lib/api.ts` → `getEvents`): 401 gelince çıkış yapılmaz, önce `/api/members/profile` denenir.
- Profil 200 → token sağlam, sorun abonelik. `ApiError.subscriptionRequired = true` fırlatılır, ekran mesaj gösterir.
- Profil de 401 → oturum gerçekten bitmiş, `signOut()`.

### 4.5 Sekme yapısı

Job Board ve Match native yapılınca 5 sekme oldu. Topluluk içeriği (linkler/bülten/YouTube) Etkinlikler'le birleşip tek **Discover** sekmesi altında segment olarak duruyor — 8 sekmelik bir tab bar olmasın diye.

### 4.6 Stil: NativeWind (StyleSheet değil)

Eski projede ekranlar `StyleSheet`, `LoginScreen` ise `className` kullanıyordu — karışıktı. Bu projede **her şey NativeWind `className`**. Renk değeri alan ama class ile stillenemeyen prop'lar (`ActivityIndicator color`, `RefreshControl tintColor`, navigator `screenOptions`) `lib/theme.ts`'ten sabit okuyor. Çalışan **mantık** eski projeden birebir taşındı; sadece stil ifadesi değişti.

### 4.7 Arayüz dili: İngilizce — **karara bağlandı (2026-07-23)**

Tüm UI metinleri İngilizce. Sebep: exposureai.org zaten İngilizce, eski projeden taşınan ekranlar da İngilizceydi ("Sign out", "No members match your search"). Kullanıcı onayladı.

Yeni ekranlar/butonlar/hata mesajları İngilizce yazılır. Mevcut metinler Türkçe'ye **çevrilmez**. Türkçe kalanlar: bu dosya, `CLAUDE.md`, kullanıcıya dönük sohbet.

### 4.8 Commit mesajları: İngilizce

Proje dokümantasyonu Türkçe olsa da **her git commit mesajı İngilizce** yazılır. Kullanıcının 2026-07-23'te verdiği kalıcı talimat. (Eski repo `soyleremo3/Exposure-APP`'te karışık dilli geçmiş var — "Member Access Screen added" ile "Optimizasyon Faz 1 done" yan yana. Bu kural onu düzeltiyor.)

### 4.9 `JobDetail` postu listeden okuyor

API.md'de **tek ilan getiren endpoint yok** — sadece `GET /api/members/job-board` (liste). `JobDetailScreen` listeyi çekip `id`'ye göre buluyor. Yan faydası: başvuru/kapatma sonrası `viewer_applied`, `status` gibi bayraklar hep taze geliyor.

### 4.10 Web sitesi 3 profil kolonunu başka anlamda kullanıyor — **doğrulandı (2026-07-23)**

`onurrcelik/Exposure` reposu (web sitesinin kaynağı, kullanıcı erişim verdi) incelendiğinde `DashboardClient.tsx`'te net oldu: DB'deki üç sosyal kolon, form etiketlerinde **tamamen farklı** anlamda kullanılıyor:

| Kolon | Gerçek anlamı |
|---|---|
| `instagram` | **Educational Background** (ör. "BSc Computer Science, Stanford") |
| `twitter` | **Area of Interest** (ör. "AI, GTM, Vibe Coding") |
| `bio` | **Current Occupation** |
| `website` | **Refer a Friend** verisi — JSON string olarak (§ Adım 4) |

Bunlar URL değil, düz metin. Eski `MemberDetailScreen` `instagram`/`twitter`'ı sosyal link sanıp `Linking.openURL` ile açmaya çalışıyordu — **gerçek bug, düzeltildi**. Ayrıntı API.md → Profile başındaki tablo. Sadece `linkedin`, `github`, `occupation_link` gerçek URL.

### 4.13 Tema sistemi: Dark/Light/System, varsayılan Dark — **eklendi (2026-07-23)**

Web'de yok, kullanıcı isteğiyle eklendi: uygulama ilk açılışta **koyu**, ama üye Profile > Appearance'tan Dark/Light/System arası geçebiliyor, tercih kalıcı (AsyncStorage).

- **Mekanizma:** NativeWind v4 + Tailwind v3. `darkMode: 'class'` (manuel geçiş için şart, yoksa `setColorScheme` hata verir). Renkler **semantik token** (`bg-background`, `surface`, `chip`, `hairline`, `body`, `muted`, `faint`, `accent-link`) — `tailwind.config.js`'te `rgb(var(--x) / <alpha-value>)`. Ekranlar sadece bu token'ları kullanıyor, `dar​k:` varyantı serpiştirilmedi.
- **Neden `.dark {}` değil, `vars()`:** Tailwind v3'te `.dark { --var }` CSS-değişken switch'inin NativeWind native'de çalıştığı **doğrulanamadı** (ctx7 dokümanları v4 `@theme`'e odaklı). Bunun yerine kesin çalışan yol: `App.tsx` kökünde `<View style={vars(...)}>` ile aktif temanın değişkenleri runtime sağlanıyor (`LIGHT_VARS`/`DARK_VARS`, `lib/theme.ts`). Şema değişince App re-render → değişkenler anında döner.
- **İlk kare koyu:** `global.css` `:root` **koyu** değerlerle (varsayılan), ayrıca `App.tsx` modül yüklenince `colorScheme.set('dark')`. Kayıtlı tercih (light/system olabilir) boot effect'te uygulanıyor. Böylece açılışta beyaz flash yok.
- **Class alamayan yerler** (`ActivityIndicator color`, `RefreshControl tintColor`, navigator `screenOptions`, `StatusBar`, NavigationContainer theme): `lib/theme.ts` → `useThemeColors()` hook'undan renk okuyor. İki tek istisna (ErrorNotice kırmızı kutusu) `dark:` varyantıyla dönüyor.
- **Kontrol:** `ProfileScreen` → Appearance segment'i (Light/Dark/System), `useColorScheme().setColorScheme` + `saveThemePref`.
- **Not:** exposureai.org sadece koyu; bu bilinçli bir "web'den sapma" (kullanıcı onayı ile). `brand-blue`/`brand-cream` tema-değişmez (buton dolgu + üstündeki metin).

### 4.12 Event görselleri: Supabase render + galeri — **eklendi (2026-07-23)**

Event fotoları Supabase Storage `events` bucket'ında public URL (admin upload, max 10 MB). Web `EventImageGrid` sadece ilk fotoyu + sağ altta sayı rozetini gösteriyor, tıklayınca lightbox. Bizde:
- `lib/images.ts` → `resizedImage()`: public URL'i render endpoint'ine çevirip (`object/public` → `render/image/public`) `width/quality/resize` ekliyor. 10 MB orijinal yerine küçük WEBP.
- Image-transform ücretli özellik; kapalıysa render URL 400 döner → `expo-image` `onError` ile orijinale düşülüyor (`RemoteImage` bileşeni). Yani her durumda çalışır.
- Kart 800px, tam ekran galeri 1080px ister. `cachePolicy="memory-disk"` ile tekrar indirme yok.
- `lib/format.ts` → `toImageList()`: `images` dizi/JSON-string/virgüllü-string hepsini karşılıyor (bu backend'in liste alanı huyu — bkz. §4.3).
- Tam ekran kaydırmalı galeri (Modal + paging FlatList) web'in lightbox'ının mobil karşılığı.

### 4.11 Test hesapları salt-okunur (403) — **doğrulandı (2026-07-23)**

Backend (`proxy.ts:175-179`) `member_category === 'test'` olan hesapları GET-only yapıyor: `/api/members/*`'a **her GET olmayan istek 403 `{ error: "Test accounts are read-only" }`** dönüyor. Bunlar mobil test hesapları (kullanıcının `varrochannel@gmail.com` hesabı dahil) — bilinçli davranış, bug değil.

Web bunu sessizce yutuyor. Bizde `lib/api.ts` → `ApiError.readOnly` + `isReadOnlyError(e)` + `READ_ONLY_NOTICE`. Yazma yapan **her ekran**: `member_category === 'test'` ise üstte nötr `InfoNotice` banner'ı gösterir, mutation'daki read-only hatasını kırmızı `ErrorNotice` yerine sessizce yutar. Match, Refer a Friend ve Job Board'da uygulandı. (ProfileScreen'in kendi yazma akışına henüz eklenmedi — Profile hizalaması yapıldığında eklenecek.)

---

## 5. Ekran Durumu

| Ekran | Dosya | Durum | Endpoint |
|---|---|---|---|
| Giriş | `screens/LoginScreen.tsx` | Kod yazıldı, telefon onayı bekliyor | `POST /api/members/auth` + Supabase `verifyOtp` |
| Üye Rehberi | `screens/DirectoryScreen.tsx` | **Web'e hizalandı, telefonda onaylandı (2026-07-23)** | `GET /directory` |
| Üye Detayı | `screens/MemberDetailScreen.tsx` | **Web'e hizalandı, telefonda onaylandı (2026-07-23)** | — (route param) |
| İş İlanları (tek ekran) | `screens/jobs/JobBoardScreen.tsx` | **Web modeline çevrildi (inline aç/başvur/öner/başvuranlar), telefon onayı bekliyor** | `GET`/`POST`/`PATCH`/`DELETE /job-board(/[id])`, `.../apply`, `.../refer`, `.../applications`, notifications |
| Haftalık Eşleştirme | `screens/MatchScreen.tsx` | **Web'e hizalandı (tüm durumlar + read-only), telefon onayı bekliyor** | `GET`/`POST /match`, `GET`/`PATCH /profile` |
| Keşfet (Events/Links/Newsletter/YouTube) | `screens/DiscoverScreen.tsx` | **Web'e hizalandı + event görsel galerisi, telefonda onaylandı (2026-07-23)** | `GET /events`, `/links`, `/newsletter`, `/youtube` |
| Keşfet → Refer a Friend | `screens/DiscoverScreen.tsx` | **Eklendi + nokta, telefonda onaylandı (2026-07-23)** | `GET`/`PATCH /profile` (`website` alanı) |
| Profil | `screens/ProfileScreen.tsx` | **Appearance (tema) seçici eklendi; website alanı kaldırıldı; telefon onayı bekliyor** | `GET`/`PATCH /profile`, `POST /upload-avatar`, `GET`/`PUT /job-board/notifications` |
| Global tema (Dark/Light/System) | `lib/theme.ts`, `global.css`, `tailwind.config.js`, `App.tsx` | **Kuruldu (varsayılan Dark), telefon onayı bekliyor** | — |
| Keşfet → Community Brain | — | **Yapılmadı** (sıradaki adım — "Coming Soon", allowlist'te değiliz) | `/community-graph`, `/brain-query*` |

> **"Telefon onayı bekliyor"** = kod yazıldı, `tsc` ve `expo-doctor` temiz, ama kullanıcı kendi telefonunda Expo Go ile görüp onaylamadı. Onaylanmadan "bitti" sayılmaz.

---

## 6. Açık Sorular

1. **Tasarım referansı yok — devam ediyor.** `https://exposureai.org/members/dashboard?section=directory` 375px'te denendi (2026-07-23): giriş olmadığı için `exposureai.org` login sayfasına yönlendiriyor. Üye alanı kapalı, kullanıcının şifresiyle giriş yapılmayacak. Job Board / Match / Discover ekranları `API.md`'deki veri şekline göre tasarlandı.
   **Çözüm yolu:** kullanıcı kendi tarayıcısından giriş yapıp 375px genişlikte ekran görüntüsü verir, ekranlar birebir eşleştirilir. (Siteye bakarken **her zaman mobil genişlikte** bak — masaüstü görünümü farklı davranıyor.)
2. **`bundleIdentifier` çakışması.** `org.exposureai.members` eski `Exposure-APP` projesiyle aynı. App Store'a hangisi çıkacaksa diğerininki değişmeli.
3. **`GET /api/members/events` gerçekten 401 mi dönüyor** abonelik pasifken? API.md öyle diyor, kodda ona göre önlem alındı ama gerçek bir pasif hesapla test edilmedi.
4. **Avatar yükleme** (`POST /upload-avatar`) gerçek bir dosyayla test edilmedi. `multipart/form-data`, alan adı `file`, max 5 MB, JPG/PNG/WEBP.
5. **`share_token`** alanı `JobPost` tipinde var ama hiçbir yerde kullanılmıyor. İlan paylaşma özelliği istenirse buradan devam edilir.
6. **Test hesabı `member_category`'si — sonra kesin halledilecek (kullanıcı 2026-07-23).** `varrochannel@gmail.com` `test` kategorisinde, yazma yapamıyor (§4.11). Web ekibine iletilecek: kategori `founder`/`explorer`/`first_batch` veya boş yapılırsa yazma açılır (Match için ayrıca `subscription_status = active` + `onboarding_complete = true`). Denge: `test` kalkınca hesap gerçek üye olur (rehberde görünür, referral gerçek mail atar, match gerçek eşleştirir). Ayarlanınca Auto opt-in vb. gerçek cihazda test edilecek.

**Cevaplananlar:** arayüz dili (→ İngilizce, §4.7) · commit dili (→ İngilizce, §4.8) · web'in 3 profil kolonunu farklı kullanması (→ §4.10) · test hesabı 403 davranışı (→ §4.11)

---

## 7. Oturum Günlüğü

> En yeni kayıt en üstte. **Eskiler asla silinmez.**

### 2026-07-23 — Web'e hizalama (Directory, Match, Discover) + `onurrcelik/Exposure` incelendi

- Kullanıcı web sitesinin kaynak reposuna erişim verdi (`github.com/onurrcelik/Exposure`, private, `git ls-remote` ile doğrulandı). Scratchpad'e klonlandı, `DashboardClient.tsx` (2286 satır) + `proxy.ts` + API route'ları incelendi. Bu, "API.md'ye göre tahmin" aşamasını bitirdi — artık her ekran gerçek web koduna göre hizalanıyor.
- **Directory** yeniden yazıldı (§ Ekran Durumu). Zengin kart: `E{batch}` rozeti, konum pin, meslek, tür rozetleri, eğitim satırı, `✦` favori kaynak, LinkedIn/GitHub. Ayrı **Past Members** bölümü (web gibi, kullanıcı onayladı). **Gerçek bug bulundu ve düzeltildi:** `instagram`/`twitter` sosyal link sanılıp `Linking.openURL`'e veriliyordu — aslında Education/Area of Interest düz metni (§4.10). **Telefonda onaylandı.**
- **Weekly Match** yeniden yazıldı: web'in 5 durumu (round yok / açık+cevapsız / opt-in / opt-out / eşleşmiş-partner / "Missed this round?"+Late opt-in / closed), pending confirmation'da Yes+No, match history, Auto opt-in toggle. **Telefonda onaylandı.**
- **Read-only test hesabı çözüldü** (§4.11). Kullanıcının hesabı `member_category === 'test'` → tüm yazma istekleri 403. `lib/api.ts` + `InfoNotice` banner. Kullanıcı bunun sonra düzeltileceğini söyledi (Açık Soru 6).
- **Discover** 4 bölüm web'e hizalandı: her bölümün başlık/rozet/aksiyonu, Events gerçek alanları (`type`/`images`/`attendees`/`upcoming`), Links arama+tarih aralığı+tip ikonları, Newsletter LATEST+Subscribe (**`publish_date` UNIX saniye bug'ı düzeltildi**), YouTube longForm/shorts ayrı grid. Nav header'ları Directory/Match/Discover için kapatıldı (ekranlar kendi başlığını çiziyor). **Telefonda onaylandı.**
- **Event görsel galerisi** (§4.12): Supabase Storage görselleri render endpoint'iyle optimize + tam ekran kaydırmalı galeri. **Telefonda onaylandı.**
- **Refer a Friend** eklendi (Discover'ın son segment'i). Endpoint yok — `website` kolonuna JSON (§4.10). Segment pill'inde bildirim noktası (2 referral tam ise yeşil, değilse kırmızı — kullanıcı kararı). ProfileScreen'den editlenebilir `website` alanı kaldırıldı (referral'ları silme bug'ı). **Telefonda onaylandı.**
- **Job Board** web modeline çevrildi: tek ekran, satırlar yerinde açılıyor (compose/apply/refer/applicants inline), **sadece `type==='job'`** gösteriliyor (web öyle), compose her zaman `type:'job'`+`tags:[]`. 4 push ekranı (JobDetail/Compose/Applicants/Refer) silindi, `navigation.ts` sadeleşti. `expo-clipboard` eklendi (friend-referral kopyalama). Görsel referans + web repo'suyla hizalandı. **Telefon onayı bekliyor.**
- **Tema sistemi** eklendi (§4.13): Dark/Light/System, varsayılan Dark, Profile > Appearance. Semantik token + `vars()` runtime provider. 272 sınıf otomatik migrate edildi (node script). **Telefon onayı bekliyor.**
- **Sıradaki:** Community Brain "Coming Soon" (§5 tablosu) — plandaki 6. adım, tema araya girdiği için henüz yapılmadı.
- Bu adımlar **commit edilmedi** — kullanıcı toplu commit'i sonraya bıraktı.

### 2026-07-23 — İlk commit push'landı

- Kullanıcı uygulamayı telefonunda Expo Go ile açtı, **çalışıyor** — onay verildi.
- İlk commit atıldı: `51ce49c` — 48 dosya, 13.345 satır. Mesaj İngilizce (§4.8).
- `origin` = `https://github.com/soyleremo3/Exposure-Members-APP.git` eklendi, `git push -u origin main` başarılı. `main` uzak dalı takip ediyor.
- Doğrulandı: `git ls-remote origin` → `refs/heads/main` = `51ce49c`.
- **Sıradaki:** kullanıcı ekranlarda değişiklik/ekleme istiyor. Her değişiklik öncesi bu dosyayı oku, sonrasında bu günlüğe kayıt ekle.

### 2026-07-23 — Kararlar netleşti, repo hazır

- **Arayüz dili İngilizce** olarak karara bağlandı (§4.7). Açık sorulardan çıkarıldı.
- **Commit mesajları İngilizce** kalıcı kural olarak eklendi (§4.8).
- GitHub repo'su `soyleremo3/Exposure-Members-APP` kullanıcı tarafından açıldı. `git ls-remote` ile doğrulandı: erişilebilir, boş (hiç ref yok) — tam olarak push için gereken durum. Credential Manager giriş sormadı.
- Üye alanının web görünümü 375px'te incelenmeye çalışıldı, giriş duvarına takıldı (Açık soru 1). Kullanıcının şifresiyle giriş yapılmadı.

### 2026-07-23 — Proje kurulumu (sıfırdan çalışır uygulamaya)

**Ne yapıldı**

1. **Keşif.** Bilgisayarda iki aday klasör bulundu: `Desktop\Exposure-APP` (repo `soyleremo3/Exposure-APP`, `package.json` adı `exposure_members_mobile`, tam site) ve `Desktop\Exposure APP` (Darkosxl'ın 3 commit'lik starter kit'i). Kullanıcı ilkinden kopyalanmasını onayladı.
2. **SDK kararı.** docs.expo.dev ve Expo changelog doğrulandı: SDK 57 çıkmış ama Expo Go App Store onayı beklemede. SDK 54 seçildi (bkz. 4.1).
3. **İskelet.** `npx create-expo-app@latest --template blank-typescript@sdk-54`, geçici klasöre kurulup köke taşındı (kök boş değildi — talimat .md dosyaları vardı).
4. **NativeWind v4** kuruldu, marka renkleri tanımlandı. `academy-cream` çıkarıldı (AI Academy bu projede yok).
5. **`lib/` katmanı** yazıldı. `toTypeList` eski `DirectoryScreen.tsx:27`'den `lib/format.ts`'e taşındı. `api.ts`'e 20 tipli yardımcı + `readableError` eklendi. Events 401 tuzağına önlem alındı (bkz. 4.4).
6. **11 ekran** yazıldı — Login, Directory, MemberDetail, JobBoard, JobDetail, JobCompose, JobApplicants, JobRefer, Match, Discover, Profile.
7. **Doğrulama:**
   - `npx tsc --noEmit` → **temiz** (20 proje dosyası kontrol edildi, `--listFilesOnly` ile teyit edildi).
   - `npx expo-doctor` → **18/18 geçti**.
   - `npx expo export --platform ios` → **iOS bundle başarıyla üretildi (4.44 MB)**. Bu, tüm import'ların çözüldüğünü, NativeWind'in derlendiğini ve Metro'nun hata vermediğini gösteriyor — cihazda açılmadan önce alınabilecek en güçlü sinyal.
8. **Git:** `git init -b main` yapıldı, 48 dosya stage'lendi. **Commit ATILMADI** — kural gereği kullanıcının Expo Go onayı bekleniyor.

**Yol boyunca çıkan sorunlar**

- `expo-doctor` ilk çalıştırmada 2 hata verdi: `@expo/vector-icons` peer dependency olarak `expo-font` istiyor, ve hoisting yüzünden `expo-font@57.0.1` ile `expo-font@14.0.12` yan yana duruyordu (SDK 54 için yanlış major). `npx expo install expo-font` ikisini de çözdü (SDK'ya uygun sürümü pinledi + dedupe etti). Eski projede de `expo-font` açıkça bağımlılık listesindeydi — aynı sebep.
- Kök klasör boş değildi (4 talimat .md dosyası), `create-expo-app` doğrudan çalıştırılamadı. Geçici alt klasöre kurulup içerik taşındı. `04-API.md` → `API.md`, diğer üçü `docs/` altına alındı.

**Eksik kalanlar**

- **Kullanıcının Expo Go onayı alınmadı** — hiçbir ekran gerçek cihazda görülmedi. İlk commit atılmadan önce bu yapılmalı.
- GitHub repo'su (`Exposure-Members-APP`) henüz açılmadı, `git init` yapılmadı.
- Community Brain yapılmadı (kapsam dışı).
- Açık Sorular bölümündeki 6 madde cevaplanmadı.

---

## 8. Çalışma Disiplini

- Her yeni görevden önce bu dosyayı **baştan sona** oku.
- Web sitesini incelerken **her zaman mobil ekran genişliğinde** (375px gibi) bak.
- Gerçek cihaz/Mac yok — **hiçbir değişiklik, kullanıcı kendi telefonunda Expo Go ile görüp onaylamadan commit edilmez.**
- Her görev bitince bu dosyanın **Oturum Günlüğü**'ne yeni kayıt ekle (ne yapıldı / neden böyle / eksik ne kaldı). Eskiler silinmez, üstüne eklenir.
- Yeni bir mimari karar alınırsa hem günlüğe hem **Alınmış Kararlar** bölümüne yazılır.

### Doğrulama komutları

```bash
npm run typecheck
```
```bash
npm run doctor
```
```bash
npx expo start
```
