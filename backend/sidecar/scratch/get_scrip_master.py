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
    
    print("Fetching scrip master for nse_cm...")
    try:
        res = client.scrip_master(exchange_segment="nse_cm")
        print("Scrip master response type:", type(res))
        if isinstance(res, dict):
            print("Keys:", res.keys())
            # print some sample content
            print(json.dumps(res, indent=2)[:1000])
        elif isinstance(res, str):
            print("Response length:", len(res))
            print("First 1000 chars:", res[:1000])
        else:
            print("Sample:", str(res)[:1000])
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    main()
