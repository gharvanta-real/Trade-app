use std::sync::atomic::{AtomicBool, Ordering};

#[derive(Debug, Default)]
pub struct KillSwitch {
    tripped: AtomicBool,
}

impl KillSwitch {
    pub fn trip(&self) {
        self.tripped.store(true, Ordering::SeqCst);
    }

    pub fn reset(&self) {
        self.tripped.store(false, Ordering::SeqCst);
    }

    pub fn is_tripped(&self) -> bool {
        self.tripped.load(Ordering::SeqCst)
    }
}
