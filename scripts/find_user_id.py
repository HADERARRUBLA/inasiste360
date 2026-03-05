import json

def find_user_id_in_time_entries():
    with open("supabase_openapi.json", "r") as f:
        schema = json.load(f)
    
    # Buscar en definiciones
    te_def = schema.get("definitions", {}).get("time_entries", {})
    properties = te_def.get("properties", {})
    
    print("Propiedades de time_entries en OpenAPI:")
    for prop in sorted(properties.keys()):
        print(f" - {prop}")
    
    if "user_id" in properties:
        print("\n¡ENCONTRADO user_id en definiciones!")
    else:
        print("\nNo se encontró user_id en las definiciones de time_entries.")

    # Buscar en parámetros de post
    post_params = schema.get("paths", {}).get("/time_entries", {}).get("post", {}).get("parameters", [])
    for param in post_params:
        if param.get("name") == "user_id":
             print("Encontrado user_id como parámetro de POST.")
             
if __name__ == "__main__":
    find_user_id_in_time_entries()
