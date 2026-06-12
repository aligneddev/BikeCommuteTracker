# Bike Tracking – User Guide

## Installation

### Requirements

| Platform | Minimum |
|----------|---------|
| Windows  | Windows 10 or later |
| macOS    | macOS 12 Monterey or later |
| Linux    | Any modern distribution with .NET 10 runtime |

### Steps

1. Download the latest release package for your OS from the [Releases page](https://github.com/your-org/neCodeBikeTracking/releases).
2. Extract the archive to a folder of your choice (e.g. `C:\BikeTracking` or `~/bike-tracking`).
3. Run the application:
   - **Windows**: double-click `BikeTracking.exe`, or run it from a terminal.
   - **macOS / Linux**: open a terminal and run `./BikeTracking`.
4. The app starts a local web server. Open your browser and navigate to `http://localhost:5436` (or the port shown in the terminal).
5. Optionally install as a Progressive Web App (PWA) using the **Install App** button in Settings for a native app-like experience on Windows + Edge/Chrome.

> **Tip:** The app never connects to any cloud service. All data stays on your machine.

---

## Database File

The app stores all ride history, settings, and cached data in a single **SQLite** database file:

```
biketracking.local.db
```

This file is created automatically on first run in the same directory as the application binary.

### Locating the file

Open a terminal in the folder where you installed the app and look for `biketracking.local.db`.

---

## Backing Up Your Data

Backing up is a simple file copy.

**Warning:** Always back up before upgrading the app. Schema migrations run automatically on startup and cannot be rolled back without a backup.

### Manual backup

```bash
# Windows (PowerShell)
Copy-Item .\biketracking.local.db .\biketracking.local.db.backup

# macOS / Linux
cp biketracking.local.db biketracking.local.db.backup
```

### Scheduled backup (Windows Task Scheduler example)

Create a `.ps1` script:

```powershell
$src  = "C:\BikeTracking\biketracking.local.db"
$dest = "C:\Backups\BikeTracking\biketracking_$(Get-Date -Format 'yyyyMMdd_HHmm').db"
New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
Copy-Item $src $dest
```

Schedule it daily via Task Scheduler → **Create Basic Task** → set trigger to Daily → set action to `powershell.exe -File C:\path\to\backup.ps1`.

### Restoring from backup

1. Stop the app.
2. Replace `biketracking.local.db` with your backup copy.
3. Restart the app.

---

## API Keys

Two optional external services enrich ride data automatically. Both keys are stored **per rider** in your local database — they are never sent to any third party other than the respective API services.

### EIA Gas Price API Key

**What it does:** Automatically looks up the national average weekly gas price for the date of each ride. Used to calculate fuel cost savings.

**Required:** Yes — gas price lookup is disabled without this key.

**How to get a free key:**

1. Go to [https://www.eia.gov/opendata/register.php](https://www.eia.gov/opendata/register.php).
2. Fill in your name and email address and submit the form.
3. Check your email — your API key arrives within a few minutes.

**Where to enter it:**

1. Log in to the app.
2. Open **Settings**.
3. Scroll to the **API Keys** section.
4. Paste your key into the **EIA Gas Price API Key** field.
5. Click **Save Settings**.

---

### Open-Meteo Weather API Key (optional)

**What it does:** Fetches weather conditions (temperature, wind, precipitation) for each ride. Used to track riding conditions over time.

**Required:** No — weather lookup works without a key using the free public tier of [Open-Meteo](https://open-meteo.com/). A paid key is only needed for higher request volumes or commercial use.

**How to get a paid key (if needed):**

1. Go to [https://open-meteo.com/en/pricing](https://open-meteo.com/en/pricing).
2. Subscribe to a plan.
3. Copy the API key from your account dashboard.

**Where to enter it:**

1. Log in to the app.
2. Open **Settings**.
3. Scroll to the **API Keys** section.
4. Paste your key into the **Open-Meteo API Key** field.
5. Click **Save Settings**.

> **Note:** Leave the Open-Meteo field blank to continue using the free tier.

---

## Multiple Riders

Each rider signs up with a name and PIN. API keys are stored per rider — each rider on the same machine can use their own keys or share keys by entering them separately under each account.
