import os
import requests
import json
from datetime import datetime
from dotenv import load_dotenv

env_path = os.path.join('frontend', '.env')
load_dotenv(env_path)

URL = os.getenv('VITE_SUPABASE_URL')
KEY = os.getenv('VITE_SUPABASE_ANON_KEY')

def test_final_insert_fix():
    headers = {
        "apikey": KEY,
        "Authorization": f"Bearer {KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    
    # Sofía Arrubla
    profile_id = "2e63b256-9c19-4673-9a1b-0e8620242220" 
    # Sede Norte Bogotá (ID correcto extraído de SQL)
    company_id = "3204f0ab-c7b6-4d40-869d-8bab9d63393b" 
    
    now = datetime.now().isoformat()
    
    payload = {
        "profile_id": profile_id,
        "company_id": company_id,
        "event_type": "in",
        "date": datetime.now().strftime("%Y-%m-%d"),
        "clock_in": now,
        "is_verified": True,
        "metadata": {"test": "final-validation-ok"}
    }
    
    print(f"Intentando inserción final con company_id correcto: {company_id}")
    try:
        response = requests.post(f"{URL}/rest/v1/time_entries", headers=headers, data=json.dumps(payload))
        if response.status_code == 201:
            print("¡ÉXITO TOTAL! Registro insertado correctamente con todas las FKs válidas.")
            print(json.dumps(response.json(), indent=2))
        else:
            print(f"ERROR {response.status_code}: {response.text}")
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    test_final_insert_fix()
