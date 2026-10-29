# Cyber Entertainment: website and admin panel

A fast static website (in `public/`) with a small Node server and an admin panel at `/admin`.
No npm packages are needed. **Everything on the site can be changed from the admin panel.**

## What the admin panel controls

| Tab | What it controls |
|---|---|
| Bookings | Booking requests from the Contact form: status, notes, add by hand, delete, CSV export |
| Subscribers | Newsletter emails (add, remove, CSV export) |
| Events | Upcoming events, flyers, line-ups, ticket prices and links (past events hide themselves) |
| News | Posts shown on the News page and as "Latest news" on the home page |
| DJs | DJ and MC profiles, photos, nicknames, genres, social links, show/hide, order |
| Mixtapes | YouTube/HearThis/Mixcloud/Spotify links or uploaded audio, per DJ |
| T-shirts | Store products, prices, sizes, images |
| Gear | Gadget-hire items and prices |
| Academy & packages | Add, edit, reorder or hide Academy modules, event packages and the "Events we cover" list |
| **Pages & text** | **Every heading, paragraph, button and link, every image and video, the header menu and footer, and the page title and description (for Google) of every page. You can also hide whole sections.** |
| FAQ | Questions and answers |
| Gallery | Gallery photos and videos with captions |
| Media | All uploaded files, what is in use, delete unused |
| Settings | Phone, WhatsApp number, email, address, hours, TikTok, YouTube, Instagram, Facebook (used across the whole site) |
| Backup | Back up now, download, restore |
| Account | Change the admin password |

Changes show on the live site within about 10 seconds. In **Pages & text**, use `**bold**`, `*italic*` and new lines in text. For a link you can type a full address (`https://...`), a page (`contact.html`) or `mailto:` / `tel:`.
To put back the original text of an item, clear its box and save.

## Run it on your computer

1. Install Node.js 18 or newer.
2. In this folder run: `node server.js`
3. Open http://localhost:3000 for the site and http://localhost:3000/admin for the admin panel.

Your existing admin password is read from `data/db.json`, so it keeps working.
Forgot it? Start with `RESET_ADMIN_PASSWORD=1 ADMIN_PASSWORD=YourNewPassword node server.js`, sign in, then start normally again.
In this local mode data is stored in `data/db.json` and uploads in `data/media/`.

## Put it online (Vercel + Supabase)

Vercel's file system is read-only, so online you need Supabase for storage.

1. Create a Supabase project. In **SQL Editor** paste and run `supabase/schema.sql`.
2. In **Project Settings > API** copy the Project URL and the `service_role` key (treat it like a password).
3. Push this folder to GitHub and import it in Vercel (Framework Preset: Other; leave Build and Output empty).
4. In Vercel **Settings > Environment Variables** add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Optional: `ADMIN_PASSWORD` (only used if no password exists yet) and `SESSION_SECRET` (any long random text).
5. Deploy and open `/admin`. The first visit imports your starter content and photos into Supabase.
6. After that works, delete `data/db.json` from the repository (it holds your old password hash).
7. When you have a domain, run `node scripts/set-domain.js https://www.yourdomain.com` once so link previews show the picture.

## If you edit the HTML files yourself

Run `node scripts/cms-tag.js` afterwards. It marks any new text, images, videos and sections so they appear in **Pages & text**, and keeps existing ones. Areas filled from the database (marked `data-live`, `data-s`, `data-ct`) are skipped on purpose.

## How the forms work

- **Contact form:** saves the request to Bookings, then opens WhatsApp with the details ready to send.
- **Newsletter form:** saves the email to Subscribers.
- **Store:** "Order on WhatsApp" opens WhatsApp with the item and size (orders are not stored in Bookings).

## Security

Admin sessions use signed HttpOnly cookies, passwords are scrypt hashes, login attempts are rate-limited and every admin change needs a custom request header (CSRF protection). Page edits from the admin are applied with safe DOM calls (never raw HTML). Never commit `.env` files or keys.
