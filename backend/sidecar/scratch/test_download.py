import time
import requests
import pandas as pd

def test():
    urls = {
        "nse_cm": "https://lapi.kotaksecurities.com/wso2-scripmaster/v1/prod/2026-06-11/transformed-v1/nse_cm-v1.csv",
        "nse_fo": "https://lapi.kotaksecurities.com/wso2-scripmaster/v1/prod/2026-06-11/transformed/nse_fo.csv"
    }
    
    for seg, url in urls.items():
        print(f"Downloading {seg}...")
        t0 = time.time()
        res = requests.get(url)
        print(f"Downloaded {seg} in {time.time() - t0:.2f} seconds. Status code: {res.status_code}")
        
        t0 = time.time()
        # Parse first 1000 lines
        df = pd.read_csv(url, nrows=1000)
        print(f"Parsed first 1000 lines in {time.time() - t0:.2f} seconds.")

if __name__ == "__main__":
    test()
