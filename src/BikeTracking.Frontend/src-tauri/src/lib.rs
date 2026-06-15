use serde::Deserialize;
use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

/// Holds the running sidecar child process handle.
/// Wrapped in Mutex so the setup() closure and the window event handler can both access it.
struct SidecarState(Mutex<Option<CommandChild>>);

/// Runtime configuration read from `app.conf.json` in the OS app-config directory.
/// - Windows: `%APPDATA%\BikeTracking\app.conf.json`
/// - Linux:   `~/.config/BikeTracking/app.conf.json`
#[derive(Deserialize)]
struct AppConf {
    #[serde(rename = "apiBaseUrl")]
    api_base_url: String,
}

const DEFAULT_API_URL: &str = "http://localhost:5079";
const DEFAULT_CONF_JSON: &str =
    r#"{"apiBaseUrl":"http://localhost:5079","schemaVersion":1}"#;

/// Read `apiBaseUrl` from the app config file, writing defaults on first run.
/// Falls back to `DEFAULT_API_URL` on any IO or parse error.
fn read_api_base_url(app: &tauri::AppHandle) -> String {
    let config_dir = match app.path().app_config_dir() {
        Ok(dir) => dir,
        Err(e) => {
            eprintln!("[BikeTracking] Warning: could not resolve app config dir: {e}");
            return DEFAULT_API_URL.to_string();
        }
    };

    let config_file = config_dir.join("app.conf.json");

    if !config_file.exists() {
        if let Err(e) = std::fs::create_dir_all(&config_dir) {
            eprintln!("[BikeTracking] Warning: could not create config dir: {e}");
        }
        if let Err(e) = std::fs::write(&config_file, DEFAULT_CONF_JSON) {
            eprintln!("[BikeTracking] Warning: could not write default app.conf.json: {e}");
        }
        return DEFAULT_API_URL.to_string();
    }

    let content = match std::fs::read_to_string(&config_file) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("[BikeTracking] Warning: could not read app.conf.json: {e}");
            return DEFAULT_API_URL.to_string();
        }
    };

    match serde_json::from_str::<AppConf>(&content) {
        Ok(conf) => conf.api_base_url,
        Err(e) => {
            eprintln!("[BikeTracking] Warning: could not parse app.conf.json: {e}");
            DEFAULT_API_URL.to_string()
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(SidecarState(Mutex::new(None)))
        .setup(|app| {
            let api_base_url = read_api_base_url(app.handle());

            // Inject window.__BIKE_API_URL__ before the React app initialises.
            // eval() is called synchronously before the first paint.
            let window = app
                .get_webview_window("main")
                .expect("main window not found");

            window.eval(format!(
                "window.__BIKE_API_URL__ = \"{}\";",
                api_base_url
            ))?;

            // Spawn the API sidecar. On any error, log and continue — the frontend
            // will hit the 10 s health-check timeout and show the error state.
            match app.shell().sidecar("binaries/BikeTracking.Api") {
                Ok(cmd) => match cmd.spawn() {
                    Ok((_rx, child)) => {
                        *app.state::<SidecarState>().0.lock().unwrap() = Some(child);
                    }
                    Err(e) => eprintln!("[BikeTracking] Sidecar spawn failed: {e}"),
                },
                Err(e) => eprintln!("[BikeTracking] Sidecar resolve failed: {e}"),
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let state = window.state::<SidecarState>();
                let child = state.0.lock().unwrap().take();
                if let Some(child) = child {
                    if let Err(e) = child.kill() {
                        eprintln!("[BikeTracking] Sidecar kill failed: {e}");
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error running Tauri app")
}
