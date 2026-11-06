# 9Router di Render Free (tanpa kartu)

Deploy [9Router](https://github.com/decolua/9router) — AI gateway OpenAI-compatible —
ke Render Free: gratis selamanya, tanpa credit card, tanpa server sendiri.

Image dasar dipin ke `decolua/9router:0.5.112`. Dua tambahan di repo ini:

- `render.yaml` — blueprint Render (plan Free, region Singapore, health check `/api/health`, secret digenerate otomatis).
- `entrypoint.sh` + `backup.js` — opsional: simpan `data.sqlite` ke repo GitHub private supaya provider/API key/combo tidak hilang saat Render restart.

## Deploy

1. Buka: https://render.com/deploy?repo=https://github.com/haxsnuan-jpg/9router-render
2. Login GitHub (tidak diminta kartu), pilih **Apply**.
3. Tunggu build ~2-4 menit sampai status **Live**.
4. Buka URL `https://9router-xxxx.onrender.com`, login dengan password dari
   dashboard Render → service `9router` → **Environment** → `INITIAL_PASSWORD`
   (bukan `123456`; salah password berulang bikin akun terkunci).
5. **Providers** → sambungkan provider (OAuth atau API key).
6. **Endpoint** → buat 9Router API key.
7. Arahkan client ke:

   ```
   OPENAI_BASE_URL=https://9router-xxxx.onrender.com/v1
   OPENAI_API_KEY=<key dari menu Endpoint>
   ```

## Supaya config tidak hilang saat restart

Render Free memakai filesystem ephemeral. Tanpa backup, `data.sqlite` hilang tiap
deploy/restart dan provider harus disambung ulang.

1. Buat repo **private** baru, misal `9router-db` (isi bebas, bisa kosong).
2. Buat fine-grained PAT: Settings → Developer settings → Personal access tokens →
   Fine-grained → akses hanya repo itu → permission **Contents: Read and write**.
3. Di Render → Environment, isi:
   - `BACKUP_REPO` = `username/9router-db`
   - `BACKUP_TOKEN` = token PAT tadi
   - `BACKUP_PATH` (opsional, default `db/data.sqlite`)
   - `BACKUP_INTERVAL` (opsional, detik, default `300`)
4. Manual deploy ulang. Saat boot entrypoint menarik DB terakhir, lalu mengunggah
   ulang tiap 5 menit dan sekali lagi saat service dimatikan.

Yang ikut tersimpan: provider, API key, combo, settings. Yang tidak: riwayat request
dan isi log. Jendela kehilangan data maksimal sebesar `BACKUP_INTERVAL`.

## Batas jujurnya

- Free instance tidur setelah 15 menit tanpa trafik; request pertama bangun ~40-60 detik.
- RAM 512 MB (9Router idle ~85 MB), 750 jam/bulan, 5 GB egress/bulan.
- Tanpa `BACKUP_*`, data hilang setiap restart.
- OAuth provider di balik reverse proxy kadang callback ke
  `http://localhost:443/callback?...` — ganti origin di address bar ke domain Render,
  kodenya tetap valid.
- `/v1/*` di deployment remote selalu butuh API key 9Router.

## Verifikasi lokal

```bash
podman build -t 9router-render .
podman run -d --name 9r -p 20128:20128 \
  -e JWT_SECRET=dev -e INITIAL_PASSWORD=devpass -e API_KEY_SECRET=devkey \
  9router-render
curl -s localhost:20128/api/health   # {"ok":true}
```
