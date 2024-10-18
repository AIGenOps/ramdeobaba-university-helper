#!/usr/bin/env python3
"""
RKNEc Central Library PYQs Process Tracker & Downloader Server
Serves a minimal, professional dashboard on port 8085 with live process tracking.
Concurrent FTP downloader pulls papers into ./PYQs in real-time.
"""

import os
import sys
import time
import json
import re
import threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from collections import deque
from ftplib import FTP

PORT = 8085
DEST_DIR = "PYQs"
MANIFEST_FILE = "pyqs_manifest.json"
CRAWL_LOG = "/home/adityap/.gemini/antigravity/brain/e8f9c9c0-37ee-4920-9a5a-c72c9f6a35df/.system_generated/tasks/task-42.log"

FTP_HOST = "103.220.82.76"
FTP_PORT = 21
FTP_ENCODING = "latin-1"
WORKER_THREADS = 8

class GlobalState:
    def __init__(self):
        self.lock = threading.Lock()
        self.status = "INITIALIZING"
        self.total_files = 0
        self.total_bytes = 0
        self.processed_files = 0
        self.processed_bytes = 0
        self.downloaded_files = 0
        self.downloaded_bytes = 0
        self.skipped_files = 0
        self.failed_files = 0
        self.dirs_scanned = 0
        self.dirs_in_queue = 0
        self.speed_mb_s = 0.0
        self.eta_seconds = 0
        self.start_time = time.time()
        self.elapsed_seconds = 0
        self.programs = {}  # { program_name: { "total": int, "completed": int } }
        self.logs = deque(maxlen=60)
        self.seen_remote_paths = set()
        self.queue = []
        self.crawl_finished = False

    def add_log(self, log_type, msg):
        now_str = time.strftime("%H:%M:%S")
        with self.lock:
            self.logs.appendleft({
                "time": now_str,
                "type": log_type,
                "msg": msg
            })

state = GlobalState()

def get_ftp():
    ftp = FTP()
    ftp.encoding = FTP_ENCODING
    ftp.connect(FTP_HOST, FTP_PORT, timeout=25)
    ftp.login()
    ftp.set_pasv(True)
    return ftp

def get_program_name(remote_path):
    parts = remote_path.strip("/").split("/")
    return parts[0] if parts else "GENERAL"

