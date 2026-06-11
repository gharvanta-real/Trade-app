import sys
import os
import json
import pyotp
import time

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from neo_api_client import NeoAPI

def main():
    with open("../credentials.json", "r") as f:
        creds = json.load(f)
        
    secret = creds.get("totp_secret", "")
    totp_code = pyotp.TOTP(secret).now()
    
    print("Logging in to Kotak Neo...")
    client = NeoAPI(environment="prod", consumer_key=creds["consumer_key"])
    
    totp_resp = client.totp_login(
        mobile_number=creds["mobile_number"],
        ucc=creds["ucc"],
        totp=totp_code
    )
    validate_resp = client.totp_validate(mpin=creds["mpin"])
    
    # Try searching for Nifty variations
    print("\nSearching Nifty variations...")
    for symbol in ["Nifty", "NIFTY", "Nifty50", "NIFTY50", "Nifty 50", "CNX Nifty"]:
        res = client.search_scrip(exchange_segment="nse_cm", symbol=symbol)
        if isinstance(res, list) and len(res) > 0:
            print(f"FOUND for '{symbol}':")
            # print first 3 results
            print(json.dumps(res[:3], indent=2))
        else:
            print(f"NOT found for '{symbol}'")

if __name__ == "__main__":
    main()
