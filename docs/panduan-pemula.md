# Panduan ZidCMS untuk Pemula

Panduan ini ditulis untuk Anda yang **belum pernah** memakai terminal, GitHub, atau Vercel. Baca pelan-pelan, ikuti urutannya, dan jangan khawatir — hampir semua kesalahan bisa diperbaiki.

**Daftar isi**

- [Bagian 0 — Kenalan dulu dengan ZidCMS](#bagian-0--kenalan-dulu-dengan-zidcms)
- [Bagian 1 — Memakai dasbor sehari-hari](#bagian-1--memakai-dasbor-sehari-hari) ← *kalau situs Anda sudah dipasang, cukup baca ini*
- [Bagian 2 — Mencoba ZidCMS di komputer sendiri](#bagian-2--mencoba-zidcms-di-komputer-sendiri)
- [Bagian 3 — Memasang ZidCMS online (gratis)](#bagian-3--memasang-zidcms-online-gratis)
- [Bagian 4 — Kalau ada masalah](#bagian-4--kalau-ada-masalah)
- [Lampiran — Contekan Markdown & kamus istilah](#lampiran-a--contekan-markdown)

---

## Bagian 0 — Kenalan dulu dengan ZidCMS

### ZidCMS itu apa?

ZidCMS adalah aplikasi untuk **membuat dan mengelola website/blog**. Bedanya dengan WordPress:

| | WordPress | ZidCMS |
|---|---|---|
| Tempat menyimpan tulisan | Database di server | **Google Sheets** (spreadsheet) |
| Tempat menyimpan gambar | Server | **Google Drive** (privat) |
| Situs yang dilihat pembaca | Dibuat ulang setiap ada pengunjung | **File jadi** (statis) yang disebar lewat CDN — cepat dan murah |
| Biaya hosting | Biasanya bayar | **Gratis** (Vercel Hobby + GitHub + akun Google) |

### Analogi sederhana

Bayangkan sebuah **koran**:

1. **Dasbor admin** = meja redaksi. Di sini Anda menulis dan mengedit.
2. **Google Sheets** = lemari arsip naskah. Semua tulisan (draf maupun yang terbit) disimpan di sini.
3. **Tombol "Terbitkan"** = mengirim naskah ke percetakan.
4. **GitHub** = gudang yang menyimpan setiap edisi koran yang pernah dicetak (bisa dikembalikan ke edisi lama).
5. **Vercel** = percetakan + loper koran. Ia mencetak edisi baru lalu mengantarkannya ke semua pembaca.
6. **Pembaca** hanya pernah melihat **koran yang sudah dicetak**. Mereka tidak pernah masuk ke ruang redaksi.

Karena itu, **menyimpan draf tidak pernah mengubah situs**. Situs baru berubah setelah proses "cetak" (publikasi) selesai — biasanya beberapa menit.

---

## Bagian 1 — Memakai dasbor sehari-hari

> Bagian ini untuk penulis/editor. Anda tidak perlu terminal sama sekali — cukup browser.

### 1.1 Masuk ke dasbor

1. Buka alamat dasbor admin Anda (misalnya `https://nama-anda-admin.vercel.app`).
2. Klik tombol hitam **Masuk dengan Google**.
3. Pilih akun Google Anda.
4. Kalau muncul kotak merah **"Akses ditolak"**, berarti email Anda belum didaftarkan oleh pemasang situs. Hubungi pemasangnya (lihat [Bagian 4](#bagian-4--kalau-ada-masalah)).

Setelah masuk, Anda melihat **Dasbor Editorial**:

- **Kiri** — menu: Dasbor, Artikel, Halaman Statis, Kategori & Tag, Pustaka Media, Publikasi & Snapshot, Pengaturan Situs.
- **Kanan atas** — status situs ("Sinkron dengan snapshot v…" atau "Perubahan menunggu publikasi") dan tombol bulan/matahari untuk mode gelap/terang.
- **Lencana DEV/PROD** di kiri atas — menunjukkan Anda sedang di situs uji (DEV) atau situs sungguhan (PROD).

### 1.2 Menulis artikel pertama

1. Klik tombol hijau **Tulis Artikel Baru** (kiri atas).
2. **Judul** — ketik di kotak besar paling atas. Kotak **Slug URL** di bawahnya akan terisi otomatis.
   - *Slug* adalah bagian alamat artikel. Contoh: judul "Resep Nasi Goreng" → alamat `/blog/resep-nasi-goreng/`.
   - Slug hanya boleh huruf kecil, angka, dan tanda hubung (`-`).
3. **Konten** — tulis di kotak besar. Di atasnya ada tombol bantu:
   - **H** (judul bagian), **B** (tebal), *I* (miring), 🔗 (tautan), kode, daftar, kutipan.
   - Tidak hafal Markdown? Pakai tombol-tombol itu saja. Contekan ada di [Lampiran A](#lampiran-a--contekan-markdown).
4. Di kanan atas kotak konten, pilih tampilan:
   - **Tulis** — hanya editor.
   - **Berdampingan** — editor di kiri, hasil di kanan (paling enak untuk pemula).
   - **Pratinjau** — hanya hasil.
5. **Panel kanan** (opsional, tapi bagus diisi):
   - **Gambar sampul** — klik **Pilih dari Pustaka Media**.
   - **Nama penulis**, **Kategori**, **Tag** (klik tag untuk memilih/membatalkan).
   - **Ringkasan** — kalau dikosongkan, ZidCMS membuatnya otomatis dari paragraf awal.
   - **SEO & Open Graph** — judul dan deskripsi untuk Google & media sosial. Angka di kanan menunjukkan jumlah karakter; kalau berwarna kuning berarti melewati batas yang disarankan.

### 1.3 Menyimpan draf (aman, tidak tayang)

- Klik **Simpan draf**.
- Muncul notifikasi "Draf tersimpan — Situs publik tidak berubah."
- Tulisan masuk ke Google Sheets, **belum** terlihat oleh pembaca.
- Selama ada perubahan yang belum disimpan, muncul tulisan oranye **"● belum disimpan"**. Kalau Anda mencoba pindah halaman, dasbor akan bertanya dulu supaya tulisan tidak hilang.

### 1.4 Melihat pratinjau

- Setelah disimpan, klik **Pratinjau** (kanan atas editor).
- Tab baru terbuka menampilkan artikel **persis seperti di situs**, dengan pita kuning "Pratinjau – belum dipublikasikan".

### 1.5 Menerbitkan

1. Klik tombol hijau **Terbitkan**.
2. Proses publikasi berjalan otomatis. Lihat kemajuannya di kanan atas atau di menu **Publikasi & Snapshot**:

   | Tahap | Artinya |
   |---|---|
   | Antrean | Permintaan diterima |
   | Merakit Snapshot | Semua tulisan yang terbit dikumpulkan dan diperiksa |
   | Commit GitHub | Edisi baru disimpan di GitHub |
   | Deploy (Build) | Vercel sedang "mencetak" situs |
   | Verifikasi Versi | ZidCMS memastikan situs benar-benar sudah berganti |
   | **Tayang (Live)** | Selesai! Artikel bisa dibaca semua orang |

3. Biasanya **2–5 menit**. Anda boleh menutup tab; proses akan dilanjutkan saat Anda membuka dasbor lagi.
4. Kalau beberapa artikel diterbitkan berdekatan, ZidCMS **menggabungkannya** ke satu antrean — tidak perlu menunggu satu per satu.

### 1.6 Mengedit artikel yang sudah tayang

- Buka **Artikel** → klik judulnya → edit → klik **Perbarui**.
- ⚠️ **Perbarui langsung menayangkan perubahan.** Kalau ingin merombak artikel tanpa terlihat pembaca, klik dulu **Batalkan terbit** (artikel turun dari situs dan kembali menjadi draf), edit sepuasnya, lalu **Terbitkan** lagi.
- Hati-hati mengganti **slug** artikel yang sudah tayang: alamat lama akan mati (dasbor memberi peringatan kuning).

### 1.7 Membaca daftar artikel

Menu **Artikel** menampilkan tab **Semua / Draf / Terbit / Arsip / Sampah**, kotak pencarian, dan dua kolom lencana:

**Status** (di Google Sheets):

| Lencana | Arti |
|---|---|
| Draf | Belum diterbitkan |
| Terbit | Ditandai untuk tayang |
| Arsip | Disimpan, tidak tayang |
| Sampah | Dihapus (masih bisa dipulihkan) |

**Situs publik** (apa yang sebenarnya dilihat pembaca):

| Lencana | Arti |
|---|---|
| Tayang | Versi terbaru sudah ada di situs |
| Tayang – pembaruan tertunda | Situs masih menampilkan versi lama; tunggu publikasi selesai |
| Menunggu publikasi | Sudah diterbitkan, tapi publikasi belum selesai |
| Penghapusan tertunda | Akan hilang dari situs setelah publikasi berikutnya |
| Belum tayang | Tidak ada di situs |
| Selisih Rollback | Situs sedang menampilkan versi lama hasil rollback (lihat 1.12) |

### 1.8 Arsip, hapus, dan pulihkan

Di bagian bawah panel kanan editor:

- **Arsipkan** — menyimpan artikel tanpa menayangkannya. Untuk mengaktifkan lagi: buka artikel → **Pindahkan ke draf**.
- **Pindahkan ke sampah** — "menghapus" artikel. Kalau artikel itu sedang tayang, situs otomatis diperbarui.
- Untuk mengembalikan: **Artikel** → tab **Sampah** → **Pulihkan**. Artikel kembali sebagai draf.

### 1.9 Gambar (Pustaka Media)

1. Buka **Pustaka Media**.
2. Klik **Unggah gambar**, atau seret file gambar ke kotak bergaris putus-putus.
   - Format yang boleh: **JPG, PNG, WebP, GIF**. Ukuran maksimal **3 MB**.
   - SVG dan file lain ditolak demi keamanan.
3. Isi **Teks alternatif** (deskripsi gambar untuk tunanetra dan Google), lalu klik ✓.
4. Memasukkan gambar ke artikel:
   - Di editor, klik **Sisipkan media** lalu pilih gambar; **atau**
   - Di Pustaka Media klik **Salin referensi Markdown**, lalu tempel di konten.
   - Tulisan yang muncul seperti `![kucing tidur](zid-media:…)` — itu normal, di situs akan tampil sebagai gambar.

Gambar asli disimpan **privat** di Google Drive. Saat publikasi, hanya gambar yang dipakai yang disalin ke situs.

### 1.10 Halaman statis (Tentang, Kontak, dll.)

- Menu **Halaman Statis** → **Halaman Baru**.
- Cara menulis sama seperti artikel.
- Isi **Urutan di menu header** (misalnya `1`, `2`, `3`) agar halaman muncul di menu atas situs. Kosongkan kalau tidak ingin muncul di menu.
- Alamatnya langsung di bawah domain, misalnya `/tentang/`.

### 1.11 Kategori, tag, dan pengaturan situs

- **Kategori & Tag** — ketik nama lalu klik **Tambah**. Ikon pensil untuk mengubah, ikon tempat sampah untuk menghapus. Satu artikel punya **1 kategori** dan **maksimal 20 tag**.
- **Pengaturan Situs** — judul situs, deskripsi, bahasa (`id` untuk Indonesia), jumlah artikel per halaman, nama penulis default, teks footer, gambar default untuk media sosial. Klik **Simpan pengaturan**.

> Perubahan kategori/tag dan pengaturan **tidak tayang otomatis**. Setelah menyimpan, muncul tanda kuning **"Perubahan menunggu publikasi"** — klik **Publikasikan Situs**.

### 1.12 Ups, salah tayang! (Rollback)

1. Buka **Publikasi & Snapshot**.
2. Di tabel **Riwayat snapshot**, cari versi yang benar (misalnya v5).
3. Klik **Rollback** → **Ya, rollback**.
4. Tunggu sampai **Tayang**. Situs kembali seperti versi itu.

Catatan: rollback hanya mengembalikan **situs**, bukan isi dasbor. Artikel yang berbeda akan diberi lencana ungu **Selisih Rollback**. Setelah Anda memperbaiki artikelnya dan menerbitkan lagi, semuanya kembali normal.

### 1.13 Kebiasaan baik

- ✅ Simpan draf sesering mungkin.
- ✅ Selalu cek **Pratinjau** sebelum menerbitkan.
- ✅ Isi teks alternatif setiap gambar.
- ❌ **Jangan mengedit Google Sheets secara langsung.** Baris yang rusak akan diabaikan dan dasbor menampilkan peringatan merah.
- ❌ Jangan menulis email pribadi admin di artikel — publikasi akan ditolak demi menjaga privasi.
- ℹ️ Situs gratis ini dibatasi sekitar **30 publikasi per hari** (batas Vercel Hobby). Gabungkan beberapa perubahan sebelum menekan **Publikasikan Situs**.

---

## Bagian 2 — Mencoba ZidCMS di komputer sendiri

> Cocok untuk belajar tanpa membuat akun apa pun. Semua data hanya ada di komputer Anda.

### 2.1 Pasang program yang dibutuhkan (sekali saja)

1. **Node.js** — buka <https://nodejs.org>, unduh versi **LTS** (versi 26), instal dengan klik *Next* sampai selesai.
2. **Git** — buka <https://git-scm.com/downloads>, unduh, instal (pilihan default sudah benar).
3. **Visual Studio Code** (editor teks yang punya terminal) — <https://code.visualstudio.com>.

### 2.2 Apa itu terminal?

Terminal adalah jendela tempat Anda mengetik perintah. Di VS Code: menu **Terminal → New Terminal**. Ketik perintah, lalu tekan **Enter**.

Cek apakah instalasi berhasil — ketik satu per satu:

```bash
node -v
git --version
```

Kalau muncul angka versi (misalnya `v26.13.1`), berarti berhasil.

### 2.3 Pasang pnpm

```bash
npm install -g pnpm@12.21.0
pnpm -v
```

Harus muncul `12.21.0`.

### 2.4 Ambil kode ZidCMS

> Sudah punya folder `zidcms` di komputer (misalnya Anda pemilik proyeknya)? Lewati langkah ini — cukup buka folder itu di VS Code.

Ganti `NAMA-AKUN` dengan akun GitHub tempat repo ZidCMS berada:

```bash
git clone https://github.com/NAMA-AKUN/zidcms.git
cd zidcms
```

Lalu buka foldernya di VS Code: **File → Open Folder → pilih folder `zidcms`**.

### 2.5 Siapkan dan jalankan

Di terminal VS Code, di dalam folder `zidcms`:

```bash
pnpm install
pnpm init:local
```

- `pnpm install` mengunduh semua komponen (bisa beberapa menit).
- `pnpm init:local` membuat file pengaturan lokal dengan kunci acak.

Sekarang kita butuh **3 terminal** yang berjalan bersamaan. Klik ikon **+** di panel terminal untuk membuka terminal baru.

| Terminal | Perintah | Fungsinya |
|---|---|---|
| 1 | `pnpm dev:gas` | Tiruan Google Sheets + Apps Script |
| 2 | `pnpm dev:web` | Situs publik di <http://localhost:3001> |
| 3 | `pnpm dev:admin` | Dasbor admin di <http://localhost:3000> |

Biarkan ketiganya tetap terbuka. Kalau ditutup, aplikasinya berhenti.

### 2.6 Masuk dan coba

1. Buka <http://localhost:3000> di browser.
2. Di kotak ungu **Dev login**, ketik `admin@example.com`, klik **Masuk**.
   (Tombol "Masuk dengan Google" belum berfungsi di mode lokal — itu normal.)
3. Ingin contoh isi? Buka terminal ke-4 dan ketik `pnpm seed`, lalu muat ulang dasbor.
4. Klik **Publikasikan Situs**, tunggu sampai **Tayang**.
5. Buka <http://localhost:3001> — situs Anda sudah jadi!

### 2.7 Mematikan dan mengulang dari nol

- Matikan: klik terminal, tekan **Ctrl + C** (lakukan di ketiga terminal).
- Menyalakan lagi: jalankan ulang tiga perintah di 2.5 (tanpa `pnpm install` dan `init:local`).
- Menghapus semua data uji: matikan semua, hapus folder `.local`, lalu ketik `pnpm reset:content`.

---

## Bagian 3 — Memasang ZidCMS online (gratis)

> Ini bagian paling teknis. Siapkan waktu **1–2 jam** dan kopi ☕. Cukup dilakukan **sekali**.
> Selesaikan [Bagian 2](#bagian-2--mencoba-zidcms-di-komputer-sendiri) dulu, karena Anda butuh Node, Git, pnpm, dan folder kodenya.

### 3.0 Siapkan "buku catatan rahasia"

Selama pemasangan Anda akan mendapat banyak **kode rahasia** (token, kunci, alamat). Simpan semuanya di **password manager** (misalnya Bitwarden, gratis) atau file catatan yang **tidak** dibagikan.

> 🔒 **Aturan emas:** jangan pernah menempel kode rahasia di chat, email, issue GitHub, atau di dalam file kode. Repo ZidCMS bersifat publik — apa pun yang masuk ke sana bisa dibaca semua orang.

Isi tabel ini sambil berjalan:

| Nama | Dari langkah | Nilai |
|---|---|---|
| `GITHUB_REPO` | 3.1 | `akun-anda/zidcms` |
| `GITHUB_TOKEN` | 3.2 | `github_pat_…` |
| `HMAC_SECRET` | 3.3 | (acak) |
| `AUTH_SECRET` | 3.3 | (acak) |
| `GAS_WEBAPP_URL` | 3.6 | `https://script.google.com/macros/s/…/exec` |
| Alamat admin | 3.7 | `https://….vercel.app` |
| Alamat situs | 3.7 | `https://….vercel.app` |
| `AUTH_GOOGLE_ID` | 3.8 | `….apps.googleusercontent.com` |
| `AUTH_GOOGLE_SECRET` | 3.8 | `GOCSPX-…` |

### 3.1 GitHub — tempat menyimpan kode

1. Daftar/masuk di <https://github.com>.
2. Klik **+** (kanan atas) → **New repository**.
3. Nama: `zidcms`. Pilih **Public**. **Jangan** centang "Add a README". Klik **Create repository**.
4. Di terminal (folder `zidcms`), hubungkan dan unggah kode — ganti `akun-anda`:

   ```bash
   git remote set-url origin https://github.com/akun-anda/zidcms.git
   git push -u origin main
   ```

   (Kalau muncul pesan "No such remote", pakai `git remote add origin …` sebagai gantinya.)
5. Aktifkan pelindung rahasia: di repo, **Settings → Code security** → aktifkan **Secret scanning** dan **Push protection**.

### 3.2 GitHub — token untuk menerbitkan

ZidCMS butuh izin terbatas untuk menyimpan edisi situs ke repo Anda.

1. Klik foto profil → **Settings** → **Developer settings** (paling bawah kiri) → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. Isi:
   - **Token name:** `zidcms-publisher`
   - **Expiration:** 90 hari (catat di kalender untuk diperbarui)
   - **Repository access:** *Only select repositories* → pilih `zidcms`
   - **Permissions → Repository permissions:**
     - **Contents:** *Read and write*
     - **Commit statuses:** *Read-only*
3. Klik **Generate token**, salin token `github_pat_…` ke buku catatan rahasia. Token hanya ditampilkan **sekali**.

### 3.3 Buat dua kunci acak

Di terminal, jalankan perintah ini **dua kali** — hasil pertama untuk `HMAC_SECRET`, hasil kedua untuk `AUTH_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 3.4 Google Sheets + Apps Script — "lemari arsip"

1. Buka <https://sheets.google.com>, buat **Blank spreadsheet**, beri nama `ZidCMS`.
2. Di spreadsheet itu: menu **Extensions → Apps Script**. Tab baru terbuka.
3. Klik ikon ⚙️ **Project Settings** (kiri):
   - Salin **Script ID** ke buku catatan.
   - Di bagian **Script Properties**, klik **Add script property**, tambahkan:

     | Property | Value |
     |---|---|
     | `HMAC_SECRET` | kunci acak pertama dari 3.3 |
     | `ENVIRONMENT` | `prod` (atau `dev` untuk situs uji) |

   - Klik **Save script properties**.
4. Aktifkan Apps Script API: buka <https://script.google.com/home/usersettings> → nyalakan **Google Apps Script API**.

### 3.5 Unggah kode Apps Script

Di terminal (folder `zidcms`):

```bash
npm install -g @google/clasp
clasp login
```

Browser akan terbuka — pilih akun Google yang sama, klik **Allow**.

Lalu buat file pengaturan clasp. Ganti `ISI_SCRIPT_ID` dengan Script ID dari 3.4:

```bash
cd services/apps-script
node -e "require('fs').writeFileSync('.clasp.json', JSON.stringify({scriptId:'ISI_SCRIPT_ID', rootDir:'dist'}))"
pnpm build
clasp push
```

Kalau ditanya apakah manifest boleh ditimpa, jawab **y**. File `.clasp.json` tidak akan ikut ke GitHub (sudah dikecualikan).

### 3.6 Terbitkan Apps Script sebagai web app

1. Kembali ke tab Apps Script, muat ulang halaman.
2. Klik **Deploy → New deployment**.
3. Klik ikon ⚙️ di sebelah "Select type" → pilih **Web app**.
4. Isi:
   - **Execute as:** *Me*
   - **Who has access:** *Anyone*
5. Klik **Deploy** → **Authorize access** → pilih akun Anda.
   - Kalau muncul "Google hasn't verified this app", klik **Advanced** → **Go to … (unsafe)**. Ini aman karena aplikasinya milik Anda sendiri.
   - Klik **Allow**.
6. Salin **Web app URL** (berakhiran `/exec`) ke buku catatan sebagai `GAS_WEBAPP_URL`.
7. **Siapkan lembar-lembarnya:** di editor Apps Script, pilih fungsi **`setup`** di dropdown atas (sebelah tombol Debug), lalu klik **▶ Run**. Kembali ke spreadsheet — sekarang ada tab `Posts`, `Pages`, `Settings`, dan lainnya. 🎉

> "Who has access: Anyone" terdengar menakutkan, tapi setiap permintaan wajib membawa tanda tangan dari `HMAC_SECRET`. Tanpa kunci itu, permintaan ditolak.

### 3.7 Vercel — "percetakan dan loper"

Kita membuat **dua proyek**: satu untuk dasbor admin, satu untuk situs publik.

1. Daftar di <https://vercel.com> memakai akun GitHub Anda, pilih paket **Hobby** (gratis).
2. **Proyek situs publik:**
   1. **Add New → Project** → pilih repo `zidcms` → **Import**.
   2. **Project Name:** misalnya `nama-anda-web`.
   3. **Root Directory:** klik **Edit** → pilih `apps/web`.
   4. **Environment Variables:** tambahkan `SITE_URL` = `https://nama-anda-web.vercel.app` (sesuai nama proyek).
   5. Klik **Deploy**. Setelah selesai, catat alamatnya sebagai *Alamat situs*.
3. **Proyek dasbor admin:**
   1. **Add New → Project** → repo `zidcms` lagi → **Import**.
   2. **Project Name:** misalnya `nama-anda-admin`.
   3. **Root Directory:** `apps/admin`.
   4. Klik **Deploy** dulu (boleh gagal/eror saat dibuka — variabelnya diisi di 3.9). Catat alamatnya sebagai *Alamat admin*.

### 3.8 Google Cloud — tombol "Masuk dengan Google"

1. Buka <https://console.cloud.google.com> → klik pemilih proyek di atas → **New Project** → nama `zidcms` → **Create**, lalu pastikan proyek itu terpilih.
2. Buka menu **APIs & Services → OAuth consent screen** (di tampilan baru disebut **Google Auth Platform**):
   - Klik **Get started**. Isi nama aplikasi `ZidCMS Admin` dan email Anda.
   - **Audience:** pilih **External**.
   - Selesaikan langkahnya. Di bagian **Audience → Test users**, tambahkan email Google Anda sendiri.
3. Buka **Clients** (atau **Credentials → Create credentials → OAuth client ID**):
   - **Application type:** *Web application*
   - **Name:** `zidcms-admin`
   - **Authorized redirect URIs** → **Add URI**:
     `https://nama-anda-admin.vercel.app/api/auth/callback/google`
     (ganti dengan *Alamat admin* Anda; harus persis, termasuk `https://`)
   - Klik **Create**.
4. Salin **Client ID** dan **Client secret** ke buku catatan.

ZidCMS hanya meminta nama dan email Anda, jadi tidak perlu proses verifikasi Google.

### 3.9 Isi pengaturan dasbor admin di Vercel

Di Vercel, buka proyek **admin** → **Settings → Environment Variables**. Tambahkan satu per satu:

| Name | Value |
|---|---|
| `AUTH_SECRET` | kunci acak kedua dari 3.3 |
| `AUTH_GOOGLE_ID` | Client ID dari 3.8 |
| `AUTH_GOOGLE_SECRET` | Client secret dari 3.8 |
| `ADMIN_EMAILS` | email Google Anda (pisahkan dengan koma kalau lebih dari satu) |
| `ADMIN_URL` | *Alamat admin*, tanpa garis miring di akhir |
| `ZIDCMS_ENV` | `prod` |
| `GAS_WEBAPP_URL` | dari 3.6 |
| `GAS_HMAC_SECRET` | **sama persis** dengan `HMAC_SECRET` di 3.4 |
| `PUBLISH_TARGET` | `github` |
| `GITHUB_TOKEN` | token dari 3.2 |
| `GITHUB_REPO` | `akun-anda/zidcms` |
| `GITHUB_BRANCH` | `main` |
| `PUBLIC_SITE_URL` | *Alamat situs*, tanpa garis miring di akhir |

Lalu buka tab **Deployments** → titik tiga di deployment teratas → **Redeploy**.

### 3.10 Uji coba pertama 🎉

1. Buka *Alamat admin* → **Masuk dengan Google** → pilih akun yang ada di `ADMIN_EMAILS`.
2. **Tulis Artikel Baru** → isi judul dan konten → **Terbitkan**.
3. Tunggu sampai **Tayang** (beberapa menit — Vercel sedang membangun situs).
4. Buka *Alamat situs* — artikel Anda sudah online!
5. Cek juga `https://alamat-situs-anda/zidcms-version.json` — angka `version` harus sama dengan snapshot di dasbor.

Selamat, ZidCMS Anda sudah online dengan biaya **Rp0**.

### 3.11 Menambah admin lain

Di Vercel proyek admin: ubah `ADMIN_EMAILS` menjadi `email-anda@gmail.com,email-teman@gmail.com` → **Redeploy**. Tambahkan juga email teman di **Test users** Google Cloud (3.8).

---

## Bagian 4 — Kalau ada masalah

| Yang terlihat | Penyebab yang paling mungkin | Cara memperbaiki |
|---|---|---|
| "Akses ditolak" saat masuk | Email tidak ada di `ADMIN_EMAILS`, atau bukan Test user | Periksa 3.9 dan 3.8, lalu Redeploy |
| Google: `redirect_uri_mismatch` | Alamat di 3.8 tidak persis sama dengan alamat admin | Samakan, termasuk `https://` dan `/api/auth/callback/google` |
| "Konfigurasi server … belum diatur" | Ada variabel yang lupa diisi | Lengkapi tabel 3.9, lalu Redeploy |
| "Apps Script tidak dapat dihubungi" / "Respons Apps Script tidak valid" | `GAS_WEBAPP_URL` salah, atau web app belum di-deploy | Ulangi 3.6, salin URL yang berakhiran `/exec` |
| Kode `SIGNATURE_INVALID` | `GAS_HMAC_SECRET` (Vercel) ≠ `HMAC_SECRET` (Apps Script) | Samakan persis — hati-hati spasi tersalin |
| "Sheet … belum disiapkan" | Fungsi `setup` belum dijalankan | Jalankan `setup` di editor Apps Script (3.6 langkah 7) |
| `setup` gagal: "dinonaktifkan di prod setelah instalasi pertama" | `setup` sudah pernah dijalankan dengan `ENVIRONMENT` = `prod` | Normal — lembarnya sudah siap. Pengaman ini mencegah perubahan skema tak sengaja di situs sungguhan |
| Publikasi lama di "Deploy (Build)" | Vercel sedang antre membangun | Cek tab Deployments di Vercel. Gagal otomatis setelah 15 menit |
| Gagal dengan `DEPLOY_FAILED` | Build Vercel gagal — situs lama tetap tayang | Buka log deployment terakhir di Vercel, lalu klik **Publikasikan Situs** lagi |
| Gagal dengan `VERIFY_TIMEOUT` | `PUBLIC_SITE_URL` salah | Periksa alamat situs di 3.9 |
| Gagal dengan `GITHUB_ERROR` | Token kedaluwarsa atau izinnya kurang | Buat token baru (3.2), perbarui di Vercel |
| Gagal dengan `VALIDATION_ERROR` | Ada gambar yang sudah dihapus tapi masih dipakai artikel | Baca pesan errornya, perbaiki artikel yang disebut |
| "Item ini telah diubah di tempat lain" | Artikel diedit di tab/perangkat lain | Klik **Salin konten saya**, lalu **Muat ulang**, tempel kembali yang perlu |
| "Slug … sudah dipakai" | Ada artikel lain (termasuk arsip) dengan alamat sama | Ganti slug |
| Unggah gambar ditolak | Lebih dari 3 MB atau bukan JPG/PNG/WebP/GIF | Kecilkan/konversi gambar (misalnya dengan squoosh.app) |
| "Spreadsheet sedang sibuk" | Dua penyimpanan bersamaan | Tunggu beberapa detik, coba lagi |
| Peringatan merah "baris tidak valid" | Google Sheets diedit manual | Kembalikan versi sheet lewat **File → Version history** |
| Situs menampilkan tulisan yang salah | — | **Publikasi & Snapshot → Rollback** (1.12). Darurat: Vercel proyek web → Deployments → **Instant Rollback** |

Masih buntu? Lihat `docs/operations.md` untuk langkah lanjutan.

---

## Lampiran A — Contekan Markdown

| Ketik ini | Hasilnya |
|---|---|
| `## Judul Bagian` | Judul bagian besar |
| `### Sub-judul` | Judul lebih kecil |
| `**tebal**` | **tebal** |
| `_miring_` | *miring* |
| `~~coret~~` | ~~coret~~ |
| `[teks tautan](https://contoh.com)` | tautan |
| `- poin` | daftar berbutir |
| `1. langkah` | daftar bernomor |
| `- [x] selesai` | kotak centang |
| `> kutipan` | blok kutipan |
| `` `kode` `` | `kode` |
| Baris kosong | Paragraf baru |

Tabel:

```markdown
| Nama | Harga |
|---|---|
| Kopi | 15.000 |
```

> Kode HTML seperti `<b>` atau `<script>` tidak dijalankan — akan tampil apa adanya sebagai teks. Ini disengaja demi keamanan.

## Lampiran B — Kamus istilah

| Istilah | Artinya |
|---|---|
| **Admin / dasbor** | Halaman pengelolaan situs, hanya untuk Anda |
| **Situs publik** | Website yang dilihat pembaca |
| **Draf** | Tulisan yang belum diterbitkan |
| **Slug** | Bagian alamat halaman, misalnya `resep-nasi-goreng` |
| **Markdown** | Cara menulis format teks dengan simbol sederhana |
| **Snapshot** | "Edisi" situs: kumpulan semua tulisan yang terbit pada satu waktu |
| **Publikasi** | Proses membuat snapshot baru dan menayangkannya |
| **Rollback** | Mengembalikan situs ke snapshot/edisi sebelumnya |
| **Repo (repository)** | Folder proyek yang disimpan di GitHub |
| **Commit** | Satu catatan perubahan yang disimpan di repo |
| **Deploy / build** | Proses Vercel membuat dan mengunggah situs |
| **Token / secret** | Kata sandi khusus untuk aplikasi — wajib dirahasiakan |
| **Environment variable** | Pengaturan rahasia yang disimpan di Vercel, bukan di kode |
| **Terminal** | Jendela untuk mengetik perintah |
| **DEV / PROD** | Situs uji coba / situs sungguhan |
| **Apps Script** | Program kecil milik Google yang menjembatani dasbor dengan Google Sheets |
