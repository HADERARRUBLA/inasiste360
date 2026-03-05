import os
import requests
import json
from dotenv import load_dotenv

# Cargar variables del .env del frontend
env_path = os.path.join('frontend', '.env')
load_dotenv(env_path)

URL = os.getenv('VITE_SUPABASE_URL')
KEY = os.getenv('VITE_SUPABASE_ANON_KEY')

def inspect_table(table_name):
    print(f"\n--- Inspeccionando tabla: {table_name} ---")
    headers = {
        "apikey": KEY,
        "Authorization": f"Bearer {KEY}"
    }
    try:
        response = requests.get(f"{URL}/rest/v1/{table_name}?select=*&limit=1", headers=headers)
        if response.status_code == 200:
            data = response.json()
            if data:
                print(f"Éxito! Columnas detectadas:")
                for key in data[0].keys():
                    print(f" - {key}")
                # print(f"Ejemplo de datos: {json.dumps(data[0], indent=2)}")
            else:
                print("Tabla vacía, no se pueden detectar columnas por este medio.")
        else:
            print(f"Error {response.status_code}: {response.text}")
    except Exception as e:
        print(f"Falla en la petición: {e}")

if __name__ == "__main__":
    if not URL or not KEY:
        print("Error: No se encontraron VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en frontend/.env")
    else:
        inspect_table("profiles")
        inspect_table("time_entries")
