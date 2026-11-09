#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{sync::Mutex, time::Duration};
use tauri_plugin_updater::{Update, UpdaterExt};

#[derive(Default)]
struct PendingUpdate(Mutex<Option<Update>>);

#[derive(serde::Serialize)]
struct UpdateInfo {
    version: String,
    notes: String,
}

fn allowed_download(url: &str) -> bool {
    url.starts_with("https://github.com/JosuaPerez/clavelocal/releases/download/v")
        && url.ends_with("_x64-setup.exe")
        && !url.contains(['?', '#', '@', '\\'])
}

#[tauri::command]
async fn check_update(app: tauri::AppHandle, pending: tauri::State<'_, PendingUpdate>) -> Result<Option<UpdateInfo>, String> {
    *pending.0.lock().map_err(|_| "No se pudo preparar la actualización")? = None;
    let updater = app.updater_builder().timeout(Duration::from_secs(60)).build().map_err(|_| "No se pudo preparar el actualizador")?;
    let update = updater.check().await.map_err(|_| "No se pudo consultar la versión publicada. Revisa tu conexión e inténtalo después.")?;
    if let Some(update) = update {
        if !allowed_download(update.download_url.as_str()) { return Err("La descarga no pertenece al repositorio oficial".into()); }
        let info = UpdateInfo { version: update.version.clone(), notes: update.body.clone().unwrap_or_default() };
        *pending.0.lock().map_err(|_| "No se pudo preparar la actualización")? = Some(update);
        Ok(Some(info))
    } else { Ok(None) }
}

#[tauri::command]
async fn install_update(app: tauri::AppHandle, pending: tauri::State<'_, PendingUpdate>) -> Result<(), String> {
    let update = pending.0.lock().map_err(|_| "No se pudo preparar la actualización")?.take().ok_or("Busca una actualización antes de instalar")?;
    // The plugin authenticates the downloaded bytes against the embedded public key
    // before starting the installer. Neither URLs nor keys come from web content.
    update.download_and_install(|_, _| {}, || {}).await.map_err(|_| "La actualización no se pudo descargar, verificar o instalar. La versión actual permanece instalada.")?;
    app.restart();
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(PendingUpdate::default())
        // Only these two commands are exposed; no arbitrary network, path or shell API.
        .invoke_handler(tauri::generate_handler![check_update, install_update])
        .run(tauri::generate_context!())
        .expect("No se pudo iniciar ClaveLocal");
}

#[cfg(test)]
mod tests {
    use super::allowed_download;
    #[test]
    fn update_urls_are_restricted() {
        assert!(allowed_download("https://github.com/JosuaPerez/clavelocal/releases/download/v0.3.1/ClaveLocal_0.3.1_x64-setup.exe"));
        for url in ["http://github.com/JosuaPerez/clavelocal/releases/download/v0.3.1/app_x64-setup.exe", "https://github.com/otro/repo/releases/download/v1/app_x64-setup.exe", "https://github.com.evil.invalid/JosuaPerez/clavelocal/releases/download/v1/app_x64-setup.exe", "https://github.com/JosuaPerez/clavelocal/releases/download/v1/app_x64-setup.exe?url=other"] {
            assert!(!allowed_download(url));
        }
    }
}
