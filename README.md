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

## Environment

AI Document Intake requires server-side OpenAI credentials:

```bash
OPENAI_API_KEY=sk-...
# Optional single-tenant organization id used for intake audit rows.
AI_INTAKE_ORGANIZATION_ID=00000000-0000-0000-0000-000000000000
# Optional model override. Defaults to gpt-4o-mini.
OPENAI_INTAKE_MODEL=gpt-4o-mini
```

Apply `docs/supabase-ai-intake.sql` in Supabase before using the intake page.

## Roadmap

- [AI Document Intake](docs/ai-document-intake-roadmap.md): classify uploaded or pasted operational documents, prefill the matching workflow form, and require user review before save.
