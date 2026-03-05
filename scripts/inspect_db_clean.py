import os
import requests
import json
from dotenv import load_dotenv

env_path = os.path.join('frontend', '.env')
load_dotenv(env_path)

URL = os.getenv('VITE_SUPABASE_URL')
KEY = os.getenv('VITE_SUPABASE_ANON_KEY')

def inspect_table(table_name):
    headers = {
        "apikey": KEY,
        "Authorization": f"Bearer {KEY}"
    }
    try:
        response = requests.get(f"{URL}/rest/v1/{table_name}?select=*&limit=1", headers=headers)
        if response.status_code == 200:
            data = response.json()
            if data:
                cols = sorted(list(data[0].keys()))
                print(f"TABLA {table_name}: {','.join(cols)}")
            else:
                print(f"TABLA {table_name}: VACIA")
        else:
            print(f"TABLA {table_name}: ERROR {response.status_code}")
    except Exception as e:
        print(f"TABLA {table_name}: EXCEPTION {e}")

if __name__ == "__main__":
    inspect_table("profiles")
    inspect_table("time_entries")
