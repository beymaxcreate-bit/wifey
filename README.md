# Ask Wifey — PAW V1.4

V1.4 turns Ask Wifey from a fixed finance tracker into a teachable rule-based money manager.

## New in V1.4

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

V1.4 still stores data in browser localStorage. Export backups before clearing browser data. Cloud sync / login should be the next major infrastructure upgrade.
