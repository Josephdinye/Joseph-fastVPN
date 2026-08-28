import urllib.request
import urllib.parse
import urllib.error
import re
import json
import base64
import subprocess
import socket
import time
import os
import io
import stat
import zipfile
import tempfile
import platform
from concurrent.futures import ThreadPoolExecutor, as_completed

# Trustworthy open-source raw configuration sources
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

TEST_URL = "https://www.gstatic.com/generate_204"
CONNECT_TIMEOUT = 3        # seconds to wait for xray to bind its local port
REQUEST_TIMEOUT = 6        # seconds for the actual proxied request through xray
PREFILTER_TIMEOUT = 3      # seconds for the cheap plain TCP reachability check
PREFILTER_WORKERS = 100    # plain TCP connects are cheap, so run a lot at once
VALIDATE_WORKERS = 25      # real xray handshakes are expensive, so run fewer at once
XRAY_DIR = os.path.join(tempfile.gettempdir(), "xray-validator-bin")

SCRIPT_DEADLINE_SECONDS = 28 * 60
SCRIPT_START_TIME = time.time()


def time_remaining():
    return SCRIPT_DEADLINE_SECONDS - (time.time() - SCRIPT_START_TIME)


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
                    cleaned_line = line.strip()
                    if protocol_pattern.match(cleaned_line) and cleaned_line not in valid_configs:
                        valid_configs.append(cleaned_line)

        except Exception as e:
            print(f"Failed to read from source {url}: {e}")

    return valid_configs


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
        raise RuntimeError(f"Unsupported platform for xray download: {system}/{machine}")

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
        raise RuntimeError(f"Could not find an Xray-core release asset ending in {asset_suffix}")

    print(f"Downloading xray binary from: {asset_url}")
    dl_req = urllib.request.Request(asset_url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(dl_req, timeout=60) as resp:
        zip_bytes = resp.read()

    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        zf.extractall(XRAY_DIR)

    if not os.path.exists(binary_path):
        raise RuntimeError(f"Extracted archive but did not find expected binary at {binary_path}")

    st = os.stat(binary_path)
    os.chmod(binary_path, st.st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)

    return binary_path


def _split_fragment(uri):
    if '#' in uri:
        base, label = uri.split('#', 1)
        return base, urllib.parse.unquote(label)
    return uri, ''


def parse_vless(uri):
    try:
        parsed = urllib.parse.urlsplit(uri)
        uuid = parsed.username
        host = parsed.hostname
        port = parsed.port
        params = urllib.parse.parse_qs(parsed.query)

        def p(key, default=None):
            return params.get(key, [default])[0]

        network = p("type", "tcp")
        security = p("security", "none")
        flow = p("flow") or None

        stream_settings = {"network": network, "security": security}
        if security == "reality":
            stream_settings["realitySettings"] = {
                "show": False,
                "fingerprint": p("fp", "chrome"),
                "serverName": p("sni", ""),
                "publicKey": p("pbk", ""),
                "shortId": p("sid", "")
            }
        elif security == "tls":
            stream_settings["tlsSettings"] = {
                "serverName": p("sni", host),
                "fingerprint": p("fp", "chrome")
            }
        if network == "ws":
            stream_settings["wsSettings"] = {
                "path": p("path", "/"),
                "headers": {"Host": p("host")} if p("host") else {}
            }
        elif network == "grpc":
            stream_settings["grpcSettings"] = {"serviceName": p("serviceName", "")}

        outbound = {
            "protocol": "vless",
            "settings": {
                "vnext": [{
                    "address": host,
                    "port": port,
                    "users": [{"id": uuid, "encryption": "none", "flow": flow}]
                }]
            },
            "streamSettings": stream_settings
        }
        return outbound
    except Exception:
        return None


PARSERS = {
    "vless": parse_vless,
}


def extract_host_port(outbound):
    proto = outbound["protocol"]
    if proto in ("vless", "vmess"):
        server = outbound["settings"]["vnext"][0]
    else:
        server = outbound["settings"]["servers"][0]
    return server["address"], server["port"]


def parse_line(line):
    scheme = line.split("://", 1)[0]
    parser = PARSERS.get(scheme)
    if not parser:
        return None
    return parser(line)


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


def request_through_proxy(port, timeout_s):
    proxy_handler = urllib.request.ProxyHandler({
        "http": f"http://127.0.0.1:{port}",
        "https": f"http://127.0.0.1:{port}",
    })
    opener = urllib.request.build_opener(proxy_handler)
    req = urllib.request.Request(TEST_URL, headers={"User-Agent": "Mozilla/5.0"})
    with opener.open(req, timeout=timeout_s) as resp:
        return resp.status < 400


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


def write_and_exit(working_configs, reason):
    with open("configs.txt", "w", encoding="utf-8") as f:
        f.write("\n".join(working_configs))
    print(f"{reason} Wrote {len(working_configs)} working configs to configs.txt.")
    os._exit(0)


def validate_all(parsed_outbounds, xray_bin, max_workers=VALIDATE_WORKERS):
    working = []
    lines = list(parsed_outbounds.keys())
    base_port = 21000

    pool = ThreadPoolExecutor(max_workers=max_workers)
    futures = {}
    for i, line in enumerate(lines):
        port = base_port + i
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
        print(f"[{done_count}/{total}] {status}: {line[:70]}...")
        if ok:
            working.append(line)

        if time_remaining() <= 0:
            print("Time budget exhausted mid validation, stopping early with what has passed so far.")
            pool.shutdown(wait=False, cancel_futures=True)
            write_and_exit(working, "Stopped early due to time budget.")

    pool.shutdown(wait=True)
    return working


def main():
    print("Step 1: collecting candidate configs from sources...")
    candidates = fetch_and_clean_configs()
    print(f"Collected {len(candidates)} unique candidate configurations.")

    if not candidates:
        write_and_exit([], "Nothing to validate.")

    if time_remaining() <= 0:
        write_and_exit([], "Ran out of time before validation could start.")

    print("Step 2: preparing xray binary for validation...")
    xray_bin = ensure_xray_binary()

    print(f"Step 3: quick reachability pre-filter across {len(candidates)} candidates...")
    reachable_lines, parsed_outbounds = prefilter_reachable(candidates)
    print(f"{len(reachable_lines)} of {len(candidates)} candidates are reachable, moving to full validation.")

    if not reachable_lines:
        write_and_exit([], "No candidates passed the reachability pre-filter.")

    if time_remaining() <= 0:
        write_and_exit([], "Ran out of time during the reachability pre-filter.")

    print("Step 4: validating reachable candidates through a real proxy request...")
    reachable_outbounds = {line: parsed_outbounds[line] for line in reachable_lines}
    working_configs = validate_all(reachable_outbounds, xray_bin)

    write_and_exit(working_configs, "Finished full validation pass.")


if __name__ == "__main__":
    main()
