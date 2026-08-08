# 🎲 Lucky Draw Pro

A real, multi-user Lucky Draw web app. People create free accounts, run their own draws, and everything — participants, winners, history — is saved permanently in a real database instead of just the browser. It also includes an Admin Dashboard for you to oversee every user and every draw.

**Stack:** plain HTML/CSS/JavaScript (no build step) + [Supabase](https://supabase.com) (database + accounts) + GitHub + Vercel.

---

## PART 1 — What this website does

- Anyone can create a free account and log in.
- After logging in, a user gets their own **Dashboard**: they create draws, add participant names, and click "Pick Lucky Winner" — same drawing animation and confetti as before.
- Every draw, participant, and winner is saved to a real database (Supabase), so nothing is lost on refresh, and it's the same on any device they log in from.
- **You** (or anyone you promote to Admin) get an **Admin Dashboard** to see every user, every draw, every winner, and system activity — with search, filters, and CSV export.
- Security is enforced by the database itself (not just the website code), so a user genuinely cannot see or touch another user's data.

---

## PART 2 — How the project works (big picture)

- **Supabase** is a hosted database + login system. You create a free project, paste in one SQL file to build the tables, and Supabase gives you two values (a URL and a public key) to connect your website to it.
- **The website** is plain HTML pages — no build tools, no npm install required to preview it. It talks to Supabase directly from the browser using those two values.
- **Vercel** hosts the website itself and serves the HTML/CSS/JS files. It doesn't need to know anything about Supabase — the connection happens entirely in the browser.

---

## PART 3 — Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign up (free).
2. Click **New Project**.
3. Give it a name like `lucky-draw`, set a database password (save it somewhere safe), pick a region close to you, and click **Create new project**.
4. Wait about a minute while it sets itself up.

---

## PART 4 — Create the database

1. In your new Supabase project, open the left sidebar and click **SQL Editor**.
2. Click **New query**.
3. Open the file `supabase/schema.sql` from this project, copy its entire contents, and paste it into the SQL editor.
4. Click **Run** (bottom right).
5. You should see "Success. No rows returned." That means all your tables, security rules, and triggers were created.

---

## PART 5 — Get your Supabase URL and Anon Key

1. In Supabase, go to **Project Settings** (gear icon) → **API**.
2. Copy the **Project URL** (looks like `https://xxxxxxxx.supabase.co`).
3. Copy the **anon / public** key (a long string starting with `eyJ...`).

**Important:** only ever use the **anon/public** key in the website. Never copy the **service_role** key anywhere in this project — that one must stay secret.

---

## PART 6 — Where to put those values

1. Open the file `js/config.js` in this project.
2. Replace the two placeholder lines with your real values:

```js
window.SUPABASE_CONFIG = {
  url: "https://xxxxxxxx.supabase.co",
  anonKey: "eyJ...your-long-anon-key..."
};
```

3. Save the file. That's the only configuration step needed anywhere in the project.

---

## PART 7 — Create your first account

1. Preview the site locally (just double-click `index.html`, or wait until it's deployed on Vercel — either works).
2. Click **Create Account**, fill in your name, email, and a password (6+ characters).
3. You're now logged in as a normal **User**.

---

## PART 8 — Make your account an Admin

By default, every new signup is a regular "user" — nobody can make themselves an admin from the website (that's an intentional security rule). You promote your own account using SQL, once:

1. In Supabase, go to **SQL Editor** → **New query**.
2. Run this, replacing the email with the one you signed up with:

```sql
update public.profiles
set role = 'admin'
where email = 'you@example.com';
```

3. Click **Run**. Log out and log back in on the website — you'll now see an **Admin** link in the header.

---

## PART 9 — Upload the project to GitHub

### Option A — GitHub website (easiest, works great on your phone) ✅ Recommended

1. Go to [github.com](https://github.com) and sign in (your account: **Ishor22**).
2. Tap **+** → **New repository**, name it `lucky-draw-pro`, keep it Public, and create it.
3. Tap **Add file → Upload files**.
4. Select **all the files and folders** from this project (`index.html`, `login.html`, all the others, plus the `css`, `js`, and `supabase` folders) and upload them together.
5. Add a commit message like "Initial upload" and tap **Commit changes**.

### Option B — Git command line

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/Ishor22/lucky-draw-pro.git
git push -u origin main
```

**For you: use Option A.**

---

## PART 10 — Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with your GitHub account.
2. Click **Add New… → Project**.
3. Select your `lucky-draw-pro` repository.
4. Vercel will detect it as a static site — leave all settings as default (no build command needed).
5. Click **Deploy**.
6. In under a minute you'll get a live link like `lucky-draw-pro-yourname.vercel.app`.

Because every page is a real `.html` file (not client-side routing), Vercel serves them all correctly with zero extra configuration.

---

## PART 11 — Vercel environment variables

**You don't need any.** The Supabase URL and anon key live in `js/config.js`, which is safe to include directly in the project (the anon key is designed to be public — real security comes from the Row Level Security rules in `schema.sql`, not from hiding this key). So there's nothing to add in Vercel's Environment Variables screen for this project.

---

## PART 12 — How to update the website later

Whenever you want to change something (colors, text, features):

1. Ask Claude to make the specific change to the relevant file (e.g. "change the accent color in css/style.css to blue").
2. On GitHub, open the file you need to change → the pencil (✏️) icon → paste in the new content → **Commit changes**.
3. Vercel automatically redeploys within a minute or two — nothing else to do.

If you ever change the database structure (add a new table or column), you'll write a small new SQL snippet and run it in Supabase's SQL Editor the same way you ran `schema.sql`.

---

## Project file structure

```
lucky-draw-pro/
├── index.html            ← public landing page
├── login.html
├── register.html
├── forgot-password.html
├── reset-password.html
├── dashboard.html        ← user dashboard (protected)
├── draw.html             ← create/run a specific draw (protected)
├── profile.html          ← edit name/password (protected)
├── admin.html            ← admin dashboard (protected, admin-only)
├── css/
│   ├── style.css         ← shared design tokens + components
│   ├── auth.css          ← login/register/reset pages
│   ├── dashboard.css     ← dashboard, draw workspace, profile
│   └── admin.css         ← admin sidebar layout
├── js/
│   ├── config.js         ← ← paste your Supabase URL + anon key here
│   ├── supabase.js       ← connects to Supabase
│   ├── auth.js           ← sign up / log in / log out / session checks
│   ├── utils.js          ← shared helpers (toasts, dates, CSV export…)
│   ├── dashboard.js
│   ├── draw.js
│   ├── profile.js
│   └── admin.js
├── supabase/
│   └── schema.sql        ← paste this into Supabase's SQL Editor
├── README.md
└── .gitignore
```

---

## Final testing checklist

- ☐ Ran `supabase/schema.sql` successfully in Supabase
- ☐ Pasted real URL + anon key into `js/config.js`
- ☐ Created an account and could log in
- ☐ Logged out and back in — session persists after refresh
- ☐ Created a draw, added/removed participants
- ☐ Ran a draw — animation, confetti, and winner all work
- ☐ Winner appears in that draw's Winner History
- ☐ Promoted your account to admin via SQL and saw the Admin link appear
- ☐ Admin dashboard shows Users, Draws, Participants, Winners, Activity Logs
- ☐ CSV export works for each admin table
- ☐ Tried logging in as a second (non-admin) account — confirmed it cannot see the first account's draws
- ☐ Tested Forgot Password → received email → could set a new password
- ☐ Checked the site on a phone screen — sidebar, tables, and forms all adapt
- ☐ Site deployed on Vercel and reachable at its `.vercel.app` link
