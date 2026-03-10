# Supply Chain Control Tower

## Quick preview (no npm required)
If your environment blocks npm package installs, you can still preview the blueprint immediately:

```bash
python3 -m http.server 4173 --directory docs
```

Then open:
- `http://localhost:4173/preview.html`

This renders the Inventory Management App Blueprint and module layout from local static files.

## Full app run (when npm access is available)
```bash
npm install
npm run dev
```
Open `http://localhost:3000/dashboard`.
