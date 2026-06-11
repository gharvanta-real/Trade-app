import sys
import os
import json

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from neo_api_client import settings

print("stock_key_mapping:")
print(settings.stock_key_mapping)
print("\nindex_key_mapping:")
print(settings.index_key_mapping)
print("\nReqTypeValues:")
print(settings.ReqTypeValues)
