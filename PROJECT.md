# PROJECT.md — Exposure Member Access

> Bu dosya projenin hafızasıdır. **Her yeni göreve başlamadan önce baştan sona oku.**
> `API.md` backend'in tek doğru kaynağıdır — veri şekliyle ilgili her soruda önce oraya bak.

---

## 1. Proje Özeti

- **Exposure**: Türkiye'deki AI/startup kurucuları için başvuruyla kabul edilen üyelik topluluğu. Web: https://exposureai.org
- Bu proje, web sitesinin **sadece giriş yapmış üyelerin gördüğü bölümünü** iOS uygulamasına çeviriyor. Sonra Android.
- Geliştirme Windows'ta, Mac yok. Apple Developer hesabı **henüz açılmadı** — test **Expo Go** ile telefonda yapılıyor.

### Kapsam — dışına çıkma

**Var:** Giriş (email → kod) · Başvuru formu (Apply, giriş gerektirmez) · Üye Rehberi · İş İlanları · Haftalık Eşleştirme · Etkinlikler · Topluluk içeriği (linkler / haber bülteni / YouTube) · Profil

**Yok:** Herkese açık pazarlama sayfaları (ana sayfa, AI Academy).

> **2026-07-24 kapsam güncellemesi:** "Exposure Members Mobile" (repo: `soyleremo3/Exposure-APP`, webview tabanlı) kullanıcı tarafından **tamamen iptal edildi**. Bu proje artık tek aktif proje. Apply ekranı bu yüzden native olarak buraya taşındı — eskiden "Yok" listesindeydi, artık "Var". Ana sayfa ve AI Academy gibi diğer herkese açık sayfalar **hâlâ kapsam dışı**, iptal edilen projenin kapsamına girmiyorlardı zaten, ayrı bir kararla eklenmedikçe yapılmayacaklar.

**Kapsam dışı bırakılan:** Community Brain (AI arama). SSE gerektiriyor (`react-native-sse`), kurulum kapsamında değildi. İstenirse ayrı görev olarak eklenir.

---

## 2. Mimari

