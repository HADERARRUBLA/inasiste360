import os
import requests
import json
from dotenv import load_dotenv

env_path = os.path.join('frontend', '.env')
load_dotenv(env_path)

URL = os.getenv('VITE_SUPABASE_URL')
KEY = os.getenv('VITE_SUPABASE_ANON_KEY')

def compare_ids():
    headers = {
        "apikey": KEY,
        "Authorization": f"Bearer {KEY}"
    }
    
    # 1. Obtener perfiles
    res_p = requests.get(f"{URL}/rest/v1/profiles?select=id,full_name", headers=headers)
    profiles = res_p.json()
    
    # 2. Obtener registros de tiempo
    res_t = requests.get(f"{URL}/rest/v1/time_entries?select=profile_id&limit=10", headers=headers)
    entries = res_t.json()
    
    with open("compare_ids.txt", "w") as f:
        f.write("--- PERFILES (profiles) ---\n")
        for p in profiles:
            f.write(f"ID: {p['id']} | Name: {p['full_name']}\n")
            
        f.write("\n--- REGISTROS EXISTENTES (time_entries) ---\n")
        f.write("Nota: Estos son los profile_id que YA están en la tabla.\n")
        for e in entries:
            f.write(f"Ref ID: {e.get('profile_id')}\n")
            
    print("Comparación guardada en compare_ids.txt")

if __name__ == "__main__":
    compare_ids()
