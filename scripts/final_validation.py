import os
import requests
import json
from datetime import datetime
from dotenv import load_dotenv

env_path = os.path.join('frontend', '.env')
load_dotenv(env_path)

URL = os.getenv('VITE_SUPABASE_URL')
KEY = os.getenv('VITE_SUPABASE_ANON_KEY')

def test_final_insert():
    headers = {
        "apikey": KEY,
        "Authorization": f"Bearer {KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    
    # ID de Sofía Arrubla (visto en list_profiles)
    profile_id = "2e63b256-9c19-4673-9a1b-0e8620242220" 
    company_id = "f05244c0-5209-4654-a96c-ed0c01e5238a" # De los logs previos
    
    now = datetime.now().isoformat()
    
    payload = {
        "profile_id": profile_id,
        "company_id": company_id,
        "event_type": "in",
        "date": datetime.now().strftime("%Y-%m-%d"),
        "clock_in": now,
        "is_verified": True,
        "metadata": {"test": "final-validation"}
    }
    
    print(f"Intentando inserción final para profile_id: {profile_id}")
    try:
        response = requests.post(f"{URL}/rest/v1/time_entries", headers=headers, data=json.dumps(payload))
        if response.status_code == 201:
            print("¡ÉXITO! Registro insertado correctamente.")
            print(json.dumps(response.json(), indent=2))
        else:
            print(f"ERROR {response.status_code}: {response.text}")
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    test_final_insert()
