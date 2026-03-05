import json

def get_time_entries_definition():
    with open("supabase_openapi.json", "r") as f:
        schema = json.load(f)
    
    # 1. Definiciones
    te_def = schema.get("definitions", {}).get("time_entries", {})
    print("--- DEFINITION properties ---")
    print(json.dumps(te_def.get("properties", {}), indent=2))
    
    # 2. Parámetros de POST
    post_params = schema.get("paths", {}).get("/time_entries", {}).get("post", {}).get("parameters", [])
    print("\n--- POST parameters ---")
    for p in post_params:
        if "$ref" in p:
            ref = p["$ref"].split("/")[-1]
            param_def = schema.get("parameters", {}).get(ref, {})
            print(f"Ref: {ref} -> {param_def.get('name')} ({param_def.get('type')})")
        else:
            print(f"Direct: {p.get('name')} ({p.get('type')})")

if __name__ == "__main__":
    get_time_entries_definition()
