import sys
import os
import json
import time
import pyotp

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from main import app
from router import INSTRUMENTS, _session

def test_login_and_search():
    client = TestClient(app)
    
    # Load credentials
    with open("../credentials.json", "r") as f:
        creds = json.load(f)
        
    secret = creds.get("totp_secret", "")
    totp_code = pyotp.TOTP(secret).now()
    
    print("Initial INSTRUMENTS count:", len(INSTRUMENTS))
    
    print("Sending login request...")
    response = client.post("/api/kotak/login", json={"totp_code": totp_code})
    print("Login Response status code:", response.status_code)
    print("Login Response body:", response.json())
    
    if response.status_code == 200:
        print("Waiting for background scrip loader thread to finish (max 25 seconds)...")
        start_time = time.time()
        while len(INSTRUMENTS) < 10000 and time.time() - start_time < 25:
            time.sleep(1)
            print(f"Current INSTRUMENTS count: {len(INSTRUMENTS)}")
            
        print(f"Final INSTRUMENTS count: {len(INSTRUMENTS)}")
        if len(INSTRUMENTS) > 10000:
            print("SUCCESS: Dynamic instruments loaded successfully!")
            
            # Let's perform a search query
            print("Searching for 'TATASTEEL'...")
            search_response = client.get("/api/kotak/search?q=TATASTEEL")
            print("Search status code:", search_response.status_code)
            results = search_response.json()
            print(f"Found {len(results)} results for TATASTEEL:")
            for item in results[:3]:
                print(" -", item)

            print("Searching for 'CRUDEOIL'...")
            search_response = client.get("/api/kotak/search?q=CRUDEOIL")
            results = search_response.json()
            print(f"Found {len(results)} results for CRUDEOIL:")
            for item in results[:3]:
                print(" -", item)

            print("Searching for 'GOLD'...")
            search_response = client.get("/api/kotak/search?q=GOLD")
            results = search_response.json()
            print(f"Found {len(results)} results for GOLD:")
            for item in results[:3]:
                print(" -", item)
        else:
            print("FAILED: Instruments did not load in time.")
    else:
        print("FAILED: Login failed.")

if __name__ == "__main__":
    test_login_and_search()
