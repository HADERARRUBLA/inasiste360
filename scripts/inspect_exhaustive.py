import os
import requests
import json
from dotenv import load_dotenv

env_path = os.path.join('frontend', '.env')
load_dotenv(env_path)

URL = os.getenv('VITE_SUPABASE_URL')
KEY = os.getenv('VITE_SUPABASE_ANON_KEY')

def inspect_exhaustive(table_name):
    headers = {
        "apikey": KEY,
        "Authorization": f"Bearer {KEY}"
    }
    try:
        response = requests.get(f"{URL}/rest/v1/{table_name}?select=*&limit=1", headers=headers)
        if response.status_code == 200:
            data = response.json()
            if data:
                print(f"\nCOLUMNAS DE {table_name}:")
                for key in sorted(data[0].keys()):
                    print(f"| {key} |")
            else:
                print(f"{table_name} VACIA")
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    inspect_exhaustive("time_entries")
