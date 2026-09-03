#!/usr/bin/env python3
"""
scraper.py — VLESS collector optimized against TSPU-style behavioral DPI
(Reality + chrome fingerprint + XHTTP stream-one preference + padding + /24 diversity)
"""

import urllib.request
import urllib.parse
import urllib.error
import re
import json
import subprocess
import socket
import time
import os
import io
import stat
import zipfile
import tempfile
import platform
import ipaddress
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import defaultdict

# ---------------------------------------------------------------------------
# Sources
# ---------------------------------------------------------------------------
SOURCES = [
    "https://raw.githubusercontent.com/0xRadikal/Free-v2ray-Configs/main/verified/configs.txt",
    "https://raw.githubusercontent.com/0xRadikal/Free-v2ray-Configs/main/fast/configs.txt",
    "https://raw.githubusercontent.com/0xRadikal/Free-v2ray-Configs/main/secure/configs.txt",
    "https://raw.githubusercontent.com/0xRadikal/Free-v2ray-Configs/main/all/configs.txt",
    "https://raw.githubusercontent.com/0xRadikal/Free-v2ray-Configs/main/protocols/vless.txt",
    "https://raw.githubusercontent.com/zieng2/wl/main/vless_universal.txt",
    "https://raw.githubusercontent.com/igareck/vpn-configs-for-russia/main/vless.txt",
    "https://raw.githubusercontent.com/indelingDanil/MyAppVPN/proxylist/output/filtered.txt",
    "https://raw.githubusercontent.com/ninjastrikers/Nexus-nodes/main/configs/all.txt",
]

# Larger payload to trigger / detect the ~15-20 KB freeze
TEST_URL = "https://www.gstatic.com/generate_204"          # still used for quick check
LARGE_TEST_URL = "https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png"  # ~5-6 KB, we will request multiple times or use a bigger one if needed
# Better large object (public, stable, >50 KB):
LARGE_TEST_URL = "https://speed.cloudflare.com/__down?bytes=100000"  # ~100 KB

CONNECT_TIMEOUT = 4
REQUEST_TIMEOUT = 12
PREFILTER_TIMEOUT = 3
PREFILTER_WORKERS = 100
VALIDATE_WORKERS = 20
MAX_PER_24 = 5                    # diversity limit
XRAY_DIR = os.path.join(tempfile.gettempdir(), "xray-validator-bin")
SCRIPT_DEADLINE_SECONDS = 28 * 60
SCRIPT_START_TIME = time.time()

def time_remaining():
    return SCRIPT_DEADLINE_SECONDS - (time.time() - SCRIPT_START_TIME)

# ---------------------------------------------------------------------------
# Fetch
# ---------------------------------------------------------------------------
def fetch_and_clean_configs():
    valid_configs = []
    protocol_pattern = re.compile(r'^vless://[^\s]+')
    for url in SOURCES:
        try:
            print(f"Fetching from: {url}")
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=15) as response:
                raw_data = response.read().decode('utf-8', errors='ignore')
                for line in raw_data.splitlines():
                    cleaned = line.strip()
                    if protocol_pattern.match(cleaned) and cleaned not in valid_configs:
                        valid_configs.append(cleaned)
        except Exception as e:
            print(f"Failed to read from source {url}: {e}")
    return valid_configs

