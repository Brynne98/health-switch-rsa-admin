# Where this lives

- **GitHub**, public: `Brynne98/health-switch-rsa-admin`. Public on purpose: it
  holds no keys and no data, and every server function it calls refuses anyone
  but the owner.
- Remote is SSH (`git@github.com:Brynne98/health-switch-rsa-admin.git`).
  `ssh -T git@github.com` must answer "Hi Brynne98!" before any push; this
  machine has two GitHub logins.
- Commits use the GitHub noreply address
  (`36798170+Brynne98@users.noreply.github.com`, set in this repo's git config)
  so the Gmail address is not published. Keep it that way.
- Branch: `main`.
- Issues: Plane, workspace `brynne98`, project **Health Switch RSA** (tickets
  `HSR-*`; older ones are `BP-*` in Linear). Built under Linear
  BP-211.
- Sibling: `../health-switch-rsa-app` (private) is the iPhone app **and** the
  Convex backend. The admin's server functions live there, in `app/convex/`,
  because both share one Convex deployment. This repo is only the website.

# Releasing

- **Frontend:** Cloudflare Pages project `health-switch-admin`, built on every
  push to `main` (`npm run build`, output `dist`). Served at
  https://admin.healthswitch.co.za (HSR-161). Was GitHub Pages until 8 Nov 2026.
- **Backend:** the admin functions ship with the app repo's
  `./build-and-submit.sh --check` (dev, then prod).
- Never merge, push or deploy without Brynne's say-so, every time. Commits on
  a ticket's own branch need no say-so; a commit straight to `main` does.

# Secrets

Nothing secret goes in this repo, ever: not the Google client secret, not the
RevenueCat key, not the owner's email. They live in the Convex environment,
pasted by Brynne. The Convex URL and Google's client ID are public by design.

# Sign-in

Google only (HSR-139). The server (`app/convex/auth.ts`) refuses any Google
account whose verified email isn't ADMIN_EMAIL, and `admin.ts` checks again in
every function. Convex env needs AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET and
SITE_URL, the bare origin (`http://localhost:5173` on dev,
`https://admin.healthswitch.co.za` on prod).
