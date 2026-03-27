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

# Files to checkpoint for Reporting System
files_to_add = [
    "frontend/src/components/AdminDashboard.tsx",
    "frontend/package.json",
    "frontend/package-lock.json",
    "directivas/estadisticos_reportes_SOP.md"
]

print("Iniciando Checkpoint de Reportes y Estadísticas...")

# Change directory to the root of the project
project_root = r"c:\Datos\Asiste_360\In_Asiste360"
os.chdir(project_root)

# Stage files
for file_path in files_to_add:
    if os.path.exists(os.path.join(project_root, file_path)):
        run_git_command(["git", "add", file_path])
    else:
        print(f"Warning: File not found: {file_path}")

# Create commit
commit_message = "Mejora Reportes Asiste360: Exportación Excel, Cálculo Robusto de Jornadas y Estadísticas de Pausas/Extras 📊🚀📉"
run_git_command(["git", "commit", "-m", commit_message])

# Push to development branch
run_git_command(["git", "push", "origin", "desarrollo"])

print("Checkpoint de Reportes Completado.")
