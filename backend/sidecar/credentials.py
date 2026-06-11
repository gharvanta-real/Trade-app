import os
import json
from pathlib import Path
from typing import Dict, Any, Optional

CREDENTIALS_FILE = Path(__file__).parent / "credentials.json"

def save_credentials(data: Dict[str, str]) -> None:
    """
    Saves Kotak Neo credentials to a local JSON file.
    """
    credentials = {
        "ucc": data.get("ucc", ""),
        "mobile_number": data.get("mobile_number", ""),
        "consumer_key": data.get("consumer_key", ""),
        "consumer_secret": data.get("consumer_secret", ""),
        "mpin": data.get("mpin", ""),
        "totp_secret": data.get("totp_secret", "")
    }
    
    with open(CREDENTIALS_FILE, "w") as f:
        json.dump(credentials, f, indent=4)

def load_credentials() -> Dict[str, str]:
    """
    Loads Kotak Neo credentials from the local JSON file.
    Returns empty fields if the file does not exist.
    """
    if not CREDENTIALS_FILE.exists():
        return {}
        
    try:
        with open(CREDENTIALS_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return {}

def get_masked_credentials() -> Dict[str, Any]:
    """
    Returns credentials with sensitive values masked for the UI.
    """
    creds = load_credentials()
    if not creds:
        return {
            "has_credentials": False,
            "ucc": "",
            "mobile_number": "",
            "consumer_key": "",
            "consumer_secret": "",
            "has_mpin": False,
            "has_totp_secret": False
        }
        
    def mask_string(s: str, visible_len: int = 4) -> str:
        if not s:
            return ""
        if len(s) <= visible_len * 2:
            return "*" * len(s)
        return s[:visible_len] + "*" * (len(s) - visible_len * 2) + s[-visible_len:]

    return {
        "has_credentials": True,
        "ucc": creds.get("ucc", ""),
        "mobile_number": mask_string(creds.get("mobile_number", ""), 3),
        "consumer_key": mask_string(creds.get("consumer_key", ""), 4),
        "consumer_secret": mask_string(creds.get("consumer_secret", ""), 4),
        "has_mpin": bool(creds.get("mpin")),
        "has_totp_secret": bool(creds.get("totp_secret"))
    }
