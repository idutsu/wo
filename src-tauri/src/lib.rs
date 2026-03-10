use tauri::Manager;
use tauri::path::BaseDirectory;
use std::fs;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_config_dir = app.path().app_config_dir().expect("Failed to get app config dir");
            
            if !app_config_dir.exists() {
                fs::create_dir_all(&app_config_dir).expect("Failed to create app config dir");
            }
            
            let db_dest_path = app_config_dir.join("pairs.sqlite3");
            
            if !db_dest_path.exists() {
                let resource_path = "../pairs.sqlite3"; 
                
                match app.path().resolve(resource_path, BaseDirectory::Resource) {
                    Ok(db_src_path) => {
                        if db_src_path.exists() {
                            fs::copy(&db_src_path, &db_dest_path).expect("Failed to copy database");
                            println!("データベースの初回コピーが完了しました！");
                        } else {
                            eprintln!("コピー元のDBファイルが見つかりません: {:?}", db_src_path);
                        }
                    }
                    Err(e) => {
                        eprintln!("リソースパスの解決に失敗しました: {}", e);
                    }
                }
            }
            Ok(())
        })
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet]) 
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}