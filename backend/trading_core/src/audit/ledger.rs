use std::sync::{Arc, RwLock};

use super::record::AuditRecord;

#[derive(Debug, Clone, Default)]
pub struct AuditLedger {
    records: Arc<RwLock<Vec<AuditRecord>>>,
}

impl AuditLedger {
    pub fn append(&self, record: AuditRecord) {
        if let Ok(mut records) = self.records.write() {
            records.push(record);
        }
    }

    pub fn list(&self) -> Vec<AuditRecord> {
        self.records.read().map(|r| r.clone()).unwrap_or_default()
    }
}
