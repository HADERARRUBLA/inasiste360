import subprocess
import os

def run_git_command(command):
    try:
        result = subprocess.run(command, capture_output=True, text=True, check=True)
        print(f"Success: {' '.join(command)}")
        print(result.stdout)
    except subprocess.CalledProcessError as e:
        print(f"Error: {' '.join(command)}")
        print(e.stderr)

# Files to checkpoint
files_to_add = [
    "frontend/src/index.css",
    "frontend/src/components/LandingPage.tsx",
    "directivas/landing_branding_golden_state_SOP.md"
]

print("Starting Branding Checkpoint...")

# Change directory to the root of the project
os.chdir(r"c:\Datos\Asiste_360\In_Asiste360")

# Stage files
for file_path in files_to_add:
    run_git_command(["git", "add", file_path])

# Create commit
commit_message = "Branding Ejecutivo Asiste360: Golden State (Landing/ROI/Comando - Dark Theme) 💎🌃🚀"
run_git_command(["git", "commit", "-m", commit_message])

# Optional: Push to development
run_git_command(["git", "push", "origin", "desarrollo"])

print("Branding Checkpoint Complete.")
