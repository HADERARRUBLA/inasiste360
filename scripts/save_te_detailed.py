import json

def save_te_detailed():
    with open("supabase_openapi.json", "r") as f:
        schema = json.load(f)
    
    te_def = schema.get("definitions", {}).get("time_entries", {})
    with open("te_detailed_def.json", "w") as f:
        json.dump(te_def, f, indent=2)
    
    post_params = schema.get("paths", {}).get("/time_entries", {}).get("post", {}).get("parameters", [])
    decoded_params = []
    for p in post_params:
        if "$ref" in p:
            ref = p["$ref"].split("/")[-1]
            param_def = schema.get("parameters", {}).get(ref, {})
            decoded_params.append(param_def)
        else:
            decoded_params.append(p)
            
    with open("te_post_params.json", "w") as f:
        json.dump(decoded_params, f, indent=2)

if __name__ == "__main__":
    save_te_detailed()