def monitor_crawl():
    """Reads crawl log and manifest to keep track of discovered files."""
    state.add_log("INDEXED", "Starting directory indexing monitor")
    log_pattern = re.compile(r"Crawled\s+(\d+)\s+dirs\s+\|\s+Queue:\s+(\d+)\s+\|\s+Found\s+(\d+)\s+files\s+\(([\d\.]+)\s+MB\)")

    while True:
        # Check crawl log
        if os.path.exists(CRAWL_LOG):
            try:
                with open(CRAWL_LOG, "r", encoding="utf-8", errors="ignore") as f:
                    lines = f.readlines()
                    for line in reversed(lines):
                        if "Crawl complete" in line:
                            state.crawl_finished = True
                        m = log_pattern.search(line)
                        if m:
                            with state.lock:
                                state.dirs_scanned = int(m.group(1))
                                state.dirs_in_queue = int(m.group(2))
                            break
            except Exception:
                pass

        # Check manifest
        if os.path.exists(MANIFEST_FILE):
            try:
                with open(MANIFEST_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    files = data.get("files", [])
                    tot_b = data.get("total_bytes", 0)

                    new_items = []
                    with state.lock:
                        state.total_files = len(files)
                        state.total_bytes = tot_b
                        
                        for item in files:
                            rpath = item["remote_path"]
                            prog = get_program_name(rpath)
                            if prog not in state.programs:
                                state.programs[prog] = {"total": 0, "completed": 0}

                            if rpath not in state.seen_remote_paths:
                                state.seen_remote_paths.add(rpath)
                                state.programs[prog]["total"] += 1
                                new_items.append(item)

                    if new_items:
                        with state.lock:
                            state.queue.extend(new_items)
                        state.add_log("INDEXED", f"Discovered {len(new_items)} new files (Total: {len(files)})")

            except Exception:
                pass

        if state.crawl_finished and len(state.queue) == 0:
            break

        time.sleep(2.0)

def download_worker(worker_id):
    """Worker thread that takes files from queue and downloads via FTP."""
    ftp = None
    tls_fail_count = 0

    while True:
        item = None
        with state.lock:
            if state.queue:
                item = state.queue.pop(0)

        if not item:
            if state.crawl_finished:
                # No more items and crawling finished
                break
            time.sleep(1.0)
            continue

        remote_path = item["remote_path"]
        expected_size = item["size"]
        filename = item["filename"]
        rdir = item["dir"]
        prog = get_program_name(remote_path)

        rel_path = remote_path.lstrip("/")
        local_path = os.path.join(DEST_DIR, rel_path)
        local_folder = os.path.dirname(local_path)

        # Check if already cached
        if os.path.exists(local_path):
            curr_size = os.path.getsize(local_path)
            if (expected_size > 0 and curr_size == expected_size) or (expected_size == 0 and curr_size == 0):
                with state.lock:
                    state.skipped_files += 1
                    state.processed_files += 1
                    state.processed_bytes += expected_size
                    if prog in state.programs:
                        state.programs[prog]["completed"] += 1
                state.add_log("SKIPPED", f"{filename} (Cached)")
                continue

        os.makedirs(local_folder, exist_ok=True)
        temp_local_path = local_path + f".part{worker_id}"

        success = False
        for attempt in range(3):
            try:
                if ftp is None:
                    ftp = get_ftp()
                ftp.cwd(rdir)
                with open(temp_local_path, "wb") as f:
                    ftp.retrbinary(f"RETR {filename}", f.write)

                dl_size = os.path.getsize(temp_local_path)
                if expected_size > 0 and dl_size != expected_size:
                    raise IOError(f"Size mismatch: expected {expected_size}, got {dl_size}")

                os.replace(temp_local_path, local_path)
                with state.lock:
                    state.downloaded_files += 1
                    state.processed_files += 1
                    state.downloaded_bytes += dl_size
                    state.processed_bytes += dl_size
                    if prog in state.programs:
                        state.programs[prog]["completed"] += 1

                size_kb = dl_size / 1024
                state.add_log("FETCHED", f"{prog} - {filename} ({size_kb:.1f} KB)")
                success = True
                break
            except Exception as e:
                try:
                    if ftp:
                        ftp.close()
                except Exception:
                    pass
                ftp = None
                if os.path.exists(temp_local_path):
                    try:
                        os.remove(temp_local_path)
                    except Exception:
                        pass
                time.sleep(1.0)

        if not success:
            with state.lock:
                state.failed_files += 1
                state.processed_files += 1
                if prog in state.programs:
                    state.programs[prog]["completed"] += 1
            state.add_log("ERROR", f"Failed: {filename}")

    if ftp:
        try:
            ftp.quit()
        except Exception:
            pass

def speed_and_status_monitor():
    """Calculates throughput, ETA, elapsed time and updates system status."""
    prev_bytes = 0
    prev_time = time.time()
    history = deque(maxlen=5)

    while True:
        time.sleep(1.0)
        now = time.time()
        with state.lock:
            state.elapsed_seconds = now - state.start_time
            dt = now - prev_time
            curr_bytes = state.downloaded_bytes
            db = curr_bytes - prev_bytes
            prev_bytes = curr_bytes
            prev_time = now

            inst_speed = (db / (1024 * 1024)) / dt if dt > 0 else 0.0
            history.append(inst_speed)
            avg_speed = sum(history) / len(history) if history else 0.0
            state.speed_mb_s = avg_speed

            rem_bytes = max(0, state.total_bytes - state.processed_bytes)
            if avg_speed > 0:
                state.eta_seconds = (rem_bytes / (1024 * 1024)) / avg_speed
            else:
                state.eta_seconds = 0

            if state.crawl_finished and state.processed_files >= state.total_files and state.total_files > 0:
                state.status = "COMPLETED"
                state.dirs_in_queue = 0
            elif not state.crawl_finished and state.downloaded_files == 0 and state.skipped_files == 0:
                state.status = "INDEXING"
            elif not state.crawl_finished:
                state.status = "INDEXING & DOWNLOADING"
            else:
                state.status = "DOWNLOADING"

class RequestHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/" or self.path == "/index.html":
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            with open("tracker.html", "rb") as f:
                self.wfile.write(f.read())
        elif self.path == "/api/status":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            
            with state.lock:
                payload = {
                    "status": state.status,
                    "total_files": state.total_files,
                    "total_bytes": state.total_bytes,
                    "processed_files": state.processed_files,
                    "processed_bytes": state.processed_bytes,
                    "downloaded_files": state.downloaded_files,
                    "downloaded_bytes": state.downloaded_bytes,
                    "skipped_files": state.skipped_files,
                    "failed_files": state.failed_files,
                    "dirs_scanned": state.dirs_scanned,
                    "dirs_in_queue": state.dirs_in_queue,
                    "speed_mb_s": state.speed_mb_s,
                    "eta_seconds": state.eta_seconds,
                    "elapsed_seconds": state.elapsed_seconds,
                    "programs": dict(state.programs),
                    "logs": list(state.logs)
                }
            self.wfile.write(json.dumps(payload).encode("utf-8"))
        else:
            self.send_error(404, "Not Found")

    def log_message(self, format, *args):
        # Silence access logs to keep terminal output clean
        pass

def main():
    os.makedirs(DEST_DIR, exist_ok=True)
    state.start_time = time.time()

    # Start crawl monitor thread
    t_crawl = threading.Thread(target=monitor_crawl, daemon=True)
    t_crawl.start()

    # Start speed & ETA monitor thread
    t_speed = threading.Thread(target=speed_and_status_monitor, daemon=True)
    t_speed.start()

    # Start worker threads
    for wid in range(WORKER_THREADS):
        t_worker = threading.Thread(target=download_worker, args=(wid,), daemon=True)
        t_worker.start()

    print(f"Tracking server running at http://0.0.0.0:{PORT}")
    print(f"Access locally via http://localhost:{PORT}")
    server = ThreadingHTTPServer(("0.0.0.0", PORT), RequestHandler)
    server.serve_forever()

if __name__ == "__main__":
    main()
