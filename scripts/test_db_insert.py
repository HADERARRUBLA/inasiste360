import os
import requests
import json
from dotenv import load_dotenv

env_path = os.path.join('frontend', '.env')
load_dotenv(env_path)

URL = os.getenv('VITE_SUPABASE_URL')
KEY = os.getenv('VITE_SUPABASE_ANON_KEY')

def test_insert():
    headers = {
        "apikey": KEY,
        "Authorization": f"Bearer {KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }
    
    # Usar el ID de Sofia Arrubla que obtuvimos de la muestra
    profile_id = "2e63b256-9c19-4673-9a1b-c86bd0da4323" 
    company_id = "3204f0ab-c7b6-4d40-869d-8bab9d63393b"
    
    payload = {
        "profile_id": profile_id,
        "company_id": company_id,
        "event_type": "in",
        "date": "2026-02-22",
        "clock_in": "2026-02-22T15:00:00Z",
        "is_verified": True,
        "metadata": {"method": "python-test"}
    }
    
    print(f"Intentando insertar con profile_id...")
    response = requests.post(f"{URL}/rest/v1/time_entries", headers=headers, json=payload)
    print(f"Resultado profile_id: {response.status_code} - {response.text}")
    
    payload_uid = payload.copy()
    del payload_uid["profile_id"]
    payload_uid["user_id"] = profile_id
    
    print(f"\nIntentando insertar con user_id...")
    response = requests.post(f"{URL}/rest/v1/time_entries", headers=headers, json=payload_uid)
    print(f"Resultado user_id: {response.status_code} - {response.text}")

if __name__ == "__main__":
    test_insert()
