# Co-founder

A local business workspace combining Slack messaging, bespoke business applications, Lovable integration, and agents. The frontend and native messaging foundation are adapted from [Block's Buzz](https://github.com/block/buzz).

## Source layout

- `outputs/buzz/`: Buzz source with the Co-founder frontend changes, including the Slack interface and Business applications. The upstream license and attribution are preserved here.
- `outputs/cofounder-backend/`: Node backend for Slack OAuth/synchronization, business pages, agents, Gmail workflows and Lovable integration.
- `outputs/native-browser-test/`: macOS browser-host proof of concept for Lovable's editor and private previews. This is a prototype, not the production desktop integration.
- `outputs/*.md`: implementation notes and dated validation reports. Older reports describe the app as it existed at the time.
- `outputs/start-mvp.cjs`: resumes an already-configured local development instance.

## Development status and setup

This repository is a source snapshot of the current local MVP. It is not a deployed service or a one-command fresh installation. The current startup scripts depend on private local configuration under `work/backend-test`, including development identities, database configuration and OAuth connections. Those files, credentials, browser sessions, local message databases and installed dependencies are intentionally excluded.

Frontend dependencies and tooling are described in `outputs/buzz/desktop/package.json` and Buzz's contributor documentation. Backend dependencies are in `outputs/cofounder-backend/package.json`; install them with `npm ci` in that directory. Frontend development uses the `live-test` Vite mode on ports 5174/5175 and the backend on port 5180. The special local test-session mode is deliberately blocked from production builds.

Before running on another computer, provisioning fresh local identities, database configuration and OAuth connections is required. Do not put real secrets in source control. Lovable's full editor/private preview works in the separate native host proof; the ordinary web route still has the documented embedding limitation.

## Licensing

Buzz code retains its upstream license in `outputs/buzz/LICENSE` and existing notices. This private repository does not grant an additional license for the application-specific additions.
