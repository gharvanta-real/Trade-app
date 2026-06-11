import sys
import os
import json
import pyotp

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from neo_api_client import NeoAPI

def test_quotes(client, tokens):
    try:
        res = client.quotes(instrument_tokens=tokens, quote_type="ltp")
        return res
    except Exception as e:
        return str(e)

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
    
    variants = [
        [
            {"instrument_token": "Nifty 50", "exchange_segment": "nse_cm"},
            {"instrument_token": "Nifty Bank", "exchange_segment": "nse_cm"},
            {"instrument_token": "Nifty Fin Services", "exchange_segment": "nse_cm"},
        ],
        [
            {"instrument_token": "NIFTY", "exchange_segment": "nse_cm"},
            {"instrument_token": "BANKNIFTY", "exchange_segment": "nse_cm"},
            {"instrument_token": "FINNIFTY", "exchange_segment": "nse_cm"},
        ],
        [
            {"instrument_token": "Nifty50", "exchange_segment": "nse_cm"},
            {"instrument_token": "NiftyBank", "exchange_segment": "nse_cm"},
            {"instrument_token": "FinNifty", "exchange_segment": "nse_cm"},
        ]
    ]
    
    for i, tokens in enumerate(variants, 1):
        print(f"\n--- Variant {i} ---")
        print("Tokens:", tokens)
        res = test_quotes(client, tokens)
        print("Response:", json.dumps(res, indent=2) if isinstance(res, dict) else res)

if __name__ == "__main__":
    main()
