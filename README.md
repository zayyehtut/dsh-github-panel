# dsh-github-panel

A GitHub management panel for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web UI. It manages the GitHub account that is already signed in on your PC through the GitHub CLI — the panel never asks for, displays or stores a token.

## What you get

- **Connection card** — connected as `@login` via the GitHub CLI, token scopes, with **Re-check** and **Disconnect**.
- **Repository dashboard** — total / owned / public / private / archived counts, description and topic coverage.
- **Needs attention checklist** — missing descriptions or topics, empty repositories, unused forks, profile README, profile bio, pins and duplicate gists.
- **Repository list** — searchable and filterable, with inline **Edit details** (description + topics), **Archive / Unarchive**, **Rename** and **Open on GitHub**.
- **Profile & pins** — profile README status, pin count and suggestions, plus links for the two things the GitHub API cannot change from code (pins and profile name/bio).
- **Recent actions** — an in-memory log of what the panel changed in this session.
- **Deep analysis** — a read-only health report per repository (README quality, license, `.gitignore`, CI, tests, possible secrets) with safe fixes you can apply: MIT license, `.gitignore`, README status section.

## Requirements

- The DeepSeek Harness app with its Web UI (the panel is a Harness profile bundle).
- The **GitHub CLI** (`gh`) installed and signed in (`gh auth login`). The panel calls `gh`; it never reads the token itself.
- Tested on Windows 10/11. Other platforms use `gh` from `PATH` and are untested.

## Install

The panel ships as a DeepSeek Harness profile bundle.

1. Clone this repository anywhere on the machine:

   ```powershell
   git clone https://github.com/zayyehtut/dsh-github-panel.git
   ```

2. Add it to your DSH profile's `package.json` (for the desktop app: `%USERPROFILE%\.dsh\profiles\<profile>\package.json`) as a linked dependency and a bundle:

   ```json
   {
     "dependencies": {
       "@local/dsh-github-panel": "link:C:/path/to/dsh-github-panel"
     },
     "dsh": {
       "profile": {
         "bundles": [
           "@deepseek-ai/dsh-base",
           "@deepseek-ai/dsh-web-app",
           "@local/dsh-github-panel"
         ]
       }
     }
   }
   ```

3. Let the profile install its dependencies (the Harness plugin manager does this for you, or run `pnpm install` in the profile folder).

4. Reload the Harness window (or restart the app). A **GitHub** icon appears in the left rail; the panel opens in the main column.

No token, API key or environment variable is required.

## Configuration

The panel finds `gh` in the standard install locations or on `PATH`, and uses whatever login `gh` already has.

- **`DSH_GITHUB_CONFIG_DIR`** — optional. If your `gh` configuration lives somewhere non-standard (for example, a sandboxed workspace that cannot write `%APPDATA%`), point this at that directory before starting the Harness. Otherwise the panel falls back to `gh`'s own default.

## Safety model

- Every HTTP route is **loopback-only** (`127.0.0.1`).
- Every mutation additionally requires the `x-dsh-github-panel: 1` header, so a random web page cannot trigger a change.
- Mutations re-read the repository from GitHub first and require admin rights; descriptions and topics are validated again on the host side.
- The code never reads the token — only the GitHub CLI does.
- The panel writes nothing to disk; the action log is in memory and clears on restart.
- This build deliberately registers **no agent tools at activation**; the panel is a UI, not an automation surface.

## Limits

- Pinned repositories and profile name/bio have no GitHub write API — the panel links to the right GitHub page and re-reads the result on refresh.
- Repository deletion is not offered (it needs the `delete_repo` scope). Archiving is available.
- The panel does not run git operations (commits, pushes, releases); it manages account and repository metadata only.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "GitHub is not connected on this PC" | Run `gh auth login`, confirm with `gh auth status`, then press **Re-check**. |
| Panel icon is missing | Check that the bundle is in the profile's `dsh.profile.bundles` list, reinstall the profile dependencies, then reload the window. |
| Wrong account shown | `gh auth switch` (or `gh auth login`) for the right account, then **Re-check**. |
| `gh` not found in a sandboxed host | Set `DSH_GITHUB_CONFIG_DIR` for the config directory; make sure `gh` is installed for the user that runs the Harness. |

## License

MIT — see [LICENSE](LICENSE).

[![](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)
