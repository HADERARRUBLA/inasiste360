import os
import requests
import json
from dotenv import load_dotenv

env_path = os.path.join('frontend', '.env')
load_dotenv(env_path)

URL = os.getenv('VITE_SUPABASE_URL')
KEY = os.getenv('VITE_SUPABASE_ANON_KEY')

def get_sample(table_name):
    headers = {
        "apikey": KEY,
        "Authorization": f"Bearer {KEY}"
    }
    try:
        response = requests.get(f"{URL}/rest/v1/{table_name}?select=*&limit=1", headers=headers)
        if response.status_code == 200:
            data = response.json()
            if data:
                return f"EJEMPLO {table_name}:\n{json.dumps(data[0], indent=2)}\n"
            else:
                return f"EJEMPLO {table_name}: SIN REGISTROS\n"
        else:
            return f"EJEMPLO {table_name}: ERROR {response.status_code}\n"
    except Exception as e:
        return f"EJEMPLO {table_name}: EXCEPTION {e}\n"

if __name__ == "__main__":
    result = get_sample("profiles")
    result += get_sample("time_entries")
    with open("db_samples.txt", "w") as f:
        f.write(result)
    print("Muestras guardadas en db_samples.txt")
