#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        // No filesystem, shell, HTTP or updater plugins are exposed to web content.
        .run(tauri::generate_context!())
        .expect("No se pudo iniciar ClaveLocal");
}
