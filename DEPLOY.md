# 🚀 Power Hungry Pets — Deploy Rehberi

Arkadaşlarınla test etmek için ücretsiz kurulum:

| Parça | Platform | Neden |
|-------|----------|-------|
| Backend (`server/`) | **Render** (Web Service) | Socket.io/WebSocket + bellekteki oyun state'i için sürekli çalışan tek instance gerekir (serverless olmaz) |
| Frontend (`client/`) | **Vercel** | Statik Vite SPA için en kolayı |
| Veritabanı | **Neon** (mevcut) | Zaten kurulu |

> Hepsi ücretsiz katmanda. Repoda `render.yaml` (backend) ve `client/vercel.json` (SPA yönlendirme) hazır.

---

## 0) Kodu GitHub'a yükle

Repo zaten `git init` + ilk commit ile hazır. GitHub'da **boş** bir repo aç (README ekleme), sonra:

```bash
git remote add origin https://github.com/<kullanıcı-adın>/power-hungry-pets.git
git branch -M main
git push -u origin main
```

---

## 1) Backend → Render

1. <https://render.com> → GitHub ile giriş yap.
2. **New → Blueprint** → repoyu seç. Render `render.yaml`'ı okuyup `power-hungry-pets-server` servisini oluşturur.
   - (Alternatif: **New → Web Service**, Root Directory = `server`, Build = `npm install --include=dev && npx prisma generate && npm run build`, Start = `npm start`.)
3. Environment değişkenleri:
   - **`DATABASE_URL`** → `server/.env`'deki Neon bağlantı string'ini yapıştır (mevcut DB'yi tekrar kullanabilirsin).
   - **`JWT_SECRET`** → Blueprint otomatik üretir (manuel kurulumda rastgele uzun bir değer gir).
   - **`CLIENT_URL`** → şimdilik boş bırakabilirsin (`*.vercel.app` zaten CORS'ta izinli).
4. Deploy bitince servisin adresini not al: `https://power-hungry-pets-server.onrender.com`
5. Test: tarayıcıda `<backend-url>/health` → `{"status":"ok"}` görmelisin.

> ⚠️ Ücretsiz katman 15 dk hareketsizlikte uykuya geçer; ilk istek ~30-60 sn sürebilir (sonra hızlanır).

---

## 2) Frontend → Vercel

1. <https://vercel.com> → GitHub ile giriş → **Add New → Project** → repoyu seç.
2. **Root Directory = `client`** seç (Framework otomatik: Vite).
3. **Environment Variables**:
   - **`VITE_SERVER_URL`** = Render backend adresin (örn. `https://power-hungry-pets-server.onrender.com`) — **sondaki `/` olmadan**.
4. **Deploy**. Bitince frontend adresin: `https://<proje>.vercel.app`

> `VITE_SERVER_URL` build sırasında gömülür. Sonradan değiştirirsen Vercel'de **Redeploy** gerekir.

---

## 3) Bağla (opsiyonel ama önerilir)

CORS'u sıkılaştırmak için Render'da **`CLIENT_URL`** = Vercel adresin yap ve servisi yeniden başlat. (Atlarsan da `*.vercel.app` izinli olduğu için çalışır.)

---

## 4) Test et

1. Vercel adresini aç, kayıt ol / misafir gir, **Yeni Oda Kur**.
2. Oda kodunu arkadaşına gönder; o da aynı adresten **Oda Koduyla Katıl**.
3. Host **Oyunu Başlat**.

---

## Notlar

- **Bellekte state:** Backend yeniden başlarsa (deploy/uyku) aktif oyunlar sıfırlanır — test için sorun değil.
- **Şema değişikliği:** `server/prisma/schema.prisma`'yı değiştirirsen lokalde `npm run db:push` ile Neon'a uygula.
- **Güvenlik:** `*.vercel.app` CORS'ta geniş tutuldu (kolay kurulum için). Üretimde `server/src/index.ts` içindeki `isAllowedOrigin`'i yalnızca kendi domainine kısabilirsin.
- **`.env` asla commit'lenmez** (`.gitignore`'da). Sırlar yalnızca Render/Vercel panelinde.

---

## Hızlı alternatif (deploy etmeden)

Sadece kısa bir test için: lokalde çalıştırıp [ngrok](https://ngrok.com) ile backend portunu (3001) dışarı açabilirsin; ama bilgisayarın açık kalmalı. Kalıcı paylaşım için yukarıdaki deploy önerilir.
