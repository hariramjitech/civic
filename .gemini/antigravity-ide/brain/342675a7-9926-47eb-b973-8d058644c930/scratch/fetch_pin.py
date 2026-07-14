import urllib.request
import re
import json

url = "https://in.pinterest.com/pin/891783163687712985/"
req = urllib.request.Request(
    url, 
    headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
    }
)

try:
    with urllib.request.urlopen(req) as response:
        html = response.read().decode('utf-8')
        
    print("Page fetched successfully. Length:", len(html))
    
    # Search for all script tags of type application/ld+json
    ld_json_blocks = re.findall(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', html, re.DOTALL)
    print("Found", len(ld_json_blocks), "ld+json script tags.")
    
    urls = []
    for i, block in enumerate(ld_json_blocks):
        try:
            data = json.loads(block.strip())
            def find_urls(obj):
                if isinstance(obj, str):
                    if '.mp4' in obj or 'v.pinimg.com' in obj:
                        urls.append(obj)
                elif isinstance(obj, dict):
                    for k, v in obj.items():
                        find_urls(v)
                elif isinstance(obj, list):
                    for item in obj:
                        find_urls(item)
            find_urls(data)
        except Exception as err:
            print(f"Error parsing block {i}:", err)
            
    # Also search using regex for raw v.pinimg.com URLs
    # Example format: https://v1.pinimg.com/videos/mc/h264/89/17/83/891783163687712985.mp4
    # Pinterest video URLs often have video.pinimg.com or v1.pinimg.com or similar
    all_urls = re.findall(r'(https?://[^\s"\'>]+(?:pinimg|pinimg-d)\.com[^\s"\'>]+)', html)
    for u in all_urls:
        if '.mp4' in u or 'video' in u:
            urls.append(u)
            
    print("Extracted video URLs:")
    for u in set(urls):
        print(" -", u)
            
except Exception as e:
    print("Error:", e)
