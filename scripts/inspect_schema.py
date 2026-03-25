import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Load env from frontend/.env
load_dotenv('frontend/.env')

url = os.environ.get("VITE_SUPABASE_URL")
key = os.environ.get("VITE_SUPABASE_ANON_KEY")
supabase: Client = create_client(url, key)

def check_schema():
    try:
        # Fetch one record to see keys
        res = supabase.table('InA_companies').select('*').limit(1).execute()
        if res.data:
            print("Columns in InA_companies:", res.data[0].keys())
        else:
            print("No records found in InA_companies to inspect schema.")
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    check_schema()
