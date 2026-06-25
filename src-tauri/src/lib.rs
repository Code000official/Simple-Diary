use std::fs;
use std::path::PathBuf;
use tauri::Manager;

/// 获取数据存储目录（Tauri 应用数据目录下的 data/）
fn data_dir(app: &tauri::AppHandle) -> PathBuf {
    let path = app.path().app_data_dir().unwrap().join("data");
    if !path.exists() {
        fs::create_dir_all(&path).unwrap();
    }
    path
}

/// 读取日记数据文件
#[tauri::command]
fn read_data_file(app: tauri::AppHandle) -> Result<String, String> {
    let path = data_dir(&app).join("diary.json");
    if !path.exists() {
        // 首次运行，返回空数据集
        return Ok(r#"{"entries":[],"nextId":1}"#.to_string());
    }
    fs::read_to_string(&path).map_err(|e| format!("读取数据文件失败: {}", e))
}

/// 写入日记数据文件
#[tauri::command]
fn write_data_file(app: tauri::AppHandle, content: String) -> Result<(), String> {
    let path = data_dir(&app).join("diary.json");
    fs::write(&path, &content).map_err(|e| format!("写入数据文件失败: {}", e))
}

/// 读取图片文件
#[tauri::command]
fn read_image(app: tauri::AppHandle, filename: String) -> Result<Vec<u8>, String> {
    let path = data_dir(&app).join("uploads").join(&filename);
    fs::read(&path).map_err(|e| format!("读取图片失败: {}", e))
}

/// 写入图片文件
#[tauri::command]
fn write_image(app: tauri::AppHandle, filename: String, data: Vec<u8>) -> Result<(), String> {
    let dir = data_dir(&app).join("uploads");
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| format!("创建图片目录失败: {}", e))?;
    }
    fs::write(dir.join(&filename), &data).map_err(|e| format!("写入图片失败: {}", e))
}

/// 删除图片文件
#[tauri::command]
fn delete_image(app: tauri::AppHandle, filename: String) -> Result<(), String> {
    let path = data_dir(&app).join("uploads").join(&filename);
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("删除图片失败: {}", e))?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            read_data_file,
            write_data_file,
            read_image,
            write_image,
            delete_image,
        ])
        .run(tauri::generate_context!())
        .expect("启动 Tauri 应用失败");
}