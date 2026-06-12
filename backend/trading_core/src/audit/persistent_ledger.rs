use std::fs::{File, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use super::record::AuditRecord;

#[derive(Debug)]
pub struct PersistentAuditLedger {
    path: PathBuf,
    file: Mutex<File>,
}

impl PersistentAuditLedger {
    pub fn open(path: impl AsRef<Path>) -> std::io::Result<Self> {
        let path = path.as_ref().to_path_buf();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let file = OpenOptions::new().create(true).append(true).open(&path)?;
        Ok(Self {
            path,
            file: Mutex::new(file),
        })
    }

    pub fn append(&self, record: &AuditRecord) -> std::io::Result<()> {
        let line = serde_json::to_string(record)?;
        let mut file = self.file.lock().expect("audit file lock poisoned");
        writeln!(file, "{line}")?;
        file.flush()
    }

    pub fn read_all(&self) -> std::io::Result<Vec<AuditRecord>> {
        let file = File::open(&self.path)?;
        let reader = BufReader::new(file);
        let mut records = Vec::new();
        for line in reader.lines() {
            let line = line?;
            if line.trim().is_empty() {
                continue;
            }
            let record = serde_json::from_str::<AuditRecord>(&line)?;
            records.push(record);
        }
        Ok(records)
    }
}
