# Kirana

Bot Discord **Nismara Transport** untuk memantau server **Euro Truck Simulator 2** dan **American Truck Simulator** lewat [GameMonitoring](https://gamemonitoring.net).

- Embed status per server yang **update otomatis** (online/offline, pemain, map, alamat, versi)
- **Notifikasi** saat server online/offline, dengan mention role opsional
- Slash command untuk mengelola server dan channel, semuanya tersimpan di **SQLite lokal**

## Kebutuhan

- Node.js **22.13 atau lebih baru** (memakai modul bawaan `node:sqlite`, tanpa native build)
- Mesin yang menyala 24/7 (PC, mini PC, VPS, Oracle Cloud Free Tier, dll.)

## Setup

### 1. Buat aplikasi bot

1. Buka [Discord Developer Portal](https://discord.com/developers/applications), lalu klik **New Application** dan beri nama `Kirana`.
2. **General Information**: salin **Application ID** untuk `CLIENT_ID`.
3. **Bot**: klik **Reset Token** dan salin tokennya untuk `DISCORD_TOKEN`. Kirana tidak butuh privileged intent.
4. Undang bot dengan URL berikut (ganti `CLIENT_ID`):

   ```
   https://discord.com/oauth2/authorize?client_id=CLIENT_ID&scope=bot+applications.commands&permissions=84992
   ```

   Permission `84992` = View Channel, Send Messages, Embed Links, Read Message History.

### 2. Konfigurasi

```powershell
npm install
Copy-Item .env.example .env
```

Isi `.env`:

| Variabel | Keterangan |
| --- | --- |
| `DISCORD_TOKEN` | Token bot |
| `CLIENT_ID` | Application ID |
| `GUILD_ID` | ID server Discord (aktifkan Developer Mode, lalu klik kanan server > Copy Server ID) |
| `DATABASE_PATH` | Lokasi file database, default `./data/kirana.db` |
| `UPDATE_INTERVAL_SECONDS` | Interval cek GameMonitoring, minimal 30, default 60 |

### 3. Daftarkan slash command lalu jalankan

```powershell
npm run deploy   # sekali saja, atau setiap kali definisi command berubah
npm start
```

## Penggunaan

Command `/config` dan `/server` hanya bisa dipakai member dengan izin **Manage Server**.

| Command | Fungsi |
| --- | --- |
| `/config status-channel <channel>` | Channel untuk embed status yang update otomatis |
| `/config notification-channel <channel>` | Channel untuk notifikasi online/offline |
| `/config notification-role [role]` | Role yang di-mention saat notifikasi (kosongkan untuk menghapus) |
| `/config view` | Lihat konfigurasi saat ini |
| `/server add <id> [label]` | Tambah server berdasarkan ID GameMonitoring |
| `/server remove <id>` | Hapus server dari pemantauan |
| `/server list` | Daftar server beserta status terakhir |
| `/status [id]` | Cek live: tanpa ID untuk ringkasan semua server, dengan ID untuk detail plus daftar pemain |

**Mencari ID GameMonitoring:** buka halaman server di gamemonitoring.net. ID-nya adalah angka di URL, misalnya `gamemonitoring.net/euro-truck-simulator-2/servers/`**`1234567`**.

## Menjalankan 24/7 dengan PM2

```powershell
npm install -g pm2
pm2 start src/index.js --name kirana
pm2 save
```

## Struktur

```
src/
├── index.js               # Entry point & handler interaksi
├── deploy-commands.js     # Registrasi slash command (guild)
├── config.js              # Membaca .env
├── database.js            # Skema & query SQLite
├── commands/              # /config, /server, /status
├── services/
│   ├── gamemonitoring.js  # Client API GameMonitoring
│   └── monitor.js         # Loop cek berkala, embed & notifikasi
└── utils/                 # Embed, channel, logger
```

## Backup

Seluruh data ada di satu file `data/kirana.db`. Untuk backup, salin file tersebut saat bot sedang mati.