# ---------------------------------------------------------------------------
# Xray binary
# ---------------------------------------------------------------------------
def ensure_xray_binary():
    binary_name = "xray.exe" if platform.system() == "Windows" else "xray"
    binary_path = os.path.join(XRAY_DIR, binary_name)
    if os.path.exists(binary_path):
        return binary_path

    os.makedirs(XRAY_DIR, exist_ok=True)
    system = platform.system()
    machine = platform.machine().lower()

    if system == "Linux" and machine in ("x86_64", "amd64"):
        asset_suffix = "linux-64.zip"
    elif system == "Linux" and "arm" in machine:
        asset_suffix = "linux-arm64-v8a.zip"
    elif system == "Darwin":
        asset_suffix = "macos-64.zip"
    elif system == "Windows":
        asset_suffix = "windows-64.zip"
    else:
        raise RuntimeError(f"Unsupported platform: {system}/{machine}")

    api_req = urllib.request.Request(
        "https://api.github.com/repos/XTLS/Xray-core/releases/latest",
        headers={'User-Agent': 'Mozilla/5.0'}
    )
    with urllib.request.urlopen(api_req, timeout=15) as resp:
        release = json.loads(resp.read().decode('utf-8'))

    asset_url = None
    for asset in release.get("assets", []):
        if asset["name"].endswith(asset_suffix):
            asset_url = asset["browser_download_url"]
            break
    if not asset_url:
        raise RuntimeError(f"No Xray asset for {asset_suffix}")

    print(f"Downloading xray from: {asset_url}")
    dl_req = urllib.request.Request(asset_url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(dl_req, timeout=60) as resp:
        zip_bytes = resp.read()

    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        zf.extractall(XRAY_DIR)

    if not os.path.exists(binary_path):
        raise RuntimeError(f"Binary not found after extract: {binary_path}")

    st = os.stat(binary_path)
    os.chmod(binary_path, st.st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)
    return binary_path

# ---------------------------------------------------------------------------
# Parser — Reality + chrome + XHTTP awareness
# ---------------------------------------------------------------------------
def parse_vless(uri):
    try:
        parsed = urllib.parse.urlsplit(uri)
        uuid = parsed.username
        host = parsed.hostname
        port = parsed.port or 443
        params = urllib.parse.parse_qs(parsed.query)

        def p(key, default=None):
            vals = params.get(key)
            return vals[0] if vals else default

        network = (p("type") or p("net") or "tcp").lower()
        security = (p("security") or "none").lower()
        flow = p("flow")
        sni = p("sni") or p("host") or host
        fp = (p("fp") or "chrome").lower()
        pbk = p("pbk") or p("publicKey") or ""
        sid = p("sid") or p("shortId") or ""
        path = p("path") or "/"
        mode = (p("mode") or p("xhttpMode") or "auto").lower()

        # Only keep configs that can look like real HTTPS
        if security not in ("reality", "tls"):
            return None
        if security == "reality" and not pbk:
            return None

        # Drop non-Vision flows (cleaner fingerprint)
        if flow and "vision" not in flow.lower():
            flow = None

        # Normalize fingerprint
        if fp not in ("chrome", "firefox", "safari", "ios", "android", "edge", "random"):
            fp = "chrome"

        stream_settings = {
            "network": network if network in ("tcp", "raw", "ws", "grpc", "xhttp", "splithttp") else "tcp",
            "security": security,
        }

        if security == "reality":
            stream_settings["realitySettings"] = {
                "show": False,
                "fingerprint": fp,
                "serverName": sni,
                "publicKey": pbk,
                "shortId": sid,
            }
        else:  # tls
            stream_settings["tlsSettings"] = {
                "serverName": sni,
                "fingerprint": fp,
                "allowInsecure": False,
            }

        # Transport-specific
        if network in ("xhttp", "splithttp"):
            xhttp = {
                "path": path if path.endswith("/") else path + "/",
                "mode": mode if mode in ("auto", "stream-one", "stream-up", "packet-up") else "stream-one",
            }
            # Recommended padding against packet-size fingerprinting
            xhttp["extra"] = {
                "xPaddingBytes": "100-500"
            }
            stream_settings["xhttpSettings"] = xhttp
            # XHTTP + Vision is not supported; drop flow
            flow = None
        elif network == "ws":
            headers = {}
            h = p("host")
            if h:
                headers["Host"] = h
            stream_settings["wsSettings"] = {"path": path, "headers": headers}
        elif network == "grpc":
            stream_settings["grpcSettings"] = {"serviceName": p("serviceName") or ""}

        user = {"id": uuid, "encryption": "none"}
        if flow:
            user["flow"] = flow

        outbound = {
            "protocol": "vless",
            "settings": {
                "vnext": [{
                    "address": host,
                    "port": int(port),
                    "users": [user]
                }]
            },
            "streamSettings": stream_settings
        }
        return outbound
    except Exception:
        return None

PARSERS = {"vless": parse_vless}

def extract_host_port(outbound):
    server = outbound["settings"]["vnext"][0]
    return server["address"], server["port"]

def parse_line(line):
    scheme = line.split("://", 1)[0].lower()
    parser = PARSERS.get(scheme)
    return parser(line) if parser else None

# ---------------------------------------------------------------------------
# /24 diversity filter
# ---------------------------------------------------------------------------
def get_24(host):
    try:
        ip = socket.gethostbyname(host)
        net = ipaddress.ip_network(f"{ip}/24", strict=False)
        return str(net)
    except Exception:
        return host  # fallback to hostname

def apply_subnet_limit(lines, parsed_outbounds, max_per_24=MAX_PER_24):
    buckets = defaultdict(list)
    for line in lines:
        try:
            host, _ = extract_host_port(parsed_outbounds[line])
            key = get_24(host)
            buckets[key].append(line)
        except Exception:
            continue

    selected = []
    for subnet, group in buckets.items():
        # Prefer Reality + any XHTTP if present, otherwise just take first N
        group.sort(key=lambda l: (
            0 if "reality" in l.lower() else 1,
            0 if "xhttp" in l.lower() or "splithttp" in l.lower() else 1
        ))
        selected.extend(group[:max_per_24])
        if len(group) > max_per_24:
            print(f"  Dropped {len(group)-max_per_24} nodes from {subnet} (limit {max_per_24})")
    return selected

# ---------------------------------------------------------------------------
# Reachability
# ---------------------------------------------------------------------------
def tcp_reachable(host, port, timeout):
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except Exception:
        return False

def prefilter_reachable(configs, max_workers=PREFILTER_WORKERS, timeout=PREFILTER_TIMEOUT):
    reachable_lines = []
    parsed_outbounds = {}
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {}
        for line in configs:
            outbound = parse_line(line)
            if not outbound:
                continue
            try:
                host, port = extract_host_port(outbound)
            except Exception:
                continue
            parsed_outbounds[line] = outbound
            futures[pool.submit(tcp_reachable, host, port, timeout)] = line

        for future in as_completed(futures):
            line = futures[future]
            try:
                if future.result():
                    reachable_lines.append(line)
            except Exception:
                pass
    return reachable_lines, parsed_outbounds

# ---------------------------------------------------------------------------
# Validation (large payload)
# ---------------------------------------------------------------------------
def build_test_config(outbound, local_port):
    return {
        "log": {"loglevel": "warning"},
        "inbounds": [{
            "port": local_port,
            "protocol": "http",
            "settings": {"auth": "noauth", "udp": True}
        }],
        "outbounds": [outbound]
    }

def wait_for_port(port, timeout_s):
    start = time.time()
    while time.time() - start < timeout_s:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.5):
                return True
        except OSError:
            time.sleep(0.1)
    return False

