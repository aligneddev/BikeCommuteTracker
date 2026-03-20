# Commute Bike Tracker

Local-first Bike Tracking application built with .NET Aspire orchestration, .NET 10 Minimal API, F# domain modules, and a React frontend.

## Current Feature Slice

- Local user signup with name and PIN
- PIN protection through salted, non-reversible hashing (PBKDF2)
- Duplicate-name rejection using trimmed, case-insensitive normalization
- User identification with progressive retry delay (up to 30 seconds)
- User registration outbox with background retry until successful publication

## Project Structure

- src/BikeTracking.AppHost - Aspire orchestration host
- src/BikeTracking.Api - Minimal API service
- src/BikeTracking.ServiceDefaults - Shared Aspire defaults and telemetry wiring
- src/BikeTracking.Domain.FSharp - Domain event and type modules (F#)
- src/BikeTracking.Frontend - React + Vite frontend app

## Prerequisites

### Recommended: DevContainer (All-in-One Setup)

**This project is optimized for development inside a DevContainer.** All tools, runtimes, and dependencies are pre-configured.

1. Install [Visual Studio Code](https://code.visualstudio.com/) and the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
2. Open the repository in VS Code
3. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS), type "Dev Containers: Open Folder in Container", and select it
4. VS Code will build and start the DevContainer (first run takes ~2-3 minutes)
5. Once connected, all dependencies are ready:
   - .NET 10 SDK
   - Node.js 24+ with npm
   - CSharpier for code formatting
   - Recommended VS Code extensions pre-installed

### Local Development (If Not Using DevContainer)

- .NET SDK 10.x
- Node.js 24+ and npm
- CSharpier global tool (required for formatting checks):

```powershell
dotnet tool install csharpier -g
```

run it with `csharpier format .` from the repo root to format all C# code.

- Helpful editor integration: VS Code CSharpier extension (`csharpier.csharpier-vscode`)

## Quick Start

### Inside DevContainer

Once the DevContainer is connected (see Prerequisites above), all dependencies are pre-installed. Open a terminal in VS Code and run:

```bash
dotnet run --project src/BikeTracking.AppHost
```

The Aspire AppHost will:
- Build the entire solution
- Start the API service
- Start the React frontend (compiled)
- Open the Aspire Dashboard at `http://localhost:19629`

From the dashboard, launch the frontend and API services.

### Local Development (Without DevContainer)

1. Install frontend dependencies:

```powershell
cd src/BikeTracking.Frontend
npm install
```

2. Run the full local app through Aspire:

```powershell
cd ../.. 
dotnet run --project src/BikeTracking.AppHost
```

3. Open Aspire dashboard and launch:
- frontend service for the signup and identify screen
- api service for local identity endpoints

## Git Credentials Setup (DevContainer)
### Recommended Workflow

**For local development** (Windows/macOS/Linux with VS Code):
1. Generate SSH key on host machine (one-time setup)
2. Add public key to GitHub
3. Use SSH URLs in Git commands
4. Container automatically inherits SSH keys via mount

**For CI/CD (GitHub Actions)**:
- Use SSH deploy keys or GITHUB_TOKEN (built-in to Actions)
- SSH deploy keys are safer than personal access tokens

**For remote development (GitHub Codespaces, Dev Container in cloud)**:
- Use Git credential helper + GitHub Personal Access Token
- Or configure SSH agent forwarding if available

The DevContainer is pre-configured for seamless Git operations with support for multiple credential approaches:

### Option 1: SSH Keys (Recommended for Local Development)

**Local development with SSH keys works automatically:**

```bash
# Inside the DevContainer terminal, SSH keys from ~/.ssh are mounted as read-only
# Test connectivity:
ssh -T git@github.com

# Now git clone/push/pull work with SSH URLs:
git clone git@github.com:your-org/your-repo.git
git push origin my-branch
```

**Why this works**: The DevContainer mounts your host machine's `~/.ssh` directory into the container at `/root/.ssh` (read-only for safety). Your existing SSH keys and config are available without duplication.

**First-time setup (if SSH key not yet on GitHub)**:
1. Generate a new key on your host machine (outside container):
   ```bash
   ssh-keygen -t ed25519 -C "your-email@example.com"
   ```
2. Add the public key to your GitHub account ([GitHub SSH settings](https://github.com/settings/keys))
3. Inside the container, test with `ssh -T git@github.com`

### Option 3: SSH Agent Forwarding (For Forwarded Keys)
You can't chmod a bind mount directly, but the clean solution is to mount to a different path and use postCreateCommand to copy and fix permissions. Here's what I'd change in devcontainer.json:


If your SSH key is protected with a passphrase and hosted on a remote machine:

```bash
# Add to .devcontainer/devcontainer.json to forward SSH agent:
# (requires SSH agent running on host machine)
"forwardPorts": [22],
"remoteEnv": {
  "SSH_AUTH_SOCK": "/run/host-services/ssh-auth.sock"
}
```

Then inside the container:
```bash
ssh-add -l  # List forwarded keys
git clone git@github.com:your-org/your-repo.git  # Use forwarded keys
```


## Local Identity Endpoints

- GET / - API status
- POST /api/users/signup - create local user record and queue UserRegistered event
- POST /api/users/identify - authorize user by normalized name and PIN

## Local Scope Boundaries

- This slice is local-only and intentionally excludes OAuth and Azure hosting.
- Name and PIN are validated on client and server.
- PIN plaintext is never stored or emitted in events.
- Future cloud and OAuth expansion will be delivered in a separate feature.

## Local User-Machine Install Approach

For local-first deployment to end-user machines, the default persistence model is a local SQLite file.

- No separate database installation or database service is required.
- The API currently defaults to a local SQLite file named biketracking.local.db.
- Startup applies EF Core migrations automatically to create or update schema.
- For packaged installs, place the SQLite file in a user-writable application-data folder rather than the application install directory.
- Before schema upgrades, create a safety backup copy of the SQLite file.
- Use SQL Server LocalDB or SQL Server Express only when local multi-user requirements exceed the single-user SQLite profile.


## Automated Tests

frontend unit tests: `npm run test:unit` (Vitest)

frontend end-to-end tests: `npm run test:e2e` (Playwright)
- These use the local SQLlite database, so they are more like integration tests. The values are thrown away after each test, but they do test the full stack of the API and database layers.

backend tests: `dotnet test` from repo root (xUnit)

These are ran in the .github\workflows\ci.yml pipeline on every PR

