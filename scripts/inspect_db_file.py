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
                return f"TABLA {table_name}: {', '.join(cols)}\n"
            else:
                return f"TABLA {table_name}: VACIA\n"
        else:
            return f"TABLA {table_name}: ERROR {response.status_code}\n"
    except Exception as e:
        return f"TABLA {table_name}: EXCEPTION {e}\n"

if __name__ == "__main__":
    result = inspect_table("profiles")
    result += inspect_table("time_entries")
    with open("db_inspection.txt", "w") as f:
        f.write(result)
    print("Resultado guardado en db_inspection.txt")
