# Power Hungry Pets - Game Architecture & Implementation Plan

Bu belge, "Power Hungry Pets" masaüstü oyununun web tabanlı, gerçek zamanlı çok oyunculu versiyonu için teknik mimariyi ve geliştirme yol haritasını içermektedir.

> [!NOTE]
> ## Kararlar (Socratic Gate Tamamlandı)
> 1. **Bağlantı Kopması:** Oyuncu koparsa, sırası geldiğinde **rastgele bir kart oynayan bir Bot** onun yerine geçecek.
> 2. **Eşzamanlılık (Race Condition):** Race condition hatalarını önlemek için **turn-bazlı bir "lock" mekanizması** (örneğin sunucu tarafında `isProcessingTurn: true` bayrağı) kullanılacak.

---

## 1. Veritabanı Şeması (PostgreSQL - Neon via Prisma)

Oyunun anlık ve hızlı akan mantığı (state) bellekte tutulacaktır. Veritabanı sadece kalıcı veriler (kullanıcılar, maç geçmişi, istatistikler) için kullanılacaktır.

```prisma
// schema.prisma

model User {
  id            String   @id @default(uuid())
  username      String   @unique
  email         String   @unique
  passwordHash  String
  createdAt     DateTime @default(now())
  
  // İstatistikler
  totalGames    Int      @default(0)
  wins          Int      @default(0)
  totalTokens   Int      @default(0) // Kazanılan toplam token'lar (opsiyonel)
}

model Room {
  id            String   @id @default(uuid())
  roomCode      String   @unique // Örn: "A1B2"
  hostId        String   // Kurucu User ID
  maxPlayers    Int      @default(6)
  status        RoomStatus @default(WAITING) // WAITING, PLAYING, FINISHED
  createdAt     DateTime @default(now())
}

enum RoomStatus {
  WAITING
  PLAYING
  FINISHED
}

// Oyuncu İstatistikleri veya Liderlik Tablosu vb. genişletilebilir.
```

---

## 2. Socket.io Event Mimarisi

İstemci (Client) ve Sunucu (Server) arasındaki gerçek zamanlı iletişim aşağıdaki event'ler üzerinden sağlanacaktır.

### İstemciden Sunucuya (Client ➔ Server)
- `join_room` `{ roomCode, userId }`: Lobiye katılma isteği.
- `leave_room` `{ roomCode, userId }`: Lobiden ayrılma.
- `start_game` `{ roomCode }`: (Sadece Host) Oyunu başlatır.
- `draw_card` `{ roomCode }`: Sırası gelen oyuncunun desteden kart çekmesi.
- `play_card` `{ roomCode, cardId, targetPlayerId?, guessValue? }`: Kartı oynama ve eylemini gerçekleştirme. *Ekstra parametreler kartın özelliğine göre (örn: Crystal Bowl için `guessValue`) doldurulur.*
- `action_response` `{ roomCode, decision }`: Çok aşamalı kartlar (Örn: 6-Doggy Grave Digger veya 2-Mouse Trapper) için sunucunun beklediği kararı iletme.
- `chat_message` `{ roomCode, message }`: Oyun içi sohbet veya emoji gönderimi.

### Sunucudan İstemciye (Server ➔ Client)
- `room_state_updated` `{ players, status, hostId }`: Lobiye biri katıldığında/ayrıldığında güncel liste.
- `game_started` `{ gameState, yourHand }`: Oyun başladığında, herkese kendi elindeki gizli kartı ve ilk oyun state'ini gönderir.
- `turn_started` `{ activePlayerId }`: Sıranın kime geçtiğini bildirir.
- `action_prompt` `{ promptType, payload }`: Oyuncudan ekstra bir karar/seçim yapmasını ister. (Örn: 6 numara oynandığında kenardaki gizli kartı gösterip "Takaslamak ister misin?" diye sorması).
- `card_drawn` `{ playerId }`: Birinin kart çektiğini (veya aktif oyuncuya çektiği kartın bilgisini) iletir.
- `card_played` `{ playerId, playedCardId, actionResult }`: Oynanan kartı, kimin oynadığını ve etkilerini herkese bildirir (Örn: "Ahmet Battle Bunny oynadı, Ayşe elendi").
- `round_ended` `{ winnerId, revealedHands, newTokens }`: Tur bitişi ve kimin kazandığı bilgisi.
- `game_ended` `{ winnerId }`: 2/3 Token limitine ulaşan genel kazananın duyurusu.
- `error` `{ message }`: Hatalı hamle, sıranın sende olmaması vb. uyarılar.

