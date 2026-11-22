# ZidCMS Beginner Guide

This guide is for people who have **never** used a terminal, GitHub, or Vercel. Read it slowly, follow the order, and don't worry: almost every mistake can be undone.

> The admin dashboard's interface is in **Bahasa Indonesia**. This guide quotes every button and label exactly as it appears on screen, followed by its English meaning, e.g. **Terbitkan** (Publish).

**Contents**

- [Part 0: Meet ZidCMS](#part-0-meet-zidcms)
- [Part 1: Using the dashboard day to day](#part-1-using-the-dashboard-day-to-day) ← _if your site is already installed, this is all you need_
- [Part 2: Trying ZidCMS on your own computer](#part-2-trying-zidcms-on-your-own-computer)
- [Part 3: Putting ZidCMS online (free)](#part-3-putting-zidcms-online-free)
- [Part 4: Troubleshooting](#part-4-troubleshooting)
- [Appendix: Markdown cheat sheet & glossary](#appendix-a-markdown-cheat-sheet)

---

## Part 0: Meet ZidCMS

### What is ZidCMS?

ZidCMS is an application for **creating and managing a website or blog**. How it differs from WordPress:

|                         | WordPress              | ZidCMS                                                          |
| ----------------------- | ---------------------- | --------------------------------------------------------------- |
| Where posts are stored  | A database on a server | **Google Sheets** (a spreadsheet)                               |
| Where images are stored | The server             | **Google Drive** (private)                                      |
| The site readers see    | Rebuilt on every visit | **Ready-made (static) files** served from a CDN: fast and cheap |
| Hosting cost            | Usually paid           | **Free** (Vercel Hobby + GitHub + a Google account)             |

### A simple analogy

Picture a **newspaper**:

1. **Admin dashboard** = the newsroom desk. This is where you write and edit.
2. **Google Sheets** = the filing cabinet of manuscripts. Every article (drafts and published ones) lives here.
3. **The "Terbitkan" (Publish) button** = sending the manuscript to the printing press.
4. **GitHub** = the warehouse that keeps every edition ever printed (you can go back to an old edition).
5. **Vercel** = the printing press and the delivery crew. It prints the new edition and delivers it to every reader.
6. **Readers** only ever see **printed newspapers**. They never enter the newsroom.

That is why **saving a draft never changes the site**. The site only changes after the "printing" (publishing) finishes, usually within a few minutes.

---

## Part 1: Using the dashboard day to day

> This part is for writers and editors. You don't need a terminal at all, just a browser.

### 1.1 Signing in

1. Open your admin dashboard address (for example `https://your-name-admin.vercel.app`).
2. Click the black **Masuk dengan Google** (Sign in with Google) button.
3. Choose your Google account.
4. If a red **"Akses ditolak"** (Access denied) box appears, your e-mail has not been registered by whoever installed the site. Contact them (see [Part 4](#part-4-troubleshooting)).

After signing in you see the **Dasbor Editorial** (Editorial Dashboard):

- **Left:** the menu with _Dasbor_ (Dashboard), _Artikel_ (Posts), _Halaman Statis_ (Static Pages), _Kategori & Tag_ (Categories & Tags), _Pustaka Media_ (Media Library), _Publikasi & Snapshot_ (Publishing & Snapshots), _Pengaturan Situs_ (Site Settings).
- **Top right:** site status ("Sinkron dengan snapshot v…" = in sync with snapshot v…, or "Perubahan menunggu publikasi" = changes waiting to be published) and a moon/sun button for dark/light mode.
- **DEV/PROD badge** at the top left tells you whether you are on the test site (DEV) or the real site (PROD).

### 1.2 Writing your first post

1. Click the green **Tulis Artikel Baru** (Write New Post) button (top left).
2. **Judul** (Title): type it in the big box at the top. The **Slug URL** box below fills in automatically.
   - The _slug_ is part of the post's address. Example: title "Fried Rice Recipe" → address `/blog/fried-rice-recipe/`.
   - Slugs may only contain lowercase letters, digits, and hyphens (`-`).
3. **Content:** write in the large box. Above it are helper buttons:
   - **H** (section heading), **B** (bold), _I_ (italic), 🔗 (link), code, list, quote.
   - Don't know Markdown? Just use those buttons. A cheat sheet is in [Appendix A](#appendix-a-markdown-cheat-sheet).
4. At the top right of the content box, choose a view:
   - **Tulis** (Write): editor only.
   - **Berdampingan** (Side by side): editor on the left, result on the right (easiest for beginners).
   - **Pratinjau** (Preview): result only.
5. **Right-hand panel** (optional, but worth filling in):
   - **Gambar sampul** (Cover image): click **Pilih dari Pustaka Media** (Choose from Media Library).
   - **Nama penulis** (Author name), **Kategori** (Category), **Tag** (click a tag to select/deselect it).
   - **Ringkasan** (Excerpt): if left empty, ZidCMS generates one from the opening paragraph.
   - **SEO & Open Graph:** title and description for Google and social media. The number on the right is the character count; yellow means it is over the recommended length.

### 1.3 Saving a draft (safe, not public)

- Click **Simpan draf** (Save draft).
- A notification appears: **"Draf tersimpan"** with the line "Situs publik tidak berubah." (Draft saved. The public site did not change.)
- The post is stored in Google Sheets and is **not** visible to readers yet.
- While there are unsaved changes, an orange **"● belum disimpan"** (not saved) label is shown. If you try to leave the page, the dashboard asks first so you don't lose your work.

### 1.4 Previewing

- After saving, click **Pratinjau** (Preview) at the top right of the editor.
- A new tab shows the post **exactly as it will look on the site**, with a yellow "Pratinjau – belum dipublikasikan" (Preview, not published) ribbon.

### 1.5 Publishing

1. Click the green **Terbitkan** (Publish) button.
2. Publishing runs automatically. Watch its progress at the top right or in **Publikasi & Snapshot**:

   | Stage (on screen)   | Meaning                                           |
   | ------------------- | ------------------------------------------------- |
   | Antrean             | Queued, request received                          |
   | Validasi & Snapshot | All published posts are collected and checked     |
   | Commit GitHub       | The new edition is saved to GitHub                |
   | Build Vercel        | Vercel is "printing" the site                     |
   | Cek zidcms-version  | ZidCMS confirms the site has really switched over |
   | **Tayang** (Live)   | Done! Everyone can read the post                  |

3. This usually takes **1–3 minutes**. You may close the tab; the process continues the next time you open the dashboard.
4. If several posts are published close together, ZidCMS **merges them into one queue**, so there is no need to wait for each one.

### 1.6 Editing a post that is already live

- Open **Artikel** (Posts) → click its title → edit → click **Perbarui** (Update).
- ⚠️ **Perbarui publishes the change immediately.** To rework a post without readers seeing it, first click **Batalkan terbit** (Unpublish: the post leaves the site and becomes a draft again), edit as much as you like, then **Terbitkan** again.
- Be careful changing the **slug** of a live post: the old address stops working (the dashboard shows a yellow warning).

### 1.7 Reading the post list

The **Artikel** (Posts) menu shows the tabs **Semua / Draf / Terbit / Arsip / Sampah** (All / Draft / Published / Archived / Trash), a search box, and two badge columns:

**Status** (in Google Sheets):

| Badge  | Meaning                          |
| ------ | -------------------------------- |
| Draf   | Draft, not published yet         |
| Terbit | Published, marked to be live     |
| Arsip  | Archived: kept, not live         |
| Sampah | Trash: deleted (can be restored) |

**Situs publik** (Public site: what readers actually see):

| Badge                       | Meaning                                                                          |
| --------------------------- | -------------------------------------------------------------------------------- |
| Tayang                      | Live: the latest version is on the site                                          |
| Tayang – pembaruan tertunda | Live, update pending: the site still shows the old version; wait                 |
| Menunggu publikasi          | Waiting for publish: published, but the publish job isn't done yet               |
| Penghapusan tertunda        | Removal pending: will disappear from the site after the next publish             |
| Belum tayang                | Not live: not on the site                                                        |
| Selisih Rollback            | Rollback difference: the site shows an older version after a rollback (see 1.12) |

### 1.8 Archive, delete, and restore

At the bottom of the editor's right-hand panel:

- **Arsipkan** (Archive) keeps the post without showing it. To revive it: open the post → **Pindahkan ke draf** (Move to draft).
- **Pindahkan ke sampah** (Move to trash) "deletes" the post. If it is live, the site is updated automatically.
- To bring it back: **Artikel** → **Sampah** (Trash) tab → **Pulihkan** (Restore). It comes back as a draft.

### 1.9 Images (Pustaka Media / Media Library)

1. Open **Pustaka Media** (Media Library).
2. Click **Unggah gambar** (Upload image), or drag an image file onto the dashed box.
   - Allowed formats: **JPG, PNG, WebP, GIF**. Maximum size **3 MB**.
   - SVG and other files are rejected for security reasons.
3. Fill in **Teks alternatif** (Alt text: a description for blind readers and Google), then click ✓.
4. To put an image in a post:
   - In the editor, click **Sisipkan media** (Insert media) and choose the image; **or**
   - In the Media Library click **Salin referensi Markdown** (Copy Markdown reference), then paste it into the content.
   - The text looks like `![sleeping cat](zid-media:…)`. That's normal; on the site it shows as an image.

Original images are stored **privately** in Google Drive. When publishing, only the images actually used are copied to the site.

### 1.10 Static pages (About, Contact, etc.)

- Menu **Halaman Statis** (Static Pages) → **Halaman Baru** (New Page).
- Writing works the same as for posts.
- Fill in **Urutan di menu header** (Order in the header menu, e.g. `1`, `2`, `3`) to show the page in the site's top menu. Leave it empty to keep it out of the menu.
- The address sits directly under the domain, e.g. `/about/`.

### 1.11 Categories, tags, and site settings

- **Kategori & Tag:** type a name and click **Tambah** (Add). The pencil icon edits, the trash icon deletes. A post has **one category** and **up to 20 tags**.
- **Pengaturan Situs** (Site Settings): site title, description, language (`en`, `id`, …), posts per page, default author name, footer text, default social-media image. Click **Simpan pengaturan** (Save settings).

> Category/tag and settings changes are **not published automatically**. After saving, a yellow **"Perubahan menunggu publikasi"** (Changes waiting to be published) notice appears. Click **Publikasikan Situs** (Publish Site).

### 1.12 Oops, wrong content went live! (Rollback)

1. Open **Publikasi & Snapshot**.
2. In the **Riwayat snapshot** (Snapshot history) table, find the correct version (e.g. v5).
3. Click **Rollback** → **Ya, rollback** (Yes, roll back).
4. Wait until **Tayang** (Live). The site is back to that version.

Note: a rollback only restores the **site**, not the dashboard contents. Posts that differ get a purple **Selisih Rollback** badge. Once you fix those posts and publish again, everything is back to normal.

### 1.13 Good habits

- ✅ Save drafts often.
- ✅ Always check **Pratinjau** (Preview) before publishing.
- ✅ Give every image alt text.
- ❌ **Don't edit the Google Sheet directly.** Broken rows are ignored and the dashboard shows a red warning.
- ❌ Don't put an admin's private e-mail address in a post: publishing is refused to protect privacy.
- ℹ️ The free hosting plan allows about **30 publishes per day** (Vercel Hobby limits). Bundle several changes before clicking **Publikasikan Situs**.

---

## Part 2: Trying ZidCMS on your own computer

> Good for learning without creating any accounts. All data stays on your computer.

### 2.1 Install the required programs (once)

1. **Node.js:** go to <https://nodejs.org>, download **version 26**, and install it by clicking _Next_ until done.
2. **Git:** go to <https://git-scm.com/downloads>, download, and install (the default choices are fine).
3. **Visual Studio Code** (a text editor with a built-in terminal): <https://code.visualstudio.com>.

### 2.2 What is a terminal?

A terminal is a window where you type commands. In VS Code: menu **Terminal → New Terminal**. Type a command and press **Enter**.

Check the installation by typing these one at a time:

```bash
node -v
git --version
```

If you see version numbers (e.g. `v26.13.1`), it worked.

### 2.3 Install pnpm

```bash
npm install -g pnpm@12.21.0
pnpm -v
```

It should print `12.21.0`.

### 2.4 Get the ZidCMS code

> Already have a `zidcms` folder on your computer (e.g. you own the project)? Skip this step and just open that folder in VS Code.

```bash
git clone https://github.com/zidnammc/zidcms.git
cd zidcms
```

Then open the folder in VS Code: **File → Open Folder → choose the `zidcms` folder**.

### 2.5 Set up and run

In the VS Code terminal, inside the `zidcms` folder:

```bash
pnpm install
pnpm init:local
```

- `pnpm install` downloads all components (may take a few minutes).
- `pnpm init:local` creates a local settings file with random keys.

Now you need **3 terminals** running at the same time. Click the **+** icon in the terminal panel to open a new one.

| Terminal | Command          | What it does                                   |
| -------- | ---------------- | ---------------------------------------------- |
| 1        | `pnpm dev:gas`   | A stand-in for Google Sheets + Apps Script     |
| 2        | `pnpm dev:web`   | The public site at <http://localhost:3001>     |
| 3        | `pnpm dev:admin` | The admin dashboard at <http://localhost:3000> |

Keep all three open. Closing one stops that part of the app.

### 2.6 Sign in and try it

1. Open <http://localhost:3000> in your browser.
2. In the purple **Dev login** box, type `admin@example.com` and click **Masuk** (Sign in).
   (The "Masuk dengan Google" button does not work in local mode; that's expected.)
3. Want sample content? Open a 4th terminal, type `pnpm seed`, then reload the dashboard.
4. Click **Publikasikan Situs** (Publish Site) and wait until **Tayang** (Live).
5. Open <http://localhost:3001>. Your site is ready!

### 2.7 Stopping and starting over

- Stop: click a terminal and press **Ctrl + C** (do this in all three).
- Start again: rerun the three commands from 2.5 (without `pnpm install` and `init:local`).
- Wipe all test data: stop everything, delete the `.local` folder, then run `pnpm reset:content`.

---

## Part 3: Putting ZidCMS online (free)

> This is the most technical part. Set aside **1–2 hours** and a coffee ☕. You only do it **once**.
> Finish [Part 2](#part-2-trying-zidcms-on-your-own-computer) first. You need Node, Git, pnpm, and the code folder.
>
> Everything below uses **your own** accounts (GitHub, Google, Vercel). Nothing is shared with the ZidCMS authors, and everything stays on free plans.

### 3.0 Prepare a "secret notebook"

During setup you will collect many **secret values** (tokens, keys, addresses). Keep them all in a **password manager** (Bitwarden is free) or a private note that is **never** shared.

> 🔒 **Golden rule:** never paste a secret into chat, e-mail, a GitHub issue, or a code file. Your ZidCMS repository is public, so anything that ends up in it can be read by everyone.

Fill in this table as you go:

| Name                 | From step | Value                                       |
| -------------------- | --------- | ------------------------------------------- |
| `GITHUB_REPO`        | 3.1       | `your-account/zidcms`                       |
| `GITHUB_TOKEN`       | 3.2       | `github_pat_…`                              |
| `HMAC_SECRET`        | 3.3       | (random)                                    |
| `AUTH_SECRET`        | 3.3       | (random)                                    |
| `GAS_WEBAPP_URL`     | 3.6       | `https://script.google.com/macros/s/…/exec` |
| Admin address        | 3.7       | `https://….vercel.app`                      |
| Site address         | 3.7       | `https://….vercel.app`                      |
| `AUTH_GOOGLE_ID`     | 3.8       | `….apps.googleusercontent.com`              |
| `AUTH_GOOGLE_SECRET` | 3.8       | `GOCSPX-…`                                  |

### 3.1 GitHub: where the code lives

1. Sign up / sign in at <https://github.com>.
2. Click **+** (top right) → **New repository**.
3. Name: `zidcms`. Choose **Public**. Do **not** tick "Add a README". Click **Create repository**.
4. In the terminal (in the `zidcms` folder), connect and upload the code (replace `your-account`):

   ```bash
   git remote set-url origin https://github.com/your-account/zidcms.git
   git push -u origin main
   ```

   (If you get "No such remote", use `git remote add origin …` instead.)
5. Turn on secret protection: in the repo, **Settings → Code security** → enable **Secret scanning** and **Push protection**.

### 3.2 GitHub: a token for publishing

ZidCMS needs limited permission to store site editions in your repository.

1. Click your profile picture → **Settings** → **Developer settings** (bottom left) → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. Fill in:
   - **Token name:** `zidcms-publisher`
   - **Expiration:** 90 days (put a renewal reminder in your calendar)
   - **Repository access:** _Only select repositories_ → choose `zidcms`
   - **Permissions → Repository permissions:**
     - **Contents:** _Read and write_
     - **Commit statuses:** _Read-only_
3. Click **Generate token** and copy the `github_pat_…` token into your secret notebook. It is shown **only once**.

### 3.3 Create two random keys

In the terminal, run this command **twice**. The first result is `HMAC_SECRET`, the second is `AUTH_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 3.4 Google Sheets + Apps Script: the "filing cabinet"

1. Open <https://sheets.google.com>, create a **Blank spreadsheet**, and name it `ZidCMS`.
2. In that spreadsheet: menu **Extensions → Apps Script**. A new tab opens.
3. Click the ⚙️ **Project Settings** icon (left):
   - Copy the **Script ID** into your notebook.
   - Under **Script Properties**, click **Add script property** and add:

     | Property      | Value                             |
     | ------------- | --------------------------------- |
     | `HMAC_SECRET` | the first random key from 3.3     |
     | `ENVIRONMENT` | `prod` (or `dev` for a test site) |

   - Click **Save script properties**.
4. Enable the Apps Script API: open <https://script.google.com/home/usersettings> → turn on **Google Apps Script API**.

### 3.5 Upload the Apps Script code

In the terminal (in the `zidcms` folder):

```bash
npm install -g @google/clasp
clasp login
```

A browser window opens. Choose the same Google account and click **Allow**.

Then create the clasp settings file. Replace `YOUR_SCRIPT_ID` with the Script ID from 3.4:

```bash
cd services/apps-script
node -e "require('fs').writeFileSync('.clasp.json', JSON.stringify({scriptId:'YOUR_SCRIPT_ID', rootDir:'dist'}))"
pnpm build
clasp push
```

If asked whether the manifest may be overwritten, answer **y**. The `.clasp.json` file is never uploaded to GitHub (it is excluded).

### 3.6 Publish Apps Script as a web app

1. Go back to the Apps Script tab and reload the page.
2. Click **Deploy → New deployment**.
3. Click the ⚙️ icon next to "Select type" → choose **Web app**.
4. Fill in:
   - **Execute as:** _Me_
   - **Who has access:** _Anyone_
5. Click **Deploy** → **Authorize access** → choose your account.
   - If you see "Google hasn't verified this app", click **Advanced** → **Go to … (unsafe)**. This is safe because the app is your own.
   - If Google says **"Access blocked"** / `Error 403: access_denied` instead, see the matching row in [Part 4](#part-4-troubleshooting) (link the script to your own Google Cloud project from 3.8).
   - Click **Allow**.
6. Copy the **Web app URL** (ending in `/exec`) into your notebook as `GAS_WEBAPP_URL`.
7. **Create the sheets:** in the Apps Script editor, choose the **`setup`** function in the top drop-down (next to Debug) and click **▶ Run**. Back in the spreadsheet you now have tabs `Posts`, `Pages`, `Settings`, and more. 🎉

> "Who has access: Anyone" sounds scary, but every request must carry a signature made with `HMAC_SECRET`. Without that key, requests are rejected.

### 3.7 Vercel: the "printing press and delivery crew"

You create **two projects**: one for the admin dashboard, one for the public site.

1. Sign up at <https://vercel.com> with your GitHub account and choose the **Hobby** plan (free).
2. **Public site project:**
   1. **Add New → Project** → choose the `zidcms` repo → **Import**.
   2. **Project Name:** e.g. `your-name-web`.
   3. **Root Directory:** click **Edit** → choose `apps/web`.
   4. **Environment Variables:** add two variables: `SITE_URL` = `https://your-name-web.vercel.app` (matching the project name) and `ZIDCMS_ENV` = `prod`. Without `ZIDCMS_ENV` the build fails on purpose.
   5. Click **Deploy**. When it finishes, note the address as your _Site address_.
3. **Admin dashboard project:**
   1. **Add New → Project** → the `zidcms` repo again → **Import**.
   2. **Project Name:** e.g. `your-name-admin`.
   3. **Root Directory:** `apps/admin`.
   4. Click **Deploy** for now (it may fail or show errors when opened; the variables are added in 3.9). Note the address as your _Admin address_.

### 3.8 Google Cloud: the "Sign in with Google" button

1. Open <https://console.cloud.google.com> → click the project picker at the top → **New Project** → name `zidcms` → **Create**, and make sure that project is selected.
2. Open **APIs & Services → OAuth consent screen** (called **Google Auth Platform** in the new layout):
   - Click **Get started**. Enter the app name `ZidCMS Admin` and your e-mail.
   - **Audience:** choose **External**.
   - Finish the steps. Under **Audience → Test users**, add your own Google e-mail.
3. Open **Clients** (or **Credentials → Create credentials → OAuth client ID**):
   - **Application type:** _Web application_
   - **Name:** `zidcms-admin`
   - **Authorized redirect URIs** → **Add URI**:
     `https://your-name-admin.vercel.app/api/auth/callback/google`
     (use your _Admin address_; it must match exactly, including `https://`)
   - Click **Create**.
4. Copy the **Client ID** and **Client secret** into your notebook.
5. While you are here: **APIs & Services → Library** → **Google Drive API** → **Enable** (needed if you link your Apps Script to this project, see Part 4).

The admin login only asks for your name and e-mail, so no Google verification process is needed for it.

### 3.9 Fill in the admin settings on Vercel

In Vercel, open the **admin** project → **Settings → Environment Variables**. Add them one by one:

| Name                    | Value                                                 |
| ----------------------- | ----------------------------------------------------- |
| `AUTH_SECRET`           | the second random key from 3.3                        |
| `AUTH_GOOGLE_ID`        | Client ID from 3.8                                    |
| `AUTH_GOOGLE_SECRET`    | Client secret from 3.8                                |
| `ADMIN_EMAILS`          | your Google e-mail (comma-separated if more than one) |
| `ADMIN_URL`             | _Admin address_, without a trailing slash             |
| `ZIDCMS_ENV`            | `prod`                                                |
| `GAS_WEBAPP_URL`        | from 3.6                                              |
| `GAS_HMAC_SECRET`       | **exactly the same** as `HMAC_SECRET` in 3.4          |
| `PUBLISH_TARGET`        | `github`                                              |
| `GITHUB_TOKEN`          | the token from 3.2                                    |
| `GITHUB_REPO`           | `your-account/zidcms`                                 |
| `GITHUB_BRANCH`         | `main`                                                |
| `VERCEL_STATUS_CONTEXT` | the public site project name, e.g. `your-name-web`    |
| `PUBLIC_SITE_URL`       | _Site address_, without a trailing slash              |

Then open the **Deployments** tab → the three dots on the top deployment → **Redeploy**.

### 3.10 First test 🎉

1. Open your _Admin address_ → **Masuk dengan Google** → choose the account listed in `ADMIN_EMAILS`.
2. **Tulis Artikel Baru** (Write New Post) → fill in a title and content → **Terbitkan** (Publish).
3. Wait until **Tayang** (Live). This takes a few minutes while Vercel builds the site.
4. Open your _Site address_. Your post is online!
5. Also check `https://your-site-address/zidcms-version.json`: the `version` number must match the snapshot shown in the dashboard.

Congratulations, your ZidCMS is online at **$0** cost.

### 3.11 Adding another admin

In the Vercel admin project: change `ADMIN_EMAILS` to `you@example.com,friend@example.com` → **Redeploy**. Also add your friend's e-mail under **Test users** in Google Cloud (3.8).

---

## Part 4: Troubleshooting

| What you see                                                                  | Most likely cause                                                                  | How to fix it                                                                                                                                                                            |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Akses ditolak" (Access denied) when signing in                               | E-mail not in `ADMIN_EMAILS`, or not a Test user                                   | Check 3.9 and 3.8, then Redeploy                                                                                                                                                         |
| Google: `redirect_uri_mismatch`                                               | The address in 3.8 doesn't exactly match the admin address                         | Make them identical, including `https://` and `/api/auth/callback/google`                                                                                                                |
| "Konfigurasi server … belum diatur" (server setting … not configured)         | A variable was forgotten                                                           | Complete the table in 3.9, then Redeploy                                                                                                                                                 |
| "Apps Script tidak dapat dihubungi" / "Respons Apps Script tidak valid"       | Wrong `GAS_WEBAPP_URL`, or the web app isn't deployed                              | Repeat 3.6 and copy the URL ending in `/exec`                                                                                                                                            |
| Code `SIGNATURE_INVALID`                                                      | `GAS_HMAC_SECRET` (Vercel) ≠ `HMAC_SECRET` (Apps Script)                           | Make them identical and watch out for copied spaces                                                                                                                                      |
| "Sheet … belum disiapkan" (sheet … not set up)                                | The `setup` function hasn't been run                                               | Run `setup` in the Apps Script editor (3.6 step 7)                                                                                                                                       |
| Google: "Access blocked" / `Error 403: access_denied` when clicking **Allow** | The script uses Google's default Cloud project, which is blocked from Drive access | Apps Script editor → ⚙️ **Project Settings** → **Change project** → enter the number of your Google Cloud project from 3.8 (where you are a Test user) → **Set project**, then try again |
| `setup` fails: "Izin ditolak saat mengaktifkan API: drive"                    | The Google Drive API isn't enabled in that Cloud project                           | Google Cloud Console → **APIs & Services → Library** → **Google Drive API** → **Enable**, then run `setup` again                                                                         |
| `setup` fails: "dinonaktifkan di prod setelah instalasi pertama"              | `setup` already completed with `ENVIRONMENT` = `prod`                              | Normal: the sheets are ready. This guard prevents accidental schema changes on a real site                                                                                               |
| Publishing sits at "Build Vercel" for a long time                             | Vercel is queueing the build                                                       | Check the Deployments tab in Vercel. It fails automatically after 15 minutes                                                                                                             |
| Fails with `DEPLOY_FAILED`                                                    | The Vercel build failed; the old site stays live                                   | Open the latest deployment log in Vercel, then click **Publikasikan Situs** again                                                                                                        |
| Fails with `VERIFY_TIMEOUT`                                                   | Wrong `PUBLIC_SITE_URL`                                                            | Check the site address in 3.9                                                                                                                                                            |
| Fails with `GITHUB_ERROR`                                                     | The token expired or lacks permissions                                             | Create a new token (3.2) and update it in Vercel                                                                                                                                         |
| Fails with `VALIDATION_ERROR`                                                 | A deleted image is still used by a post                                            | Read the error message and fix the post it names                                                                                                                                         |
| "Item ini telah diubah di tempat lain" (changed elsewhere)                    | The post was edited in another tab or device                                       | Click **Salin konten saya** (Copy my content), then **Muat ulang** (Reload), and paste back what you need                                                                                |
| "Slug … sudah dipakai" (slug already used)                                    | Another post (including archived ones) uses the same address                       | Change the slug                                                                                                                                                                          |
| Image upload rejected                                                         | Larger than 3 MB, or not JPG/PNG/WebP/GIF                                          | Shrink/convert the image (e.g. with squoosh.app)                                                                                                                                         |
| "Spreadsheet sedang sibuk" (spreadsheet busy)                                 | Several saves at the same time                                                     | Wait a few seconds and try again                                                                                                                                                         |
| Red "baris tidak valid" (invalid rows) warning                                | The Google Sheet was edited by hand                                                | Restore the sheet via **File → Version history**                                                                                                                                         |
| The site shows the wrong content                                              | Wrong or unwanted snapshot is live                                                 | **Publikasi & Snapshot → Rollback** (1.12). Emergency: Vercel web project → Deployments → **Instant Rollback**                                                                           |

Still stuck? See [`docs/operations.md`](operations.md) for further steps.

---

## Appendix A: Markdown cheat sheet

| Type this                          | Result                |
| ---------------------------------- | --------------------- |
| `## Section Title`                 | Large section heading |
| `### Subheading`                   | Smaller heading       |
| `**bold**`                         | **bold**              |
| `_italic_`                         | _italic_              |
| `~~strike~~`                       | ~~strike~~            |
| `[link text](https://example.com)` | link                  |
| `- item`                           | bulleted list         |
| `1. step`                          | numbered list         |
| `- [x] done`                       | checkbox              |
| `> quote`                          | block quote           |
| `` `code` ``                       | `code`                |
| Empty line                         | New paragraph         |

Tables:

```markdown
| Name   | Price |
| ------ | ----- |
| Coffee | 2.50  |
```

> HTML such as `<b>` or `<script>` is not executed. It is shown as plain text. This is deliberate, for security.

## Appendix B: Glossary

| Term                     | Meaning                                                                      |
| ------------------------ | ---------------------------------------------------------------------------- |
| **Admin / dashboard**    | The site management pages, only for you                                      |
| **Public site**          | The website readers see                                                      |
| **Draft**                | A post that hasn't been published                                            |
| **Slug**                 | The part of a page address, e.g. `fried-rice-recipe`                         |
| **Markdown**             | A way to format text with simple symbols                                     |
| **Snapshot**             | An "edition" of the site: every published post at one point in time          |
| **Publishing**           | Creating a new snapshot and putting it live                                  |
| **Rollback**             | Returning the site to an earlier snapshot/edition                            |
| **Repo (repository)**    | The project folder stored on GitHub                                          |
| **Commit**               | One recorded change saved in the repo                                        |
| **Deploy / build**       | Vercel's process of building and uploading the site                          |
| **Token / secret**       | A special password for an application; keep it secret                        |
| **Environment variable** | A (secret) setting stored in Vercel instead of in the code                   |
| **Terminal**             | A window for typing commands                                                 |
| **DEV / PROD**           | Test site / real site                                                        |
| **Apps Script**          | Google's small-program platform that connects the dashboard to Google Sheets |
