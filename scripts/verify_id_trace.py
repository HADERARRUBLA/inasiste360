import os
import requests
import json
from dotenv import load_dotenv

env_path = os.path.join('frontend', '.env')
load_dotenv(env_path)

URL = os.getenv('VITE_SUPABASE_URL')
KEY = os.getenv('VITE_SUPABASE_ANON_KEY')

def verify_id(profile_id):
    headers = {
        "apikey": KEY,
        "Authorization": f"Bearer {KEY}"
    }
    try:
        response = requests.get(f"{URL}/rest/v1/profiles?id=eq.{profile_id}", headers=headers)
        if response.status_code == 200:
            data = response.json()
            if data:
                print(f"ID {profile_id} ENCONTRADO en profiles: {data[0].get('full_name')}")
            else:
                print(f"ID {profile_id} NO ENCONTRADO en profiles.")
        else:
            print(f"Error {response.status_code}")
    except Exception as e:
        print(f"Error {e}")

if __name__ == "__main__":
    verify_id("8482381e-cabe-43c4-aba2-42433eac807d")
