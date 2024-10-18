#!/usr/bin/env python3
"""
RKNEc Central Library Question Papers FTP Downloader
Downloads question papers from RKNEc Central Library FTP server (ftp://103.220.82.76)
into a local folder 'PYQs', preserving the complete directory hierarchy.
"""

import os
import sys
import time
import json
import argparse
import threading
import concurrent.futures
from ftplib import FTP, error_perm, error_temp

FTP_HOST = "103.220.82.76"
FTP_PORT = 21
FTP_ENCODING = "latin-1"
DEFAULT_DEST = "PYQs"
MANIFEST_FILE = "pyqs_manifest.json"


def get_ftp_connection(timeout=20):
    """Establishes an FTP connection with anonymous login and passive mode."""
    ftp = FTP()
    ftp.encoding = FTP_ENCODING
    ftp.connect(FTP_HOST, FTP_PORT, timeout=timeout)
    ftp.login()
    ftp.set_pasv(True)
    return ftp


def parse_line(line):
    """Parses a line from FTP DIR command (supporting DOS/Windows and Unix styles)."""
    line = line.strip()
    if not line:
        return None

    # DOS/Windows style: '07-02-24  11:53AM                13509 COMPILER CONSTRUCTION.pdf'
    # or '<DIR>'
    parts = line.split(None, 3)
    if len(parts) >= 4 and (parts[0].count("-") == 2 or parts[0].count("/") == 2):
        is_dir = parts[2].upper() == "<DIR>"
        size = 0 if is_dir else (int(parts[2]) if parts[2].isdigit() else 0)
        name = parts[3]
        return is_dir, size, name

    # Unix style: 'drwxr-xr-x 2 ftp ftp 4096 Jul 26 11:07 FOURTH SEM'
    parts = line.split(None, 8)
    if len(parts) >= 9:
        is_dir = parts[0].startswith("d")
        size = int(parts[4]) if parts[4].isdigit() else 0
        name = parts[8]
        return is_dir, size, name

    return None


def crawl_ftp(manifest_path=MANIFEST_FILE):
    """Recursively crawls the FTP server starting from '/' to collect all files."""
    print(f"Connecting to FTP server {FTP_HOST}:{FTP_PORT} for directory crawl...")
    ftp = get_ftp_connection(timeout=30)
    
    queue = ["/"]
    visited_dirs = set()
    files_list = []
    total_bytes = 0
    start_time = time.time()
    last_save = time.time()

    print("Beginning recursive crawl of FTP directory tree...")
    while queue:
        current_dir = queue.pop(0)
        if current_dir in visited_dirs:
            continue
        visited_dirs.add(current_dir)

        # Retry logic for cwd/dir
        max_retries = 3
        success = False
        for attempt in range(max_retries):
            try:
                ftp.cwd(current_dir)
                lines = []
                ftp.dir(lines.append)
                for line in lines:
                    parsed = parse_line(line)
                    if not parsed:
                        continue
                    is_dir, size, name = parsed
                    if name in (".", ".."):
                        continue
                    
                    full_path = f"{current_dir}/{name}".replace("//", "/")
                    if is_dir:
                        queue.append(full_path)
                    else:
                        files_list.append({
                            "remote_path": full_path,
                            "size": size,
                            "filename": name,
                            "dir": current_dir
                        })
                        total_bytes += size
                success = True
                break
            except Exception as e:
                # Reconnect on error
                print(f"[Warning] Failed accessing '{current_dir}' (attempt {attempt+1}/{max_retries}): {e}")
                try:
                    ftp.close()
                except Exception:
                    pass
                time.sleep(1)
                try:
                    ftp = get_ftp_connection(timeout=30)
                except Exception as ce:
                    print(f"[Error] Reconnection failed: {ce}")

        if not success:
            print(f"[Error] Skipped directory due to repeated errors: {current_dir}")

        # Periodic status and manifest save
        if len(visited_dirs) % 25 == 0 or time.time() - last_save > 15:
            last_save = time.time()
            elapsed = time.time() - start_time
            print(f"Crawled {len(visited_dirs)} dirs | Queue: {len(queue)} | Found {len(files_list)} files ({total_bytes / (1024*1024):.1f} MB) [{elapsed:.0f}s]")
            with open(manifest_path, "w", encoding="utf-8") as f:
                json.dump({"files": files_list, "total_dirs": len(visited_dirs), "total_bytes": total_bytes}, f, indent=2)

    try:
        ftp.quit()
    except Exception:
        pass

    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump({"files": files_list, "total_dirs": len(visited_dirs), "total_bytes": total_bytes}, f, indent=2)

    elapsed = time.time() - start_time
    print(f"\nCrawl complete in {elapsed:.1f}s!")
    print(f"Total directories scanned: {len(visited_dirs)}")
    print(f"Total files found: {len(files_list)}")
    print(f"Total size: {total_bytes / (1024*1024):.2f} MB ({total_bytes / (1024*1024*1024):.3f} GB)")
    print(f"Manifest saved to: {manifest_path}\n")
    return files_list, total_bytes