---

## 3. Oyun State Yönetimi (Server Memory)

Sunucu belleğinde (RAM veya Redis) her oda için tutulacak anlık oyun durumu (`GameState`) objesi tasarımı:

```json
{
  "roomCode": "X7Y9",
  "status": "PLAYING", // WAITING, PLAYING, ROUND_END, GAME_END
  "hostId": "user_123",
  "maxPlayers": 6,
  "players": [
    {
      "id": "user_123",
      "username": "Alican",
      "hand": [4], // Sadece oyuncuya özel görünür (Socket emit ile süzülerek gönderilir)
      "faceUpCards": [1, 3], // Herkesin görebildiği oynanmış kartlar
      "isEliminated": false,
      "isProtected": false, // Shell Shield (4) oynandıysa true olur
      "tokens": 1 // Kazanılan raunt sayısı
    },
    // ...diğer oyuncular
  ],
  "deck": [0, 2, 2, 5, 7, 8, 9], // Kalan kartların ID'leri (Karıştırılmış dizi)
  "setAsideCard": 6, // Kurulumda gizlice ayrılan o 1 kart
  "twoPlayerFaceUpCards": [], // Sadece 2 oyunculu modda kullanılan açık kartlar
  "activePlayerId": "user_123", // Sıra kimde
  "turnOrder": ["user_123", "user_456", "user_789"], // Saat yönünde dönüş sırası
  "pendingAction": null, // Çok aşamalı eylemler için bekleme durumu. Örn: { "playerId": "user_123", "type": "GRAVE_DIGGER_DECISION", "cardValue": 4 }
  "actionQueue": [], // Yürütülecek zincirleme animasyon/eylemler için
  "requiredTokensToWin": 2 // Oyuncu sayısına göre belirlenen bitiş hedefi (4-6 için 2, 2-3 için 3)
}
```

---

## 4. Geliştirme Yol Haritası (Vibecoding Planı)

Projeyi modüler bir şekilde geliştirmek için 5 aşamalı planımız:

### Phase 1: Proje Kurulumu ve Veritabanı Altyapısı
- Monorepo veya Client/Server klasör yapısının oluşturulması.
- Backend: Express, Prisma/Drizzle (Neon DB) kurulumu.
- Frontend: Vite, React, TypeScript, TailwindCSS entegrasyonu.
- Basit bir Auth ve `User` şemasının oluşturulup ayağa kaldırılması.

### Phase 2: Gerçek Zamanlı Lobi Sistemi
- Socket.io entegrasyonu (Client ve Server).
- Oda (Room) oluşturma, kod ile katılma, lobi ekranı.
- Host yetkileri (Oyunu başlatma) ve canlı oyuncu listesi güncellemeleri.

### Phase 3: Temel Oyun Motoru (Game Engine Core)
- State mimarisinin oluşturulması (`deck` oluşturma, karıştırma, ilk kart dağıtımı).
- Tur sistemi (Turn order, active player geçişleri).
- Kart çekme (`draw_card`) ve basit bir kart oynama (`play_card`) altyapısının test edilmesi.
- Tur sonu (Round End) Token dağıtımı ve yeni tura başlama mantığı.

### Phase 4: Kart Mekanikleri ve Aksiyonlar (Game Logic)
- **10 kart tipinin** her biri için özel fonksiyonların yazılması.
- Koruma kalkanı (Shell Shield), eleme (Elimination), kart çalma/takaslama (Not A Pet!, Hermit Home Swap) mekaniklerinin uygulanması.
- Gelişmiş "targetPlayer" seçimlerinin Socket üzerinden validasyonu.

### Phase 5: UI/UX, Animasyonlar ve Polishing
- "Vibecoding" ile tasarımların güzelleştirilmesi. Kartların frontend'de görselleştirilmesi (Tailwind & Framer Motion).
- "Face-up" oynanan kart geçmişlerinin her oyuncunun önünde gösterilmesi.
- Olayların toast/bildirim şeklinde ekranda gösterilmesi ("Ahmet elendi!").
- Deploy (Frontend Vercel, Backend Render).