def request_through_proxy(port, timeout_s, url=LARGE_TEST_URL):
    proxy_handler = urllib.request.ProxyHandler({
        "http": f"http://127.0.0.1:{port}",
        "https": f"http://127.0.0.1:{port}",
    })
    opener = urllib.request.build_opener(proxy_handler)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with opener.open(req, timeout=timeout_s) as resp:
        data = resp.read()
        return resp.status < 400 and len(data) > 20000   # must actually transfer >20 KB

def validate_config(outbound, xray_bin, local_port):
    config_path = os.path.join(tempfile.gettempdir(), f"xray-validate-{local_port}.json")
    process = None
    try:
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(build_test_config(outbound, local_port), f)

        process = subprocess.Popen(
            [xray_bin, "run", "-c", config_path],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        if not wait_for_port(local_port, CONNECT_TIMEOUT):
            return False
        return request_through_proxy(local_port, REQUEST_TIMEOUT)
    except Exception:
        return False
    finally:
        if process:
            process.kill()
            try:
                process.wait(timeout=3)
            except Exception:
                pass
        try:
            os.remove(config_path)
        except OSError:
            pass

# ---------------------------------------------------------------------------
# URI rewriting for final output (recommend XHTTP stream-one + padding)
# ---------------------------------------------------------------------------
def rewrite_uri_for_xhttp(original_uri):
    """Rewrite a working Reality TCP URI to recommend XHTTP stream-one + padding.
    Client apps that support it will use the better framing; others can still fall back.
    """
    try:
        if "security=reality" not in original_uri.lower() and "security%3Dreality" not in original_uri.lower():
            return original_uri

        parsed = urllib.parse.urlsplit(original_uri)
        qs = urllib.parse.parse_qs(parsed.query)

        # Force xhttp + stream-one
        qs["type"] = ["xhttp"]
        qs["mode"] = ["stream-one"]
        # Keep existing path or set a neutral one
        if "path" not in qs:
            qs["path"] = ["/"]
        # Recommend padding (some clients read extra params)
        qs["xPaddingBytes"] = ["100-500"]

        # Clean up old tcp/net
        qs.pop("net", None)

        new_query = urllib.parse.urlencode({k: v[0] for k, v in qs.items()}, doseq=False)
        new_uri = urllib.parse.urlunsplit((
            parsed.scheme, parsed.netloc, parsed.path, new_query, parsed.fragment
        ))
        return new_uri
    except Exception:
        return original_uri

def write_and_exit(working_configs, reason):
    # Prefer original working URIs; optionally emit XHTTP-rewritten variants
    final = []
    for uri in working_configs:
        final.append(uri)
        # Also emit a recommended XHTTP version for Reality nodes
        if "reality" in uri.lower() and "xhttp" not in uri.lower():
            xhttp_ver = rewrite_uri_for_xhttp(uri)
            if xhttp_ver != uri:
                final.append(xhttp_ver + "  # recommended XHTTP stream-one variant (server must support it)")

    with open("configs.txt", "w", encoding="utf-8") as f:
        f.write("\n".join(final))
    print(f"{reason} Wrote {len(working_configs)} working configs (+ XHTTP recommendations) to configs.txt.")
    os._exit(0)

def validate_all(parsed_outbounds, xray_bin, max_workers=VALIDATE_WORKERS):
    working = []
    lines = list(parsed_outbounds.keys())
    base_port = 21000
    pool = ThreadPoolExecutor(max_workers=max_workers)
    futures = {}
    for i, line in enumerate(lines):
        port = base_port + (i % 2000)   # avoid port exhaustion
        futures[pool.submit(validate_config, parsed_outbounds[line], xray_bin, port)] = line

    done_count = 0
    total = len(futures)
    for future in as_completed(futures):
        done_count += 1
        line = futures[future]
        try:
            ok = future.result()
        except Exception:
            ok = False
        status = "OK" if ok else "dead"
        print(f"[{done_count}/{total}] {status}: {line[:90]}...")
        if ok:
            working.append(line)
        if time_remaining() <= 0:
            print("Time budget exhausted, stopping early.")
            pool.shutdown(wait=False, cancel_futures=True)
            write_and_exit(working, "Stopped early due to time budget.")
    pool.shutdown(wait=True)
    return working

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    print("Step 1: collecting candidate configs...")
    candidates = fetch_and_clean_configs()
    print(f"Collected {len(candidates)} unique candidates.")

    if not candidates:
        write_and_exit([], "Nothing to validate.")

    if time_remaining() <= 0:
        write_and_exit([], "Ran out of time before validation.")

    print("Step 2: preparing xray binary...")
    xray_bin = ensure_xray_binary()

    print(f"Step 3: TCP reachability pre-filter ({len(candidates)} candidates)...")
    reachable_lines, parsed_outbounds = prefilter_reachable(candidates)
    print(f"{len(reachable_lines)} reachable.")

    if not reachable_lines:
        write_and_exit([], "No candidates passed reachability.")

    print(f"Step 3b: applying /24 diversity limit (max {MAX_PER_24} per subnet)...")
    diversified = apply_subnet_limit(reachable_lines, parsed_outbounds)
    print(f"{len(diversified)} after diversity filter.")

    if time_remaining() <= 0:
        write_and_exit([], "Ran out of time during diversity filter.")

    print("Step 4: full validation with large payload (>20 KB transfer required)...")
    final_outbounds = {line: parsed_outbounds[line] for line in diversified if line in parsed_outbounds}
    working_configs = validate_all(final_outbounds, xray_bin)
    write_and_exit(working_configs, "Finished full validation pass.")

if __name__ == "__main__":
    main()
