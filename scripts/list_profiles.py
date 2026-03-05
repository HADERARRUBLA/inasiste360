import os
import requests
import json
from dotenv import load_dotenv

env_path = os.path.join('frontend', '.env')
load_dotenv(env_path)

URL = os.getenv('VITE_SUPABASE_URL')
KEY = os.getenv('VITE_SUPABASE_ANON_KEY')

def list_profile_ids():
    headers = {
        "apikey": KEY,
        "Authorization": f"Bearer {KEY}"
    }
    try:
        response = requests.get(f"{URL}/rest/v1/profiles?select=id,full_name", headers=headers)
        if response.status_code == 200:
            data = response.json()
            print("PERFILES ENCONTRADOS:")
            for p in data:
                print(f" - {p['id']} ({p['full_name']})")
        else:
            print(f"Error: {response.status_code}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    list_profile_ids()
