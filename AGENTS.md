# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains the React app (`main.jsx`, `App.jsx`), shared UI in `src/components/`, constants in `src/constants/`, and helpers in `src/utility/`.
- `src/assets/` stores frontend assets; `public/` is for static files served by Vite.
- `server/` is a separate Node/Express backend with its own `package.json` and dependencies.
- `dist/` is the Vite build output (ignored by tooling like ESLint).

## Build, Test, and Development Commands
From repo root:
- `npm run dev` — start the Vite dev server.
- `npm run build` — create the production build in `dist/`.
- `npm run preview` — serve the production build locally.
- `npm run lint` — run ESLint on `*.js`/`*.jsx`.

From `server/`:
- `npm install` — install backend dependencies.
- `node index.js` — start the Express server (adjust if you use `index_new.js`).

## Coding Style & Naming Conventions
- JavaScript/JSX only; ES modules (`type: module`).
- Indentation appears to be 2 spaces in config files; follow existing file style.
- ESLint is configured via `eslint.config.js` with React Hooks + React Refresh rules.
- Keep React components in `PascalCase` (e.g., `MyWidget.jsx`) and hooks in `camelCase`.

## Testing Guidelines
- No test framework is configured in the root project.
- The `server/` package has a placeholder test script only.
- If you add tests, document the framework and provide a `npm run test` script.

## Commit & Pull Request Guidelines
- Only one commit exists (`first commit`), so no commit message convention is established.
- Prefer clear, imperative messages (e.g., `Add wallet connect flow`).
- PRs should include a concise description, key screenshots for UI changes, and linked issues when applicable.

## Configuration & Secrets
- Backend uses `dotenv`; store secrets in a local `.env` inside `server/` and never commit it.
- If adding new environment variables, update any setup docs accordingly.
