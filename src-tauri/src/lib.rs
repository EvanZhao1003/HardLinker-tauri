use serde::{Deserialize, Serialize};
use std::{fs, io, path::{Path, PathBuf}};
use tauri::Manager;

#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Settings {
    #[serde(default)] file_targets: Vec<String>,
    #[serde(default)] folder_names: Vec<String>,
    #[serde(default = "default_language")] language: String,
    #[serde(default)] last_file_target: String,
    #[serde(default)] last_file_source_folder: String,
    #[serde(default)] last_source_folder: String,
    #[serde(default)] last_folder_target: String,
    #[serde(default)] last_folder_name: String,
    #[serde(default)] default_source_folder: String,
    #[serde(default)] default_target_folder: String,
}
fn default_language() -> String { "en".into() }

fn settings_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = std::env::var_os("APPDATA").map(PathBuf::from).unwrap_or(app.path().app_config_dir().map_err(|e| e.to_string())?).join("HardLinker");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("settings.json"))
}

#[tauri::command]
fn load_settings(app: tauri::AppHandle) -> Result<Settings, String> {
    let path = settings_path(&app)?;
    match fs::read_to_string(path) {
        Ok(text) => serde_json::from_str(&text).map_err(|e| e.to_string()),
        Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(Settings::default()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn save_settings(app: tauri::AppHandle, settings: Settings) -> Result<(), String> {
    let path = settings_path(&app)?;
    let text = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(path, text).map_err(|e| e.to_string())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LinkResult { created: usize, failures: Vec<String>, destination_folder: Option<String> }

fn create_link(source: &Path, destination: &Path) -> Result<(), String> {
    if !source.is_file() { return Err("Source file not found.".into()); }
    if destination.exists() { return Err("A destination with this name already exists; it was not overwritten.".into()); }
    let source_volume = source.canonicalize().map_err(|e| e.to_string())?;
    let dest_parent = destination.parent().ok_or("Invalid destination path")?.canonicalize().map_err(|e| e.to_string())?;
    if source_volume.components().next() != dest_parent.components().next() {
        return Err("The source file and destination are on different volumes. Windows hard links cannot cross volumes.".into());
    }
    fs::hard_link(source, destination).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_file_links(sources: Vec<String>, target: String) -> Result<LinkResult, String> {
    let target = PathBuf::from(target);
    if !target.is_dir() { return Err("Choose an existing destination folder first.".into()); }
    if sources.is_empty() { return Err("Add at least one source file first.".into()); }
    let mut result = LinkResult { created: 0, failures: vec![], destination_folder: None };
    for source in sources {
        let source_path = PathBuf::from(&source);
        let destination = target.join(source_path.file_name().ok_or("Invalid source filename")?);
        match create_link(&source_path, &destination) {
            Ok(()) => result.created += 1,
            Err(error) => result.failures.push(format!("{}: {error}", source_path.file_name().unwrap_or_default().to_string_lossy())),
        }
    }
    Ok(result)
}

fn valid_directory_name(name: &str) -> bool {
    !name.trim().is_empty() && name != "." && name != ".." && !name.chars().any(|c| matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|'))
}

#[tauri::command]
fn create_folder_links(source: String, parent: String, name: String) -> Result<LinkResult, String> {
    let source = PathBuf::from(source);
    let parent = PathBuf::from(parent);
    if !source.is_dir() { return Err("Choose an existing source folder first.".into()); }
    if !parent.is_dir() { return Err("Choose an existing destination parent folder first.".into()); }
    let folder_name = if name.trim().is_empty() { source.file_name().ok_or("Invalid source folder")?.to_string_lossy().to_string() } else { name };
    if !valid_directory_name(&folder_name) { return Err("Enter a valid single folder name.".into()); }
    let destination = parent.join(folder_name);
    fs::create_dir(&destination).map_err(|e| if e.kind() == io::ErrorKind::AlreadyExists { format!("The destination already exists: {}", destination.display()) } else { format!("Could not create the destination folder: {e}") })?;
    let mut result = LinkResult { created: 0, failures: vec![], destination_folder: Some(destination.display().to_string()) };
    let entries = fs::read_dir(&source).map_err(|e| e.to_string())?;
    for entry in entries {
        let entry = match entry { Ok(e) => e, Err(e) => { result.failures.push(e.to_string()); continue; } };
        let path = entry.path();
        if !path.is_file() { continue; }
        let target = destination.join(path.file_name().unwrap_or_default());
        match create_link(&path, &target) {
            Ok(()) => result.created += 1,
            Err(error) => result.failures.push(format!("{}: {error}", path.file_name().unwrap_or_default().to_string_lossy())),
        }
    }
    Ok(result)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![load_settings, save_settings, create_file_links, create_folder_links])
        .run(tauri::generate_context!())
        .expect("error while running HardLinker");
}
