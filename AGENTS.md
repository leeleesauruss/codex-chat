# Repository Guidelines

## Project Structure & Module Organization
- App root: `Console-Chat/`. Renderer mounts at `src/index.tsx` → `src/App.tsx`; shared UI lives in `src/components/` (Sidebar, ChatWindow, Settings/Optimization modals, ThemeBrowserModal).
- State/persistence: `src/store.ts` (Zustand + immer) saves settings, chats, folders, and catalog theme picks via `window.electronAPI`.
- Electron: `src/main.ts` (main) + `src/preload.ts` (IPC bridge). Keep renderer IPC behind preload and types in `electron.d.ts`.
- Styling tokens and theme data attributes: `src/index.css`. LLM helpers: `src/llm/`. Config/build files: `forge.config.ts`, `vite.*.config.ts`, `.eslintrc.json`, `tsconfig.json`. CLI shim: `bin/cli.js`.

## Build, Test, and Development Commands
- From `Console-Chat/`: `npm ci` (or `npm install`) to sync deps; target Node 18+ for Electron 40 + Vite 5.
- `npm start` – `electron-forge start` with Vite HMR and main-process reload.
- `npm run lint` – ESLint on `.ts/.tsx` per `.eslintrc.json`.
- `npx vitest` (watch) or `npx vitest run` – unit tests.
- `npm run package` (unsigned app), `npm run make` (installers), `npm run publish` (release flow).

## Coding Style & Naming Conventions
- TypeScript + React with functional components/hooks; 2-space indent, single quotes, semicolons, imports ordered external → internal.
- Components/modals use `PascalCase`; hooks/helpers `camelCase`; file names mirror the default export. Store mutators follow `setX`/`updateX`.
- Renderer never imports `electron`; new IPC channels live in `preload.ts` and are typed in `electron.d.ts`.
- Themes use `data-bs-theme` and `data-theme-name`; scope catalog CSS to selectors like `body[data-theme-name=\"slug\"]` to prevent bleed.

## Testing Guidelines
- Co-locate specs as `*.test.ts(x)`; mock `window.electronAPI` and assert store transitions (chat CRUD, folder moves, streaming append, theme apply/reset).
- Run `npm run lint` and `npx vitest run` before packaging or sharing builds; capture screenshots when theming/layout shifts.

## Commit & Pull Request Guidelines
- Use short, imperative subjects with conventional prefixes (`feat:`, `fix:`, `chore:`).
- Summarize UI/theming changes with screenshots or GIFs; note commands executed (`npm run lint`, `npx vitest run`, `npm start`).
- Call out new env vars, persisted keys, IPC channels, or Forge/Electron config edits; specify target OS/arch when touching packaging.

## Theming & UX Notes
- Sidebar toggle switches light/dark; Theme Catalog modal fetches Obsidian community themes from GitHub, caches selection, and exposes “Reset to default.”
- Keep downloaded CSS small and scoped; preserve `modes` metadata (light/dark) so previews align; fall back to the default palette if fetch fails.
