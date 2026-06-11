import subprocess
import threading
import sys
import os
import time
import re

os.environ["PYTHONWARNINGS"] = "ignore"

# ANSI Color codes for readable console log prefixes
CYAN = "\033[96m"
MAGENTA = "\033[95m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
RESET = "\033[0m"

# Windows support for ANSI colors
if os.name == 'nt':
    os.system('color')

def kill_processes_on_ports(ports):
    print(f"{YELLOW}[SYSTEM] Freeing up previous processes on ports: {ports}...{RESET}")
    for port in ports:
        try:
            # Check for processes using netstat
            cmd = f'netstat -aon | findstr LISTENING | findstr :{port}'
            out = subprocess.check_output(cmd, shell=True).decode('utf-8', errors='ignore')
            
            pids = set()
            for line in out.splitlines():
                if not line.strip():
                    continue
                # Extract the PID at the end of the line
                match = re.search(r'\s+(\d+)\s*$', line)
                if match:
                    pids.add(match.group(1))
            
            for pid in pids:
                if pid == "0":
                    continue
                print(f"{YELLOW}[SYSTEM] Killing process {pid} listening on port {port}...{RESET}")
                subprocess.run(f"taskkill /F /PID {pid}", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except subprocess.CalledProcessError:
            # Netstat returned 1 (meaning no process was found listening on that port)
            pass
        except Exception as e:
            print(f"{RED}[SYSTEM] Error checking port {port}: {e}{RESET}")
    print(f"{GREEN}[SYSTEM] Port cleanup completed.{RESET}")

def stream_logs(pipe, prefix, color):
    try:
        for line in iter(pipe.readline, ''):
            if line:
                print(f"{color}{prefix}{RESET} | {line.rstrip()}")
                sys.stdout.flush()
    except Exception as e:
        pass

def main():
    # 1. Kill any existing processes running on Vite (5173) and Python sidecar (8001)
    kill_processes_on_ports([5173, 8001])
    
    # 2. Configure Backend Sidecar Command
    script_dir = os.path.dirname(os.path.abspath(__file__))
    venv_uvicorn = os.path.join(script_dir, "backend", "sidecar", ".venv", "Scripts", "uvicorn.exe")
    app_dir = os.path.join(script_dir, "backend", "sidecar")
    
    if os.path.exists(venv_uvicorn):
        backend_cmd = [
            venv_uvicorn, "main:app", 
            "--app-dir", app_dir, 
            "--host", "127.0.0.1", 
            "--port", "8001", 
            "--reload"
        ]
    else:
        # Fallback to system uvicorn
        backend_cmd = [
            "uvicorn", "main:app", 
            "--app-dir", app_dir, 
            "--host", "127.0.0.1", 
            "--port", "8001", 
            "--reload"
        ]
        
    # 3. Configure Frontend Dev Command
    npm_cmd = "npm.cmd" if os.name == 'nt' else "npm"
    frontend_cmd = [npm_cmd, "run", "dev"]
    frontend_cwd = os.path.join(script_dir, "frontend")
    
    print(f"\n{GREEN}[SYSTEM] Launching Kotak Neo Python Sidecar on port 8001...{RESET}")
    backend_proc = subprocess.Popen(
        backend_cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        errors='ignore'
    )
    
    print(f"{GREEN}[SYSTEM] Launching Frontend Dev Server (Vite) on port 5173...{RESET}")
    frontend_proc = subprocess.Popen(
        frontend_cmd,
        cwd=frontend_cwd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        errors='ignore'
    )
    
    # 4. Start log streaming threads
    backend_thread = threading.Thread(
        target=stream_logs, 
        args=(backend_proc.stdout, "[BACKEND]", CYAN), 
        daemon=True
    )
    frontend_thread = threading.Thread(
        target=stream_logs, 
        args=(frontend_proc.stdout, "[FRONTEND]", MAGENTA), 
        daemon=True
    )
    
    backend_thread.start()
    frontend_thread.start()
    
    # Keep main thread alive and monitor processes
    try:
        while True:
            if backend_proc.poll() is not None:
                print(f"{RED}[SYSTEM] Backend process terminated unexpectedly with code {backend_proc.returncode}.{RESET}")
                break
            if frontend_proc.poll() is not None:
                print(f"{RED}[SYSTEM] Frontend process terminated unexpectedly with code {frontend_proc.returncode}.{RESET}")
                break
            time.sleep(1)
    except KeyboardInterrupt:
        print(f"\n{YELLOW}[SYSTEM] Shutting down processes...{RESET}")
    finally:
        # Cleanup
        try:
            backend_proc.terminate()
            frontend_proc.terminate()
        except:
            pass
        print(f"{GREEN}[SYSTEM] Shutdown completed.{RESET}")

if __name__ == "__main__":
    main()
