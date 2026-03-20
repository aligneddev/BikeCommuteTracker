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


I did this to avoid getting commits from the wrong user. This is optional for you. If you have the straight forward setup, you don't need to mount ~/.ssh as the Forwarding should work fine. 

The DevContainer mounts your host `~/.ssh` directory read-only at `/root/.ssh-host`, then copies it to `/root/.ssh` with correct permissions during `postCreateCommand`. This is necessary because SSH rejects config files with world-writable permissions (common on Windows-mounted filesystems).

The SSH config can be set up for two GitHub accounts — a personal account and a company account — using named hosts:


```
Host github.com-personal
  HostName github.com
  IdentityFile ~/.ssh/youruser_github

Host github.com
  HostName github.com
  IdentityFile ~/.ssh/yourcompany_github
```

Use the appropriate host alias when cloning:

```bash
# Personal repos
git clone git@github.com-personal:your-username/your-repo.git

# Company repos
git clone git@github.com:omnitech-org/your-repo.git
```

Verify connectivity:

```bash
ssh -T git@github.com-personal
ssh -T git@github.com
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

