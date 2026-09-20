# Ask Wifey — PAW V1.4.4

V1.4.3 turns Ask Wifey from a fixed finance tracker into a teachable rule-based money manager.

## New in V1.4.3

- Cute strict Wifey PWA icon for iPhone / Android
- Teach Wifey page
- Custom enforceable money rules
- Wifey Memory with keyword triggers
- Rule presets for minimum personal balance, large purchases, project money, debt-first spending, income splits, and owner draws
- Strict / Ask me first / Warn me rule modes
- Purchase checks now evaluate your rules
- Relevant memories appear in purchase verdicts
- Income auto-split rules change Wifey's allocation suggestion
- Business-to-personal transfer rules are enforced
- Custom reminders can appear in the Wifey Briefing
- Existing V1.3 local data is migrated automatically

## Run locally

```bash
python -m http.server 8080 --bind 0.0.0.0
```

Then open http://localhost:8080.

## Important

V1.4.3 still stores data in browser localStorage. Export backups before clearing browser data. Cloud sync / login should be the next major infrastructure upgrade.

## V1.4.3 mobile / iPhone fixes

- ships the complete `icons/` directory with 180px, 192px and 512px Wifey icons
- adds cache-busted Apple touch icons and PWA assets
- adds a mobile **More** bottom sheet with Wallets, Projects, Budgets, Commitments, Teach Wifey and Settings
- adds a compact **Wifey Tools** section on Home
- shows correct iPhone Safari installation instructions instead of relying on `beforeinstallprompt`
- improves modal and bottom-sheet safe-area handling on iPhone
- uses a network-first navigation strategy so new Vercel deploys are less likely to stay stuck behind an old service-worker cache

After deploying this version, remove the old Ask Wifey Home Screen icon from iPhone once, reopen the live site in Safari, and use **Share → Add to Home Screen** so iOS fetches the new icon.


## V1.4.3 creator signature

- Added a subtle footer: `Made with 💋 by Buddhima Jaya Sri`.
- Added a short branded launch screen using the Wifey icon with `A personal money manager by Buddhima Jaya Sri`.
- Bumped PWA/cache asset version to `14201`.


## V1.4.3 — Wifey reactions
- Happy celebration overlay when real income arrives.
- Special client-payment celebration with project-money reminder.
- Borrowed money gets a watchful, non-celebratory reaction.
- Approved purchases get a proud Wifey reaction.
- Tight / optional spending triggers worried or sad Wifey.
- Rejected purchases trigger an angry animated reaction and subtle screen shake.
- Overriding a caution triggers an “I warned you” reaction.
- Direct expense entry is also classified after saving, so Wifey reacts even when you skip Ask Wifey.
- Emoji particles, mobile vibration where supported, and reduced-motion accessibility support.


## V1.4.4 — iPhone keyboard + reaction fixes

- Mobile form controls are forced to 16px+ so iOS Safari no longer auto-zooms the whole PWA when typing.
- Modal forms no longer auto-focus and summon the iPhone keyboard as soon as they open.
- Uses the Visual Viewport API to track the actual visible height while the keyboard opens/closes.
- Modal sheets resize to the visible viewport and focused fields scroll into view.
- Wifey reactions now dismiss the keyboard and wait briefly for the viewport to recover before celebrating / yelling.
- Reaction layouts scale down gracefully on very short visible screens.
- PWA/cache version bumped to `14401`.
