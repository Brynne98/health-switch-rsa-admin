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
- Issues: Linear, team Brynne (`BP`), project **Health Switch RSA**. Built under
  BP-211.
- Sibling: `../health-switch-rsa-app` (private) is the iPhone app **and** the
  Convex backend. The admin's server functions live there, in `app/convex/`,
  because both share one Convex deployment. This repo is only the website.

# Releasing

- **Frontend:** GitHub Pages, built on every push to `main`.
- **Backend:** the admin functions ship with the app repo's
  `./build-and-submit.sh --check` (dev, then prod).
- Never commit, push or deploy without Brynne's say-so, every time.

# Secrets

Nothing secret goes in this repo, ever: not the Google client secret, not the
RevenueCat key, not the owner's email. They live in the Convex environment,
pasted by Brynne. The Convex URL and Google's client ID are public by design.
