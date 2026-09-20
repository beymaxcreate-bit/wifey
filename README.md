# Ask Wifey — PAW V1.3

V1.3 keeps the V1.2 money logic and gives the app a more playful, character-led **Wifey** experience.

## New in V1.3
- Warm premium Wifey visual system: rose, butter, mint and dark cocoa tones.
- Dynamic **Wifey mood** based on safe-to-spend money, overdue commitments, budgets and open business tasks.
- Wifey avatar and speech-bubble briefing on the home screen.
- More playful mobile navigation and stronger phone-first styling.
- New Wifey microcopy across spending verdicts, income, transfers, budgets and backups.
- Approved / caution / rejected verdict reactions with subtle motion.
- Existing V1.2 local data remains compatible because the same local storage key is used.

## Run locally
From this folder:

```bash
python -m http.server 8080 --bind 0.0.0.0
```

Then open `http://localhost:8080` on the computer. On a phone connected to the same Wi-Fi, open `http://YOUR-PC-IP:8080`.

## Important
This is still a local-first prototype. Before real deployment, the next major technical step should be Supabase authentication + cloud sync so phone and laptop share the same data.
