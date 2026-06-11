import sys
import os
import json
import pyotp

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from neo_api_client import NeoAPI

def main():
    with open("../credentials.json", "r") as f:
        creds = json.load(f)
        
    secret = creds.get("totp_secret", "")
    totp_code = pyotp.TOTP(secret).now()
    
    client = NeoAPI(environment="prod", consumer_key=creds["consumer_key"])
    client.totp_login(
        mobile_number=creds["mobile_number"],
        ucc=creds["ucc"],
        totp=totp_code
    )
    client.totp_validate(mpin=creds["mpin"])
    
    candidates = [
        "Nifty Fin Service",
        "Nifty Financial Services",
        "NIFTY FIN SERVICE",
        "Nifty Financial",
        "NIFTY_FIN_SERVICE",
        "Nifty Fin"
    ]
    
    tokens = [{"instrument_token": c, "exchange_segment": "nse_cm"} for c in candidates]
    
    try:
        res = client.quotes(instrument_tokens=tokens, quote_type="ltp")
        print("Response:", json.dumps(res, indent=2))
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    main()
