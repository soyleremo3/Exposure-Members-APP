@AGENTS.md

# Exposure Member Access

`exposureai.org` üye alanının (giriş sonrası panel) iOS/Android uygulaması.

## Her göreve başlamadan önce

1. **[PROJECT.md](./PROJECT.md)**'yi baştan sona oku — mimari, alınmış kararlar, ekran durumu, açık sorular, oturum günlüğü.
2. **[API.md](./API.md)** backend'in tek doğru kaynağı. Veri şekliyle ilgili her soruda oraya bak.

## Asla ihlal edilmeyecek dört kural

1. **Ödeme / abonelik / fiyat UI'ı yok** — Apple IAP kuralı, ret sebebi. Ayrıntı: PROJECT.md §3.
2. `lib/config.ts`'teki public Supabase değerleri hariç **hiçbir gizli anahtar koda gömülmez**.
3. **API cevap şekli belirsizse tahmin etme, kullanıcıya sor.**
4. **Gereksiz kütüphane/soyutlama ekleme** — state-management yok, her ekran kendi verisini çeker.

## Sık düşülen tuzaklar

- **Liste benzeri API alanlarını doğrudan okuma.** `member_types` string olarak geliyor, dizi değil. Her zaman `lib/format.ts`'teki `toTypeList()` kullan. Ayrıntı: PROJECT.md §4.3.
- **Giriş kodu 6 hane değil**, 6–10 arası. Ayrıntı: PROJECT.md §2.
- **`/api/members/events` 401'i "oturum bitti" demek değil** — abonelik pasif de olabilir. `lib/api.ts` → `getEvents` bunu ayırıyor, bozma. Ayrıntı: PROJECT.md §4.4.
- **Expo SDK 54 kasıtlı**, 57 değil. Sebep: PROJECT.md §4.1. `npx expo install` kullan, elle sürüm yazma.

## Çalışma disiplini

- Gerçek cihaz/Mac yok. **Kullanıcı kendi telefonunda Expo Go ile görüp onaylamadan hiçbir şey commit edilmez.**
- Web sitesini incelerken **mobil genişlikte** (375px) bak.
- Her görev sonunda PROJECT.md'nin **Oturum Günlüğü**'ne yeni kayıt ekle. Eskileri silme.
