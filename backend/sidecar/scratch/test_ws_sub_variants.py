import sys
import os
import json
import pyotp
import time

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from neo_api_client import NeoAPI

def on_message(message):
    print("[WS MSG]:", message)

def on_error(error):
    print("[WS ERR]:", error)

def on_close(message):
    print("[WS CLS]:", message)

def on_open(message):
    print("[WS OPN]:", message)

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
    
    client.on_message = on_message
    client.on_error = on_error
    client.on_close = on_close
    client.on_open = on_open
    
    # We will subscribe to different variations of Nifty, Bank Nifty, and Fin Nifty
    test_tokens = [
        # Numerical tokens (Index)
        {"instrument_token": "26000", "exchange_segment": "nse_cm"}, # Nifty 50
        {"instrument_token": "26009", "exchange_segment": "nse_cm"}, # Bank Nifty
        {"instrument_token": "26037", "exchange_segment": "nse_cm"}, # Fin Nifty
        
        # String tokens (Index)
        {"instrument_token": "NIFTY", "exchange_segment": "nse_cm"},
        {"instrument_token": "BANKNIFTY", "exchange_segment": "nse_cm"},
        {"instrument_token": "FINNIFTY", "exchange_segment": "nse_cm"},
        
        # Space-separated string tokens
        {"instrument_token": "Nifty 50", "exchange_segment": "nse_cm"},
        {"instrument_token": "Nifty Bank", "exchange_segment": "nse_cm"},
        {"instrument_token": "Nifty Fin Services", "exchange_segment": "nse_cm"},
        
        # No-space string tokens
        {"instrument_token": "Nifty50", "exchange_segment": "nse_cm"},
        {"instrument_token": "NiftyBank", "exchange_segment": "nse_cm"},
        {"instrument_token": "FinNifty", "exchange_segment": "nse_cm"},
    ]
    
    print("Subscribing to all Nifty index token variants...")
    client.subscribe(test_tokens, isIndex=True)
    
    print("Collecting ticks for 15 seconds...")
    time.sleep(15)
    
    if hasattr(client, "NeoWebSocket"):
        print("\n--- Final sub_list ---")
        print(client.NeoWebSocket.sub_list)

if __name__ == "__main__":
    main()
