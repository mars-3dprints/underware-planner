# Contributing

Thanks for helping with Underware Planner. Bug reports, ideas and pull requests are all welcome.

## Reporting bugs and ideas

Open an [issue](https://github.com/mars-3dprints/underware-planner/issues/new/choose) using the bug or feature form. For bugs, attach your layout (**Export** in the top bar) if you can: most problems are easiest to reproduce from the layout itself.

## Setting up

You need Node 22.12 or later (`.nvmrc` pins 22).

```sh
npm install
npm run dev     # http://localhost:5173
```

The README's [Development](README.md#development) section lists the other scripts and how the source is laid out.

## Making a change

1. Fork the repo and branch from `main`.
2. Keep the change focused. Pure logic belongs in `src/domain/`, `src/routing/` or `src/bom/`, with unit tests next to it. React code belongs in `src/features/`, `src/app/` or `src/ui/`.
3. Add or update tests for behaviour you change. Snapshot tests pin routing, channel centerlines and the bill of materials, so an unexpected snapshot change means behaviour changed. Update a snapshot (`npx vitest run -u`) only when the change is intended.
4. For UI changes, check the app in the browser in both light and dark themes.
5. Run `npm run check` (typecheck, lint, format check and tests) and `npm run build`. Both must pass.
6. Add a line to `## [Unreleased]` in `CHANGELOG.md` if users will notice the change. Keep it to one concise line about what changed for them.
7. Don't change the saved layout format (`doc`, `objects`, `cables` and their fields) without a migration in `src/domain/migrate.ts`. People's autosaves and exported files depend on it.

## Commits and pull requests

- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/): `feat: …`, `fix: …`, `docs: …`, `refactor: …`, `test: …`, `chore: …`, with a short one-line subject.
- Open the pull request against `main` and fill in the template. Small pull requests are reviewed faster.
- Pull requests are squash-merged.

## Releases

Releases are done by the maintainer: a version bump on `main` publishes the GitHub Release and deploys the site (see [Releases](README.md#releases)). Please don't bump the version or move changelog entries out of `[Unreleased]` in a pull request.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