```
App.tsx ── session ? Stack(Tabs + push ekranları) : PreAuthStack(Login + Apply)
   │
   ├─ booting state: kayıtlı oturum okunana kadar boş cream ekran (tam splash YOK)
   └─ supabase.auth.onAuthStateChange → session state → ağaç otomatik değişir

PreAuthStack (session yokken, 2026-07-24 eklendi)
├─ Login    Giriş           → Apply (push, "Not a member? Apply to join" linki)
└─ Apply    Başvuru formu   → geri: native-stack başlığındaki geri oku

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
| `lib/theme.tsx` | Renkler, `ThemeProvider`/`useTheme`/`useThemeColors` — bkz. §4.13 |
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

### 4.13 Tema sistemi: Dark/Light/System, varsayılan Dark — **eklendi (2026-07-23), mekanizma değişti (2026-07-24)**

Web'de yok, kullanıcı isteğiyle eklendi: uygulama ilk açılışta **koyu**, ama üye Profile > Appearance'tan Dark/Light/System arası geçebiliyor, tercih kalıcı (AsyncStorage).

**2026-07-23 mekanizması çalışmıyordu — kök neden bulundu (2026-07-24):** Pill seçili göründüğü halde (kendi local state'i güncelleniyordu) arka plan hiç değişmiyordu. İki ayrı sorun tespit edildi:

1. **`app.json` → `userInterfaceStyle: "light"`.** Uygulamanın native kabuğu ışığa kilitliydi. NativeWind'in kendi dokümanı (nativewind.dev) manuel tema geçişi için bunun `"automatic"` olması gerektiğini açıkça söylüyor. `"automatic"` yapıldı. (Bu alan sadece gerçek native build'de — EAS/dev client — derlenip Info.plist/manifest'e gömülüyor; Expo Go kendi önceden derlenmiş kabuğunu kullandığı için bu tek başına Expo Go'daki testi düzeltmiyordu — madde 2 asıl sebepti.)
2. **Asıl sebep: NativeWind'in `useColorScheme()`/`colorScheme.set()` API'si.** ctx7 ile NativeWind dokümantasyonu kontrol edildi: bu API resmi olarak **deprecated**, yerine react-native'in kendi `useColorScheme()`'i öneriliyor. Kaynağa inildi (`node_modules/react-native-css-interop`): `colorScheme.set()` React Native'in `Appearance.setColorScheme()` native metoduna gidiyor, ve bu override'ın gerçekten uygulanıp bir `appearanceChanged` event'i tetikleyip tetiklemediği native tarafın implementasyonuna bağlı — Expo Go'da (özel dev client yok, bkz. §4.1) bunun güvenilir çalıştığı doğrulanamadı. Zaten §5 tablosunda bu özelliğin "telefon onayı bekliyor" durumda kaldığı, hiç cihazda görülmediği not düşülmüştü — muhtemelen baştan beri çalışmıyordu.

**Yeni mekanizma:** NativeWind'in colorScheme/`.dark` class sistemine artık hiç dokunulmuyor. Tema tamamen kendi React state'imizle sürülüyor:

- **`lib/theme.tsx`** (`lib/theme.ts` idi, `ThemeProvider` JSX içerdiği için `.tsx`'e taşındı) → `ThemeProvider` + `useTheme()`: `ThemePref` (`light`/`dark`/`system`) kendi `useState`'inde tutuluyor, ilk değer senkron `'dark'` (AsyncStorage'ı beklemeden — açılışta flaş yok). `pref === 'system'` ise react-native'in **kendi** (nativewind'in değil) `useColorScheme()`'i ile OS temasına bakılıyor. `setPref()` hem state'i günceller hem `saveThemePref()` ile kalıcı yazar.
- **`useThemeColors()`** artık bu Context'ten okuyor (`isDark` → `LIGHT`/`DARK` renk objesi), nativewind'e bağımlı değil.
- **`vars()` provider korundu** — bu kısım zaten doğruydu (nativewind.dev'in resmi "multi-theme" örneğiyle birebir aynı desen). `App.tsx` kökünde `<View style={c.isDark ? DARK_VARS : LIGHT_VARS}>` hâlâ semantik token'ları (`bg-background`, `surface`, `chip`, `hairline`, `body`, `muted`, `faint`, `accent-link`) besliyor. Fark: bu değer artık nativewind'in `colorScheme.get()`'inden değil, kendi Context'imizden geliyor.
- **`App.tsx` yapısı değişti:** `App()` sadece `<ThemeProvider><AppShell /></ThemeProvider>` döndürüyor; asıl içerik (`useThemeColors()` çağıran, navigator kuran her şey) `AppShell`'e taşındı — bir component kendi sardığı Provider'ı okuyamadığı için ayrıldı. Modül seviyesindeki `colorScheme.set('dark')` çağrısı kaldırıldı (artık gereksiz — `ThemeProvider`'ın ilk state'i zaten senkron `dark`).
- **`global.css`** tek `:root` bloğuna (koyu değerler) geri döndü, `.dark {}` bloğu kaldırıldı — hiçbir kod artık o class'ı tetiklemiyor, iki mekanizma yerine tek mekanizma (vars provider) kaldı.
- **`dark:` varyant istisnaları da düzeltildi:** `ErrorNotice` (Feedback.tsx) ve Profile'daki "Sign out" metni `dark:bg-red-500/10` gibi Tailwind varyantı kullanıyordu — bu da nativewind'in class-toggle'ına bağımlıydı, o artık hiç tetiklenmiyor. İkisi de `useThemeColors().isDark`'a göre className seçen koşullu ifadeye çevrildi.
- **Class alamayan yerler** (`ActivityIndicator color`, `RefreshControl tintColor`, navigator `screenOptions`, `StatusBar`, NavigationContainer theme): değişmedi, hâlâ `useThemeColors()`'tan okuyor.
- **`tailwind.config.js`**: `darkMode: 'class'` bırakıldı (zararsız, `dark:` kullanılmadığı sürece etkisiz) ama yorumu güncellendi — artık aktif mekanizma değil.
- **Not:** exposureai.org sadece koyu; bu bilinçli bir "web'den sapma" (kullanıcı onayı ile). `brand-blue`/`brand-cream` tema-değişmez (buton dolgu + üstündeki metin).
- **Doğrulama:** `tsc --noEmit` temiz, `expo-doctor` 18/18, `expo export --platform ios` bundle hatasız (1339 modül). **Cihazda henüz görülmedi** — üç seçeneğin de (Light/Dark/System) gerçekten çalıştığı kullanıcı tarafından Expo Go'da teyit edilmeli.
- **Android notu:** Expo dokümanı `userInterfaceStyle` desteği için Android'de `expo-system-ui` paketinin (development build'de) gerekli olduğunu söylüyor. Şu an kurulmadı — proje henüz Android'e geçmedi (§1), o zaman değerlendirilecek.

### 4.12 Event görselleri: Supabase render + galeri — **eklendi (2026-07-23)**

Event fotoları Supabase Storage `events` bucket'ında public URL (admin upload, max 10 MB). Web `EventImageGrid` sadece ilk fotoyu + sağ altta sayı rozetini gösteriyor, tıklayınca lightbox. Bizde:
- `lib/images.ts` → `resizedImage()`: public URL'i render endpoint'ine çevirip (`object/public` → `render/image/public`) `width/quality/resize` ekliyor. 10 MB orijinal yerine küçük WEBP.
- Image-transform ücretli özellik; kapalıysa render URL 400 döner → `expo-image` `onError` ile orijinale düşülüyor (`RemoteImage` bileşeni). Yani her durumda çalışır.
- Kart 800px, tam ekran galeri 1080px ister. `cachePolicy="memory-disk"` ile tekrar indirme yok.
- `lib/format.ts` → `toImageList()`: `images` dizi/JSON-string/virgüllü-string hepsini karşılıyor (bu backend'in liste alanı huyu — bkz. §4.3).
- Tam ekran kaydırmalı galeri (Modal + paging FlatList) web'in lightbox'ının mobil karşılığı.

### 4.14 Apply ekranı native olarak eklendi — **2026-07-24**

Kapsam güncellemesi (§1): iptal edilen `Exposure-APP` (webview) projesinde duran Apply
başvuru formu bu projeye **native** (WebView değil) olarak taşındı.

**Gerçek veri `onurrcelik/Exposure` reposundan doğrulandı** (`app/(main)/apply/page.tsx`
+ `app/api/applications/route.ts` + `app/lib/request-security.ts`), ekran görüntüsünden
tahmin edilmedi. Bulgular API.md'nin yeni "Apply (public, no auth)" bölümünde tam.
Özet:

- Form ekran görüntüsünde görünenden **çok daha geniş**: 5 essay sorusu (motivasyon +
  4 tanesi) ve opsiyonel bir "referral" alanı var, sadece Full Name/Email/Phone/
  Location/Age/Occupation/Company Link/LinkedIn/GitHub değil.
- Endpoint `POST /api/applications` (tahmin edilen `/api/apply` değil), `multipart/
  form-data` body (JSON değil), auth header'sız, 201'de `{ message }` dönüyor.
- **Gerçek tuhaflık, kullanıcı onayı gerekmeden birebir yansıtıldı:** web'in `<input>`
  alanı `phone`'u `required` işaretliyor ama **server hiç kontrol etmiyor** —
  `route.ts`'teki zorunlu-alan listesinde `phone` yok. App de web'in davranışını
  taklit ediyor (client-side required bırakıldı), backend kuralını "düzeltmedi".
- GitHub alanı gerçekten "no"/"none"/"n/a"/"na" (case-insensitive) kabul ediyor —
  placeholder'daki ipucu doğru çıktı, backend'de birebir doğrulandı.
- Başarı davranışı: **ayrı bir teşekkür ekranı YOK.** Web formu temizliyor ve aynı
  sayfada yeşil bir satır içi mesaj gösteriyor ("Application received!..."). App aynısını
  yapıyor — navigasyon yok, sadece form reset + satır içi başarı bildirimi.

**Navigasyon:** `App.tsx`'teki `session ? <Stack/> : <LoginScreen/>` dalı
`session ? <Stack/> : <PreAuthStack/>` oldu. `PreAuthStack` (`navigation.ts`'te yeni
`PreAuthStackParamList`) iki ekran: `Login` (headerShown:false, eski görünüm korunuyor)
ve `Apply` (native-stack başlığı "Apply to Join", geri oku otomatik gelir).
`LoginScreen`'e web'deki birebir metinle ("Not a member? **Apply to join**") bir link
eklendi — sadece email adımında görünüyor (web'de de `sent` olmadan önce görünüyor).

**Yeni API katmanı:** `lib/api.ts` → `submitApplication()`. `apiFetch`/`apiJson`
kullanmıyor — `POST /api/members/auth`'un `LoginScreen.tsx`'teki çıplak `fetch` deseniyle
aynı gerekçe: oturum yok, atılacak token yok, `apiFetch`'in 401→signOut mantığı
giriş yapmamış birine uygulanamaz. `uploadAvatar()`'daki gibi `Content-Type` elle
ayarlanmıyor (multipart boundary fetch'e bırakılıyor). Var olan authlu fonksiyonlara
dokunulmadı.

**Validasyon:** İstemci tarafı kontroller `onurrcelik/Exposure`'daki gerçek server
kurallarının birebir kopyası (uzunluk limitleri, yaş 16–99, URL kontrolü, GitHub "no"
istisnası) — API.md'deki tabloyla senkron. Son söz her zaman backend'de; istemci
kontrolleri sadece hızlı geri bildirim için.

**Tema:** `ApplyScreen` diğer tüm ekranlar gibi `useThemeColors()` kullanıyor,
Dark/Light/System sistemine dokunulmadı (§4.13).

**Doğrulama:** `tsc --noEmit` temiz, `expo-doctor` 18/18, `expo export --platform ios`
hatasız. **Cihazda henüz görülmedi** — kullanıcının Expo Go'da Login ekranındaki
"Apply to join" linkini deneyip gerçek bir test başvurusuyla formu göndermesi
gerekiyor.

### 4.15 Profile'daki `auto_opt_in` + job-board bildirim kopyaları kaldırıldı — **2026-07-24**

Ekran kaydı videosuyla Profile'daki üç anahtarın (Weekly Match "Join every week
automatically", Job Board Emails "New job posts"/"New help requests") tuhaf
davrandığı fark edildi. Önceki (sadece tespit) görev şunu doğrulamıştı:

1. **`auto_opt_in`** iki bağımsız kopyaya sahipti: `MatchScreen.tsx` anlık
   yazıyordu (`toggleAuto` → `updateProfile`, doğru), `ProfileScreen.tsx`ki
   kopya ise sadece local state tutuyordu — sunucuya ancak "Save changes"
   basılınca, diğer tüm profil alanlarıyla paketlenip gidiyordu, VE ekran
   mount olduğunda (`useEffect`, `useFocusEffect` değil) tek seferlik çektiği
   bayat değeri kullanıyordu. Sonuç: kullanıcı Match'te anahtarı açar,
   Profile'a geçer (zaten mount'lu, hafızada eski değer), başka bir alanı
   değiştirip Save'e basarsa, Profile'ın bayat `auto_opt_in`'i sessizce geri
   yazılıp Match'teki değişikliği ezerdi. **Sessiz veri kaybı, hiçbir uyarı
   yok.**
2. **Job-board bildirimleri** (`notify_jobs`/`notify_needs`) de iki bağımsız
   kopyaya sahipti (`JobBoardScreen.tsx`'teki `NotifyCard` + `ProfileScreen.tsx`),
   ikisi de aynı optimistic-set → PATCH/PUT → hata olursa geri al deseni.
   Video'daki "titreme" bunun sonucuydu — kullanıcının hesabı
   `member_category: 'test'` (salt-okunur, §4.11), her yazma 403 dönüyor,
   anahtar anlık açılıp sonra eski haline fırlıyordu. İki kopya olması
   titremenin sebebi değildi, aynı hatayı iki yerde tekrarlıyordu sadece.

**Karar (kullanıcı onayladı):** Match ekranı `auto_opt_in`'in, Job Board ekranı
da bildirim tercihlerinin **tek sahibi**. Profile'daki iki kopya tamamen
kaldırıldı — koşullu gizleme değil, tam silme:

- `ProfileScreen.tsx`: "Weekly match" bölümü + `autoOptIn` state + `save()`
  payload'ından `auto_opt_in` alanı kaldırıldı.
- `ProfileScreen.tsx`: "Job board emails" bölümü + `notify` state +
  `toggleNotify()` + `load()` içindeki `getJobNotifications()` çağrısı
  kaldırıldı.
- Artık kullanılmayan `Row` bileşeni (sadece bu iki anahtar için vardı) ve
  `Switch`/`getJobNotifications`/`updateJobNotifications`/
  `JobNotificationSettings` import'ları temizlendi.
- Silme sonrası düzen kontrol edildi: Membership kartı doğrudan Sign out'a
  bağlanıyor, yetim başlık/margin kalmadı.

**`JobBoardScreen.tsx`'teki `NotifyCard` incelendi:** 403'te (revert-on-catch)
kullanıcıya görünür hata mesajı **gösterilmiyordu** — sessizce eski değere
dönüyordu (kod içinde bunu itiraf eden bir yorum vardı: *"no inline error
slot here — the reverted switch is the signal"*). Uygulama genelinde diğer
yazma hatalarında kullanılan standart `readableError`/`ErrorNotice` deseniyle
küçük bir hata şeridi eklendi (kartın üstünde, diğer ekranlardaki
`ErrorNotice` kullanımıyla aynı konvansiyon) — özel/gizli bir mantık değil.

**Doğrulama:** `tsc --noEmit` temiz, `expo-doctor` 18/18. **Cihazda henüz
görülmedi** — kullanıcının Expo Go'da Match/Job Board'un tek sahip davrandığını
ve Profile'da bu üç anahtarın artık hiç görünmediğini onaylaması gerekiyor.

### 4.11 Test hesapları salt-okunur (403) — backend davranışı sabit, client özel işleme **kaldırıldı (2026-07-24)**

Backend (`proxy.ts:175-179`) `member_category === 'test'` olan hesapları GET-only yapıyor: `/api/members/*`'a **her GET olmayan istek 403 `{ error: "Test accounts are read-only" }`** dönüyor. Bunlar mobil test hesapları (kullanıcının `varrochannel@gmail.com` hesabı dahil) — bilinçli davranış, bug değil. Bu backend kuralı **hâlâ geçerli**, değişen sadece uygulamanın buna nasıl tepki verdiği.

**Önceki durum (2026-07-23, artık geçerli değil):** `lib/api.ts` → `ApiError.readOnly` + `isReadOnlyError(e)` + `READ_ONLY_NOTICE` sabiti + `components/Feedback.tsx` → `InfoNotice` bileşeni. Yazma yapan her ekran (`ProfileScreen`, `MatchScreen`, `DiscoverScreen`'in Refer a Friend'i, `JobBoardScreen`) `member_category === 'test'` ise üstte nötr banner gösteriyor, mutation'daki 403'ü kırmızı `ErrorNotice` yerine sessizce yutuyordu.

**Yeni durum (2026-07-24, kullanıcı kararı):** Banner ve arkasındaki tüm özel mantık tamamen kaldırıldı — koşullu gizleme değil, tam silme. `ApiError.readOnly`, `isReadOnlyError`, `READ_ONLY_NOTICE`, `InfoNotice` ve dört ekrandaki `readOnly` state/prop'ları silindi. Sonuç: bir test hesabı yazma denediğinde artık **hiçbir özel davranış yok** — 403 normal `readableError`/`ErrorNotice` yoluyla kırmızı hata şeridi olarak görünüyor, mesaj backend'in kendi metni ("Test accounts are read-only"). Diğer her API hatasıyla aynı yol.

### 4.16 Membership gate + yerel match bildirimleri + push kaydı + EAS — **eklendi (2026-08-20), sibling repodan taşındı**

Bir önceki oturumda bu iş yanlışlıkla kardeş klasörde (`Exposure-APP/`) yapılmıştı — ayrı, ilgisiz git geçmişi olan eski proje. Bu repo asıl/tek yayınlanacak uygulama olduğu için aynı özellikler buraya **birebir kopya değil, bu projenin mimarisine uyarlanarak** taşındı:

- **`lib/membership.ts`** — `checkAccess()`: `GET /api/members/profile` çağırır, `subscription_status === 'active' && onboarding_complete === true` değilse `'denied'`. Ağ hatasında `'unknown'` döner ve **fail-open** — gerçek bir üyeyi tünelde kaldığı için kilitlememek `'ok'` ile aynı muamele görür.
- **`App.tsx`** → `AppShell`: `session` state'inin yanına ikinci bir state (`access`) eklendi — dosyanın kendi "tek state her şeyi sürer" deseni korunarak. `session` var ama `access === 'denied'` ise `NoAccessScreen` gösteriliyor, `navigationRef`/`.reset()` yok (eski projenin Home/Portal ayrımı bu projede hiç yok).
- **`screens/NoAccessScreen.tsx`** — sıfır ödeme/fiyat sinyali (§3 kuralı). "Use a different email" sadece `supabase.auth.signOut()` çağırıyor; `AppShell`'in mevcut `onAuthStateChange` dinleyicisi zaten `session`'ı null'a çekip ağacı Login'e döndürüyor.
- **`lib/matchNotify.ts`** — haftalık 1:1 için **yerel** (push değil) bildirimler: eşleştin (anında, round başına bir kere), opt-in bekliyor (+24s), buluştun mu onayı (+24s). `GET /api/members/match` zaten var olan `getMatch()`/`MatchData` tipini kullanıyor, yeni tip eklenmedi. `Tabs()` mount olduğunda ve her foreground'da senkronize ediliyor.
- **`lib/push.ts`** + `lib/api.ts` → `registerPushToken()` — cihaz Expo push token'ını `POST /api/members/push-token`'a kaydediyor (bkz. API.md). `app.json`'da `extra.eas.projectId` yokken sessizce çıkıyor; local bildirimler bundan etkilenmiyor.
- **`app.json`** — `extra.eas.projectId: "882a7083-d48f-4c9d-9cb5-0d6c8763e2e5"`, `owner: "darkosxl"` eklendi. Bu, Exposure-APP'te `eas init` ile zaten bağlanmış proje — Exposure-APP App Store'a çıkmayacağı için buraya taşındı (§6 madde 2 çözüldü).
- **`eas.json`** — yeni dosya, build profilleri (`development`/`preview`/`production`) + `appVersionSource: "remote"`.
- **Yeni bağımlılıklar:** `expo-notifications`, `expo-constants`. `npx expo install` ilk denemede SDK 57 sürümlerini çekti (Exposure-APP'in commit geçmişindeki aynı tuzak, bkz. §4.1) — elle `~0.32.17` / `~18.0.14`'e (SDK 54 hattı) düzeltildi.
- **API.md** — `POST /api/members/push-token` eklendi (istek şekli biliniyor, response şekli doğrulanmadı — client zaten okumuyor).

**Doğrulama:** `tsc --noEmit` temiz. **Cihazda henüz görülmedi** — aktif üye hesabıyla girişte Tabs'a düz geçiş, (varsa) pasif/olmayan hesapla `NoAccessScreen`, bildirim izni istemi ve zamanlanmış hatırlatmalar kullanıcının kendi telefonunda onaylanmalı.

---

## 5. Ekran Durumu

| Ekran | Dosya | Durum | Endpoint |
|---|---|---|---|
| Giriş | `screens/LoginScreen.tsx` | Kod yazıldı, "Apply to join" linki eklendi (2026-07-24), telefon onayı bekliyor | `POST /api/members/auth` + Supabase `verifyOtp` |
| Başvuru (Apply) | `screens/ApplyScreen.tsx` | **Eklendi (2026-07-24), gerçek backend kurallarına göre yazıldı, telefon onayı bekliyor** | `POST /api/applications` (auth yok) |
| Üye Rehberi | `screens/DirectoryScreen.tsx` | **Web'e hizalandı, telefonda onaylandı (2026-07-23)** | `GET /directory` |
| Üye Detayı | `screens/MemberDetailScreen.tsx` | **Web'e hizalandı, telefonda onaylandı (2026-07-23)** | — (route param) |
| İş İlanları (tek ekran) | `screens/jobs/JobBoardScreen.tsx` | **Web modeline çevrildi (inline aç/başvur/öner/başvuranlar), job-board bildirimlerinin tek sahibi — doğrulandı (2026-07-24, §4.15), 403'te artık görünür hata var, telefon onayı bekliyor** | `GET`/`POST`/`PATCH`/`DELETE /job-board(/[id])`, `.../apply`, `.../refer`, `.../applications`, notifications |
| Haftalık Eşleştirme | `screens/MatchScreen.tsx` | **Web'e hizalandı (tüm durumlar), `auto_opt_in`'in tek sahibi — doğrulandı (2026-07-24, §4.15), telefon onayı bekliyor** | `GET`/`POST /match`, `GET`/`PATCH /profile` |
| Keşfet (Events/Links/Newsletter/YouTube) | `screens/DiscoverScreen.tsx` | **Web'e hizalandı + event görsel galerisi, telefonda onaylandı (2026-07-23)** | `GET /events`, `/links`, `/newsletter`, `/youtube` |
| Keşfet → Refer a Friend | `screens/DiscoverScreen.tsx` | **Eklendi + nokta, telefonda onaylandı (2026-07-23)** | `GET`/`PATCH /profile` (`website` alanı) |
| Profil | `screens/ProfileScreen.tsx` | **Web'in 3 kartlı düzenine hizalandı (Account/Edit Profile/Membership); `auto_opt_in` ve job-board bildirim kopyaları kaldırıldı (2026-07-24, §4.15) — artık Match/Job Board'un tekelinde, telefon onayı bekliyor** | `GET`/`PATCH /profile`, `POST /upload-avatar` |
| Global tema (Dark/Light/System) | `lib/theme.tsx`, `global.css`, `tailwind.config.js`, `App.tsx` | **Kuruldu (varsayılan Dark), 2026-07-24 kök neden bulunup düzeltildi (bkz. §4.13), telefon onayı bekliyor** | — |
| Keşfet → Community Brain | — | **Yapılmadı** (sıradaki adım — "Coming Soon", allowlist'te değiliz) | `/community-graph`, `/brain-query*` |

> **"Telefon onayı bekliyor"** = kod yazıldı, `tsc` ve `expo-doctor` temiz, ama kullanıcı kendi telefonunda Expo Go ile görüp onaylamadı. Onaylanmadan "bitti" sayılmaz.

---

## 6. Açık Sorular

1. **Tasarım referansı yok — devam ediyor.** `https://exposureai.org/members/dashboard?section=directory` 375px'te denendi (2026-07-23): giriş olmadığı için `exposureai.org` login sayfasına yönlendiriyor. Üye alanı kapalı, kullanıcının şifresiyle giriş yapılmayacak. Job Board / Match / Discover ekranları `API.md`'deki veri şekline göre tasarlandı.
   **Çözüm yolu:** kullanıcı kendi tarayıcısından giriş yapıp 375px genişlikte ekran görüntüsü verir, ekranlar birebir eşleştirilir. (Siteye bakarken **her zaman mobil genişlikte** bak — masaüstü görünümü farklı davranıyor.)
2. ~~**`bundleIdentifier` çakışması.**~~ **Çözüldü (2026-08-20).** `Exposure-APP` App Store'a çıkmayacak — tek proje bu repo. `org.exposureai.members` + Exposure-APP'te zaten `eas init` ile bağlanmış EAS `projectId` (`882a7083-d48f-4c9d-9cb5-0d6c8763e2e5`, owner `darkosxl`) bu repoya taşındı, çakışma artık yok.
3. **`GET /api/members/events` gerçekten 401 mi dönüyor** abonelik pasifken? API.md öyle diyor, kodda ona göre önlem alındı ama gerçek bir pasif hesapla test edilmedi.
4. **Avatar yükleme** (`POST /upload-avatar`) gerçek bir dosyayla test edilmedi. `multipart/form-data`, alan adı `file`, max 5 MB, JPG/PNG/WEBP.
5. **`share_token`** alanı `JobPost` tipinde var ama hiçbir yerde kullanılmıyor. İlan paylaşma özelliği istenirse buradan devam edilir.
6. **Test hesabı `member_category`'si — sonra kesin halledilecek (kullanıcı 2026-07-23).** `varrochannel@gmail.com` `test` kategorisinde, yazma yapamıyor (§4.11). Web ekibine iletilecek: kategori `founder`/`explorer`/`first_batch` veya boş yapılırsa yazma açılır (Match için ayrıca `subscription_status = active` + `onboarding_complete = true`). Denge: `test` kalkınca hesap gerçek üye olur (rehberde görünür, referral gerçek mail atar, match gerçek eşleştirir). Ayarlanınca Auto opt-in vb. gerçek cihazda test edilecek.
7. ~~**Planlanan push notification akışı — kapsam dışı, ayrı görev (not düşüldü 2026-07-24).**~~ **Yerel bildirim kısmı eklendi (2026-08-20), sunucu tarafı admin-tetikli push hâlâ ayrı görev.** Bkz. §4.16: haftalık maç hatırlatmaları artık cihazda yerel bildirim olarak planlanıyor (opt-in bekleniyor / eşleştin / buluştun mu onayı). Kullanıcının orijinal planındaki (a) Pazar 12:00 toplu "opt-in ol" push'ı ve (b) admin portalından manuel tetiklenen "eşleştin" push'ı — ikisi de backend/admin tarafı gerektiriyor, bu görevin kapsamında değil, hâlâ ayrı iş.

**Cevaplananlar:** arayüz dili (→ İngilizce, §4.7) · commit dili (→ İngilizce, §4.8) · web'in 3 profil kolonunu farklı kullanması (→ §4.10) · test hesabı 403 davranışı (→ §4.11)

---

## 7. Oturum Günlüğü

> En yeni kayıt en üstte. **Eskiler asla silinmez.**

### 2026-08-20 — Membership gate + yerel match bildirimleri + push kaydı + EAS, `Exposure-APP`'ten taşındı

Kullanıcı önceki oturumun yanlış klasörde (`Exposure-APP/`, ilgisiz git geçmişli ayrı bir proje) yapıldığını fark etti — bu repo asıl/tek App Store adayı. İş buraya taşındı, ama birebir kopya değil: bu projenin mimarisine (session-driven tek state `AppShell`, native 5 sekme, `lib/theme.tsx`) uyarlandı. Detay: §4.16. Açık sorular §6 madde 2 (bundleIdentifier çakışması) ve madde 7'nin yerel-bildirim kısmı çözüldü; madde 7'nin backend/admin-tetikli push kısmı hâlâ ayrı görev.

Kullanıcıdan iki karar alındı: (1) EAS projesini `Exposure-APP`'ten aynen taşı — o proje yayınlanmayacak; (2) `/api/members/push-token` backend endpoint'i gerçekten var, doğrulama beklemeden `lib/push.ts` taşındı.

**Doğrulama:** `tsc --noEmit` temiz. **Cihazda henüz görülmedi** — kullanıcının Expo Go'da onayı bekleniyor (bkz. §4.16).

### 2026-07-24 — Profile'daki `auto_opt_in` + job-board bildirim kopyaları kaldırıldı

Yeni session. Kullanıcı bir ekran kaydı videosuyla Profile'daki üç anahtarın
(Weekly Match "Join every week automatically" + Job Board Emails "New job
posts"/"New help requests") tuhaf davrandığını gösterdi. Önceki (kod
değişikliği yapmayan, sadece tespit eden) bir görevde kök neden zaten
bulunmuştu: `auto_opt_in` ve job-board bildirimlerinin her ikisinin de
Profile'da MatchScreen/JobBoardScreen'den bağımsız ikinci bir kopyası vardı —
`auto_opt_in` kopyası bayat state + büyük Save butonuyla sessiz stale-overwrite
riski taşıyordu, bildirim kopyası ise video'daki titremeyi açıklayan asıl
sebep değil (o kullanıcının `member_category: 'test'` hesabının her yazmada
403 alması), sadece aynı hatayı ikinci kez tekrarlıyordu. Tam analiz §4.15'te.

**Ne yapıldı:**

1. `ProfileScreen.tsx`'ten `auto_opt_in` kopyası tamamen kaldırıldı: "Weekly
   match" bölümü, `autoOptIn` state, `save()`'in gönderdiği payload'daki
   `auto_opt_in` alanı.
2. `ProfileScreen.tsx`'ten job-board bildirim kopyası tamamen kaldırıldı:
   "Job board emails" bölümü, `notify` state, `toggleNotify()`,
   `load()` içindeki `getJobNotifications()` çağrısı.
3. Artık kullanılmayan `Row` bileşeni (sadece bu iki anahtar için vardı) ve
   `Switch`/`getJobNotifications`/`updateJobNotifications`/
   `JobNotificationSettings` import'ları temizlendi. Silme sonrası düzen
   kontrol edildi — Membership kartı doğrudan Sign out'a bağlanıyor, yetim
   başlık/margin yok.
4. `JobBoardScreen.tsx`'teki `NotifyCard`'ın catch bloğu incelendi: 403'te
   sessizce eski değere dönüyordu, kullanıcıya görünür hata yoktu (kod
   bunu itiraf eden bir yorumla işaretliydi). Uygulama genelinde diğer yazma
   hatalarında kullanılan standart `readableError`/`ErrorNotice` deseniyle
   küçük bir hata şeridi eklendi.
5. PROJECT.md §4 (4.14 yeni madde), §5 (Profile/Match/Job Board satırları),
   §6 (yeni açık soru: planlanan push notification akışı, kapsam dışı)
   güncellendi.

**Doğrulama:** `tsc --noEmit` temiz, `expo-doctor` 18/18. Emülatör/build
gerektiren bir şey yapılmadı. **Cihazda henüz görülmedi** — kullanıcının Expo
Go'da Match/Job Board ekranlarının tek sahip davrandığını, Profile'da bu üç
anahtarın artık hiç görünmediğini, ve test hesabıyla bir bildirim anahtarına
dokununca artık kırmızı bir hata şeridi çıktığını onaylaması gerekiyor. Commit
**atılmadı** (§8).

### 2026-07-24 — Apply (başvuru) ekranı native olarak eklendi, kapsam güncellendi

Yeni session. Kullanıcı kararı: "Exposure Members Mobile" (webview tabanlı, repo
`soyleremo3/Exposure-APP`) projesi **tamamen iptal edildi**, bu proje artık tek aktif
proje. Bu yüzden Apply formu WebView değil **native** olarak buraya taşındı. §1 ve §4
(4.14) buna göre güncellendi.

**Ne yapıldı:**

1. `onurrcelik/Exposure` reposu scratchpad'e tekrar klonlandı, gerçek Apply component'i
   (`app/(main)/apply/page.tsx`) ve API route'u (`app/api/applications/route.ts` +
   `app/lib/request-security.ts`) okundu — hiçbir alan/kural tahmin edilmedi. Bulgular
   API.md'nin yeni "Apply (public, no auth)" bölümüne yazıldı. Web sitesi 375px'te ayrıca
   kontrol edilmedi çünkü gerçek component kodu zaten tam veri şeklini veriyordu (kod,
   ekran görüntüsünden daha güvenilir kaynak); component'in kendisi zaten responsive
   tek-sütun/iki-sütun grid'ler kullanıyor, mobilde farklı bir alan sırası yok.
2. Gerçek bulgular ekran görüntüsündekinden geniş çıktı: 5 essay sorusu + opsiyonel
   referral alanı var, endpoint `/api/applications` (tahmin `/api/apply` değil),
   `multipart/form-data`, `phone` UI'da zorunlu görünse de **server hiç kontrol
   etmiyor** (birebir yansıtıldı, düzeltilmedi), GitHub "no" istisnası doğrulandı.
   Detay §4.14.
3. `navigation.ts`'e `PreAuthStackParamList` (`Login`, `Apply`) eklendi. `App.tsx`
   `session ? <Stack/> : <LoginScreen/>` yerine `session ? <Stack/> : <PreAuthStack/>`
   oldu — `Login` header'sız (eski görünüm korunuyor), `Apply` "Apply to Join" başlıklı
   native-stack ekranı (geri oku otomatik).
4. `LoginScreen.tsx`'e web'deki birebir metinle "Not a member? **Apply to join**" linki
   eklendi (sadece email adımında, web'in `!sent` davranışıyla aynı).
5. `types.ts`'e `ApplicationDraft`, `lib/api.ts`'e `submitApplication()` eklendi —
   `apiFetch`/`apiJson` kullanmıyor (auth yok, `LoginScreen`'in çıplak `fetch`
   deseniyle aynı gerekçe), `uploadAvatar()`'daki gibi `Content-Type` elle
   ayarlanmıyor. Var olan hiçbir authlu fonksiyon değişmedi.
6. `screens/ApplyScreen.tsx` yeni yazıldı: 14 alan + memberTypes çoklu-seçim (chip,
   `ProfileScreen`'in Background chip deseniyle aynı ama üst sınır yok), essay
   alanlarında "142/500" karakter sayacı (web'in `TextareaField`'ıyla aynı eşik
   mantığı: %90'da amber, limitte kırmızı), istemci validasyonu gerçek backend
   kurallarının birebir kopyası. Başarıda web gibi form temizleniyor + satır içi yeşil
   mesaj gösteriliyor (ayrı bir teşekkür ekranı yok). Hata `readableError` ile satır içi
   kırmızı `Notice` (yeni, yerel, tek kullanımlık — `ErrorNotice`'ın kendisi değil çünkü
   başarı varyantı da gerekiyordu; §4.11'de kaldırılan `InfoNotice` mekanizmasıyla
   ilgisi yok). Tema: diğer ekranlar gibi `useThemeColors()`.
7. API.md'ye "Apply (public, no auth)" bölümü eklendi (endpoint, alan tablosu,
   limitler, hata şekilleri, başarı davranışı).

**Doğrulama:** `tsc --noEmit` temiz, `expo-doctor` 18/18, `expo export --platform ios`
hatasız. **Cihazda henüz görülmedi** — kullanıcının Expo Go'da Login ekranındaki "Apply
to join" linkini deneyip gerçek bir test başvurusuyla formu göndermesi gerekiyor
(§8'e göre bu onaylanmadan görev bitmiş sayılmaz). Commit **atılmadı**, onay bekleniyor.

### 2026-07-24 — Profile ekranı web'in 3 kartlı düzenine hizalandı

Kullanıcı web sitesinin profil sayfasının (dark mode, 375px) 2 ekran görüntüsünü verdi. `screens/ProfileScreen.tsx` yeniden yapılandırıldı — sıra ve alanlar ekran görüntüsüyle birebir:

- **Account kartı**: avatar (tıklayınca fotoğraf değiştir, mevcut davranış aynı), isim, email, sağda `subscription_status === 'active'` ise yeşil nokta + "Active" rozeti; başka bir değer gelirse backend'in metni **olduğu gibi** gösteriliyor (tahmin edilmedi).
- **Edit Profile kartı**: Background chip seçici (sağ üstte "Pick up to 3", 3. seçilince kalanlar `opacity-40`) → Full Name/Location (2 kolon) → Phone/LinkedIn (2 kolon) → GitHub (tek kolon) → Current Occupation (çok satırlı) → Relevant Link (Optional)/Area of Interest (2 kolon) → Educational Background (tek kolon) → Favorite Read/Video/Person/Source (çok satırlı) → Save changes. Alan-kolon eşlemesi `FIELD_ROWS` dizisiyle sürülüyor (satır uzunluğu 1 veya 2 → layout). Alan→kolon eşlemesi API.md/PROJECT.md §4.10'da zaten doğrulanmıştı (`bio`→Current Occupation, `twitter`→Area of Interest, `instagram`→Educational Background, `occupation_link`→Relevant Link, `favorite_resource`→Favorite Read/...), değişmedi.
- **Membership kartı**: Status/Plan/Member since. Plan = `member_category`, Member since = `created_at` → yeni `formatMonthYear()` (`lib/format.ts`) ile "July 2026" formatında. İkisi de backend değerini ham gösteriyor, eşleme uyduruldu denemedi.
- **Appearance (Dark/Light/System) seçici SİLİNMEDİ** — Account kartının hemen altına, kendi başlığıyla taşındı (§4.13'teki mekanizmaya dokunulmadı).
- **Kapsam dışı bırakıldı (kullanıcı talimatı):** "API Tokens" kartı ve "Community Brain" kartı (Search network + Exposure/RCEB toggle) — web'de var, App'e bilinçli olarak eklenmedi. Community Brain zaten §1'de kapsam dışıydı.
- **"Manage subscription" linki eklenmedi** — §3 madde 1 kesin kural, Membership kartı sadece üç satırdan ibaret.
- Job board email bildirimleri ve read-only test hesabı davranışı (§4.11) **dokunulmadan** kaldı — bildirim UI'ı yeni kart diline göre restyle edildi (`bg-surface-2` input/chip konvansiyonu, JobBoardScreen'deki mevcut desenle aynı), özel banner/mantık eklenmedi.
- **Not/varsayım:** `member_types` PATCH'i hâlâ virgülle ayrılmış string olarak gönderiliyor (GET'in döndürdüğü format). API.md PATCH şeklini net belirtmiyor — bu bir tahmin, kod içinde yorumla işaretlendi. Gerçek hesapta 400 alınırsa diziye çevrilip API.md güncellenmeli.
- **Doğrulama:** `tsc --noEmit` temiz, `npx expo-doctor` 18/18, `npx expo export --platform ios` hatasız (1339 modül). **Cihazda henüz görülmedi** — kullanıcının Expo Go'da üç kartı ve özellikle Background chip/2-kolon alan davranışını onaylaması gerekiyor.
- Commit **atılmadı** (§8).

### 2026-07-24 — Test hesabı doğrulaması, read-only banner kaldırma, tema toggle kök neden + düzeltme

Yeni session (öncekinin devamı, konuşma dolduğu için taşındı). Üç görev sırayla yapıldı.

**1) Test hesabı fix doğrulaması.** Kullanıcı önceki session'da §4.11'i çözdüğünü söyledi, bu session'da sadece doğrulama istendi. `lib/api.ts` (`ApiError.readOnly`, `isReadOnlyError`, `READ_ONLY_NOTICE`) ve dört ekran (Profile, Match, Discover, JobBoard) tarandı — mekanizma tutarlı, çökme yolu yok, eski/bozuk mantık kalıntısı bulunmadı. **Doğrulandı.** (Hemen ardından madde 2'de bu mekanizma zaten kaldırıldı — aşağı bakın.)

**2) Read-only test hesabı banner'ı tamamen kaldırıldı** (kullanıcı kararı — koşullu gizleme değil, tam silme). `lib/api.ts`'ten `ApiError.readOnly`/`isReadOnlyError`/`READ_ONLY_NOTICE`, `components/Feedback.tsx`'ten `InfoNotice`, ve dört ekrandaki (`ProfileScreen`, `MatchScreen`, `DiscoverScreen`, `JobBoardScreen`) `readOnly` state/prop zinciri + banner JSX'i + sessizce-yutma catch mantığı silindi. Sonuç: test hesabı yazma denediğinde artık backend'in 403 mesajı ("Test accounts are read-only") normal kırmızı `ErrorNotice` olarak görünüyor — diğer her hata gibi. Backend davranışı **değişmedi**, sadece client'ın tepkisi sadeleşti. API.md + PROJECT.md §4.11 güncellendi. `tsc --noEmit` temiz.

**3) Dark/Light/System toggle — kök neden bulundu ve düzeltildi** (bkz. §4.13 için tam detay). Özet: pill seçili görünüyordu ama arka plan hiç değişmiyordu. İki sorun: (a) `app.json` → `userInterfaceStyle: "light"` (native kabuk ışığa kilitli — `"automatic"` yapıldı, NativeWind'in kendi dokümanının gerektirdiği gibi); (b) asıl sebep, NativeWind'in `useColorScheme()`/`colorScheme.set()` API'sinin **resmi olarak deprecated** olması ve altında yatan `Appearance.setColorScheme()` native override'ının Expo Go'da (özel dev client yok) güvenilir çalıştığının doğrulanamaması — kaynağa inilerek (`node_modules/react-native-css-interop`) teyit edildi. Çözüm: tema artık nativewind'in colorScheme mekanizmasına hiç dokunmadan, kendi `ThemeProvider`/`useTheme()` (React Context, `lib/theme.tsx`) ile sürülüyor; `vars()` provider deseni (App.tsx kökü) korundu çünkü o kısım zaten nativewind.dev'in resmi örneğiyle birebir doğruydu. `dark:` varyantı kullanan iki istisna (ErrorNotice, Profile sign-out) da aynı sebeple `isDark` koşuluna çevrildi. `global.css`/`tailwind.config.js` yorumları güncellendi, artık kullanılmayan `.dark {}` bloğu kaldırıldı.

Araştırma ctx7 ile NativeWind + Expo resmi dokümanları üzerinden yapıldı (kullanıcının context7 kuralı gereği), sonra `node_modules` kaynağına inilerek native round-trip'in tam olarak nasıl çalıştığı doğrulandı — tahmine dayalı bir düzeltme değil.

**Doğrulama:** `tsc --noEmit` temiz, `expo-doctor` 18/18, `expo export --platform ios` bundle hatasız (1339 modül, hata yok). **Cihazda henüz görülmedi** — kullanıcının üç görevi de (özellikle üç tema seçeneğini tek tek) Expo Go'da teyit etmesi gerekiyor.

Bu session'da commit **atılmadı** — kullanıcının telefon onayı bekleniyor (çalışma disiplini, §8).

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
