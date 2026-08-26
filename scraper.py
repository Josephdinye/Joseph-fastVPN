import urllib.request
import re

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

def fetch_and_clean_configs():
    valid_configs = []
    
    # Matching protocol patterns for vless, vmess, trojan, and ss
    protocol_pattern = re.compile(r'^(vless|vmess|trojan|ss)://[^\s]+')

    for url in SOURCES:
        try:
            print(f"Fetching from: {url}")
            # Use a basic User-Agent to prevent getting blocked by CDNs
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=15) as response:
                raw_data = response.read().decode('utf-8')
                
                for line in raw_data.splitlines():
                    cleaned_line = line.strip()
                    if protocol_pattern.match(cleaned_line) and cleaned_line not in valid_configs:
                        valid_configs.append(cleaned_line)
                        
        except Exception as e:
            print(f"Failed to read from source {url}: {e}")

    # Write the unique, extracted lines directly to a text file
    with open("configs.txt", "w", encoding="utf-8") as f:
        f.write("\n".join(valid_configs))
        
    print(f"Successfully compiled {len(valid_configs)} unique configurations!")

if __name__ == "__main__":
    fetch_and_clean_configs()