class WorkerContext:
    """Thread-local FTP connection manager for parallel downloading."""
    def __init__(self):
        self.ftp = None

    def get_connection(self):
        if self.ftp is None:
            self.ftp = get_ftp_connection(timeout=30)
        return self.ftp

    def reset_connection(self):
        if self.ftp is not None:
            try:
                self.ftp.close()
            except Exception:
                pass
        self.ftp = None

    def close(self):
        if self.ftp is not None:
            try:
                self.ftp.quit()
            except Exception:
                pass
            self.ftp = None


def download_worker(file_info, dest_dir, thread_local, stats, lock):
    remote_path = file_info["remote_path"]
    expected_size = file_info["size"]
    
    # Clean remote path to create relative local path
    rel_path = remote_path.lstrip("/")
    local_path = os.path.join(dest_dir, rel_path)
    local_folder = os.path.dirname(local_path)
    
    # Check if already downloaded with identical size
    if os.path.exists(local_path):
        if os.path.getsize(local_path) == expected_size and expected_size > 0:
            with lock:
                stats["skipped"] += 1
                stats["processed"] += 1
                stats["processed_bytes"] += expected_size
            return True, "skipped"
        elif expected_size == 0 and os.path.getsize(local_path) == 0:
            with lock:
                stats["skipped"] += 1
                stats["processed"] += 1
            return True, "skipped"

    os.makedirs(local_folder, exist_ok=True)
    temp_local_path = local_path + ".part"

    max_retries = 3
    for attempt in range(max_retries):
        ftp = None
        try:
            ftp = thread_local.get_connection()
            # Cwd to directory, then RETR filename to handle special paths robustly
            ftp.cwd(file_info["dir"])
            with open(temp_local_path, "wb") as f:
                ftp.retrbinary(f"RETR {file_info['filename']}", f.write)
            
            # Verify file size
            downloaded_size = os.path.getsize(temp_local_path)
            if expected_size > 0 and downloaded_size != expected_size:
                raise IOError(f"Size mismatch: expected {expected_size}, got {downloaded_size}")

            os.replace(temp_local_path, local_path)
            with lock:
                stats["downloaded"] += 1
                stats["processed"] += 1
                stats["downloaded_bytes"] += downloaded_size
                stats["processed_bytes"] += downloaded_size
            return True, "downloaded"

        except Exception as e:
            thread_local.reset_connection()
            if os.path.exists(temp_local_path):
                try:
                    os.remove(temp_local_path)
                except Exception:
                    pass
            if attempt == max_retries - 1:
                with lock:
                    stats["failed"] += 1
                    stats["processed"] += 1
                    stats["failed_files"].append((remote_path, str(e)))
                return False, str(e)
            time.sleep(1)


