import sys
import os
import json
import pyotp
import time
import threading

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from neo_api_client import NeoAPI

def on_message(message):
    print("[WS MESSAGE]:", message)

def on_error(error):
    print("[WS ERROR]:", error)

def on_close(message):
    print("[WS CLOSE]:", message)

def on_open(message):
    print("[WS OPEN]:", message)

def main():
    with open("../credentials.json", "r") as f:
        creds = json.load(f)
        
    secret = creds.get("totp_secret", "")
    totp_code = pyotp.TOTP(secret).now()
    
    print("Logging in to Kotak Neo...")
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
    
    # Let's test subscribing to Nifty using numerical token "26000"
    print("\n--- TEST 1: Subscribing to numerical index token '26000' and equity '2885' ---")
    
    # We will subscribe indices
    print("Subscribing index '26000'...")
    client.subscribe([{"instrument_token": "26000", "exchange_segment": "nse_cm"}], isIndex=True)
    
    # Wait 3 seconds to see if connected and ticks received
    time.sleep(3)
    
    # Check if WebSocket is open, then subscribe equities
    if hasattr(client, "NeoWebSocket") and client.NeoWebSocket.is_hsw_open == 1:
        print("WebSocket is open, subscribing equity '2885' (RELIANCE)...")
        client.subscribe([{"instrument_token": "2885", "exchange_segment": "nse_cm"}], isIndex=False)
    else:
        print("WebSocket is NOT open yet.")
        
    # Wait for 10 seconds to collect ticks
    print("Collecting ticks for 10 seconds...")
    time.sleep(10)
    
    # Let's also print client.NeoWebSocket sub_list and channel_tokens
    if hasattr(client, "NeoWebSocket"):
        print("\n--- WebSocket State ---")
        print("sub_list:", client.NeoWebSocket.sub_list)
        print("channel_tokens:", client.NeoWebSocket.channel_tokens)

if __name__ == "__main__":
    main()
