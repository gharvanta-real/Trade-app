import time
import requests
import pandas as pd
import os

def test():
    urls = {
        "nse_cm": "https://lapi.kotaksecurities.com/wso2-scripmaster/v1/prod/2026-06-11/transformed-v1/nse_cm-v1.csv",
        "nse_fo": "https://lapi.kotaksecurities.com/wso2-scripmaster/v1/prod/2026-06-11/transformed/nse_fo.csv"
    }
    
    os.makedirs("data", exist_ok=True)
    
    for seg, url in urls.items():
        local_path = f"data/{seg}_2026-06-11.csv"
        if not os.path.exists(local_path):
            print(f"Downloading {seg} to {local_path}...")
            res = requests.get(url)
            with open(local_path, "wb") as f:
                f.write(res.content)
            print("Downloaded.")
        else:
            print(f"{seg} already exists locally.")
            
        t0 = time.time()
        df = pd.read_csv(local_path)
        print(f"Loaded {seg} from disk in {time.time() - t0:.2f} seconds. Rows: {len(df)}")

if __name__ == "__main__":
    test()