def download_all(files_list, total_bytes, dest_dir=DEFAULT_DEST, num_workers=6):
    os.makedirs(dest_dir, exist_ok=True)
    print(f"Starting download of {len(files_list)} files ({total_bytes / (1024*1024):.2f} MB) using {num_workers} threads...")

    tls = threading.local()

    def get_tls_context():
        if not hasattr(tls, "ctx"):
            tls.ctx = WorkerContext()
        return tls.ctx

    stats = {
        "total": len(files_list),
        "total_bytes": total_bytes,
        "processed": 0,
        "downloaded": 0,
        "skipped": 0,
        "failed": 0,
        "downloaded_bytes": 0,
        "processed_bytes": 0,
        "failed_files": []
    }
    lock = threading.Lock()
    start_time = time.time()
    last_print = [time.time()]

    def task_wrapper(finfo):
        ctx = get_tls_context()
        res = download_worker(finfo, dest_dir, ctx, stats, lock)
        now = time.time()
        if now - last_print[0] >= 2.0:
            last_print[0] = now
            with lock:
                proc = stats["processed"]
                tot = stats["total"]
                pct = (proc / tot * 100) if tot else 0
                d_mb = stats["downloaded_bytes"] / (1024 * 1024)
                p_mb = stats["processed_bytes"] / (1024 * 1024)
                tot_mb = stats["total_bytes"] / (1024 * 1024)
                elapsed = now - start_time
                speed = d_mb / elapsed if elapsed > 0 else 0
                eta_s = ((tot_mb - p_mb) / speed) if speed > 0 and tot_mb > p_mb else 0
                print(f"[{pct:5.1f}%] {proc}/{tot} files | DL: {stats['downloaded']} ({d_mb:.1f} MB) | Skip: {stats['skipped']} | Fail: {stats['failed']} | {speed:.2f} MB/s | ETA: {eta_s/60:.1f}m")
        return res

    with concurrent.futures.ThreadPoolExecutor(max_workers=num_workers) as executor:
        results = list(executor.map(task_wrapper, files_list))

    elapsed = time.time() - start_time
    d_mb = stats["downloaded_bytes"] / (1024 * 1024)
    speed = d_mb / elapsed if elapsed > 0 else 0

    print("\n" + "=" * 50)
    print("DOWNLOAD SUMMARY")
    print("=" * 50)
    print(f"Destination folder   : {dest_dir}")
    print(f"Total files checked  : {stats['total']}")
    print(f"Files downloaded     : {stats['downloaded']} ({d_mb:.2f} MB)")
    print(f"Files already present: {stats['skipped']}")
    print(f"Files failed         : {stats['failed']}")
    print(f"Time elapsed         : {elapsed:.1f}s ({elapsed/60:.2f} mins)")
    print(f"Average download rate: {speed:.2f} MB/s")
    if stats["failed_files"]:
        print("\nFailed files list:")
        for rpath, err in stats["failed_files"][:10]:
            print(f"  {rpath}: {err}")
        if len(stats["failed_files"]) > 10:
            print(f"  ... and {len(stats['failed_files']) - 10} more")
    print("=" * 50)


def main():
    parser = argparse.ArgumentParser(description="RKNEc Central Library PYQs Downloader")
    parser.add_argument("--dest", default=DEFAULT_DEST, help="Destination directory (default: PYQs)")
    parser.add_argument("--manifest", default=MANIFEST_FILE, help="Path to manifest JSON")
    parser.add_argument("--workers", type=int, default=6, help="Number of concurrent download threads (default: 6)")
    parser.add_argument("--crawl-only", action="store_true", help="Only index files on the FTP server, do not download")
    parser.add_argument("--download-only", action="store_true", help="Download from existing manifest without re-crawling")
    args = parser.parse_args()

    files_list = []
    total_bytes = 0

    if args.download_only and os.path.exists(args.manifest):
        print(f"Loading existing manifest from {args.manifest}...")
        with open(args.manifest, "r", encoding="utf-8") as f:
            data = json.load(f)
            files_list = data.get("files", [])
            total_bytes = data.get("total_bytes", 0)
    else:
        files_list, total_bytes = crawl_ftp(args.manifest)

    if not args.crawl_only:
        download_all(files_list, total_bytes, dest_dir=args.dest, num_workers=args.workers)


if __name__ == "__main__":
    main()
