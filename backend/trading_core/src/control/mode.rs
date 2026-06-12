use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum EngineMode {
    Stopped,
    Paper,
    Shadow,
    SupervisedLive,
    AutoLive,
}

impl EngineMode {
    pub fn can_execute(self) -> bool {
        !matches!(self, EngineMode::Stopped)
    }

    pub fn is_live(self) -> bool {
        matches!(self, EngineMode::SupervisedLive | EngineMode::AutoLive)
    }
}

impl Default for EngineMode {
    fn default() -> Self {
        Self::Stopped
    }
}
