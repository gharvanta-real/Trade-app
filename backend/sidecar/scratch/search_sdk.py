import os

sdk_dir = r"E:\Tradesk\backend\sidecar\.venv\Lib\site-packages\neo_api_client"

def search():
    print(f"Searching for 'Nifty' in {sdk_dir}...")
    for root, dirs, files in os.walk(sdk_dir):
        for file in files:
            if file.endswith(".py"):
                path = os.path.join(root, file)
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        content = f.read()
                        if "Nifty" in content or "nifty" in content or "NIFTY" in content:
                            print(f"Found in: {file}")
                            # print lines containing the search terms
                            for line_no, line in enumerate(content.splitlines(), 1):
                                if any(x in line for x in ["Nifty", "nifty", "NIFTY"]):
                                    print(f"  Line {line_no}: {line.strip()}")
                except Exception as e:
                    pass

if __name__ == "__main__":
    search()
