use std::time::{SystemTime, UNIX_EPOCH};

use serde_json::json;
use trading_core::audit::persistent_ledger::PersistentAuditLedger;
use trading_core::audit::record::AuditRecord;

#[test]
fn persistent_ledger_writes_and_reads_jsonl_records() {
    let unique = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let path = std::env::temp_dir().join(format!("tradesk_audit_{unique}.jsonl"));
    let ledger = PersistentAuditLedger::open(&path).unwrap();
    let record = AuditRecord::new("risk_decision", json!({ "allowed": false }), 123);

    ledger.append(&record).unwrap();

    let records = ledger.read_all().unwrap();
    assert_eq!(records.len(), 1);
    assert_eq!(records[0].topic, "risk_decision");
    assert_eq!(records[0].payload["allowed"], false);

    let _ = std::fs::remove_file(path);
}
