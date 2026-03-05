import os
import requests
import json
from dotenv import load_dotenv

env_path = os.path.join('frontend', '.env')
load_dotenv(env_path)

URL = os.getenv('VITE_SUPABASE_URL')
KEY = os.getenv('VITE_SUPABASE_ANON_KEY')

def query_sql(sql_query):
    # Usar el endpoint de RPC si está disponible, o intentar vía REST con filtros de sistema
    # Como no tenemos RPC definido para SQL genérico, intentaremos inspeccionar vía las vistas del sistema
    # si es que están expuestas (poco probable por seguridad).
    # Plan B: Intentar insertar con nombres de columna alternativos y ver errores detallados.
    
    headers = {
        "apikey": KEY,
        "Authorization": f"Bearer {KEY}",
        "Content-Type": "application/json"
    }
    
    # Supabase PostgREST no permite SQL directo. Usaremos una técnica de "introspección por error".
    # Intentaremos seleccionar columnas inexistentes para ver si el error nos da pistas del esquema.
    
    print(f"Investigando esquema de 'time_entries' vía PostgREST...")
    
    # 1. Intentar ver si existe user_id pidiéndolo específicamente
    response = requests.get(f"{URL}/rest/v1/time_entries?select=user_id&limit=1", headers=headers)
    print(f"Columna 'user_id' existe?: {response.status_code}")
    
    # 2. Intentar ver si existe profile_id pidiéndolo específicamente
    response = requests.get(f"{URL}/rest/v1/time_entries?select=profile_id&limit=1", headers=headers)
    print(f"Columna 'profile_id' existe?: {response.status_code}")

    # 3. Ver relaciones vía el endpoint de OpenAPI (si está habilitado)
    response = requests.get(f"{URL}/rest/v1/", headers=headers)
    if response.status_code == 200:
        with open("supabase_openapi.json", "w") as f:
            json.dump(response.json(), f, indent=2)
        print("Esquema OpenAPI guardado en supabase_openapi.json")

if __name__ == "__main__":
    query_sql("")
