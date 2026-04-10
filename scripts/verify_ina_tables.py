import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv('frontend/.env')

url = os.environ.get("VITE_SUPABASE_URL")
key = os.environ.get("VITE_SUPABASE_ANON_KEY")
supabase: Client = create_client(url, key)

def list_ina_tables():
    # Use RPC to list tables if possible, otherwise common known tables
    tables = [
        'InA_companies', 
        'InA_profiles', 
        'InA_time_entries', 
        'InA_branches', 
        'InA_organizations', 
        'InA_audit_logs',
        'InA_payroll_settings'
    ]
    
    print("Verifying In_Asiste360 Tables:")
    for table in tables:
        try:
            res = supabase.table(table).select('*').limit(1).execute()
            print(f"- {table}: [OK]")
        except Exception:
            print(f"- {table}: [NOT FOUND OR NO ACCESS]")

if __name__ == "__main__":
    list_ina_tables()
