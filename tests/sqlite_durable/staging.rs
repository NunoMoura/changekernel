//! Shared unit/integration fixture gate. No temporary-directory or ambient fallback.
use super::WriterCustody;
use std::fs;
use std::os::unix::fs::{DirBuilderExt, MetadataExt};
use std::path::{Path, PathBuf};

pub fn root(stage: &Path) -> Result<PathBuf, String> {
    if !stage.is_absolute() {
        return Err("required native staging path must be absolute".into());
    }
    let stage = stage
        .canonicalize()
        .map_err(|error| format!("required native staging is unavailable: {error}"))?;
    let project = Path::new(env!("CARGO_MANIFEST_DIR"))
        .canonicalize()
        .map_err(|error| format!("cannot establish source boundary: {error}"))?;
    if stage.starts_with(&project) || !stage.is_dir() {
        return Err("required fixture staging must be an external directory".into());
    }
    WriterCustody::verify_profile(&stage)
        .map_err(|error| format!("required native staging storage profile refused: {error}"))?;
    let root = stage.join("sqlite-fixtures");
    match fs::DirBuilder::new().mode(0o700).create(&root) {
        Ok(()) => {}
        Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {}
        Err(error) => {
            return Err(format!(
                "cannot create private SQLite fixture root: {error}"
            ))
        }
    }
    let metadata = fs::symlink_metadata(&root)
        .map_err(|error| format!("SQLite fixture root is unavailable: {error}"))?;
    if !metadata.is_dir() || metadata.mode() & 0o7777 != 0o700 {
        return Err("SQLite fixture root must be a real private mode-0700 directory".into());
    }
    Ok(root)
}
