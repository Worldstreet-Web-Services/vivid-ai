# vivid-web

The app template the builder starts every project from: Vite, React 19,
TypeScript, Tailwind CSS v4, shadcn/ui (button, card, input, dialog,
dropdown-menu, tabs, badge, sonner). The dev server runs on port 5173.

- `template.py` builds the E2B template (`E2B_API_KEY=... python template.py`).
- `start.sh` is what the sandbox runs on boot.
- For the backend's local sandbox driver, run `npm install` here once; the
  driver copies this directory, node_modules included, per project.
