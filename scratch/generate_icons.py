import os
import subprocess
import sys

# Ensure Pillow is installed
try:
    from PIL import Image, ImageDraw
except ImportError:
    print("Installing Pillow...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
    from PIL import Image, ImageDraw

def create_icon(size):
    # Create image with transparent background
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Circle coordinates
    padding = size * 0.05
    box = [padding, padding, size - padding, size - padding]
    draw.ellipse(box, fill=(34, 197, 94)) # Vibrant Green
    
    # Inner circle for depth
    inner_padding = size * 0.08
    inner_box = [inner_padding, inner_padding, size - inner_padding, size - inner_padding]
    draw.ellipse(inner_box, fill=(22, 163, 74)) # Darker Green
    
    # Draw Arrow Icon
    c = size / 2
    w_scale = size / 100.0
    
    # Scale points
    stem_top_y = 22 * w_scale
    stem_bot_y = 50 * w_scale
    stem_width = 8 * w_scale
    
    head_top_y = 50 * w_scale
    head_bot_y = 72 * w_scale
    head_width = 20 * w_scale
    
    tray_y = 80 * w_scale
    tray_height = 7 * w_scale
    tray_width = 24 * w_scale
    
    # Draw arrow stem
    draw.rectangle([c - stem_width, stem_top_y, c + stem_width, stem_bot_y], fill=(255, 255, 255))
    
    # Draw arrow head
    draw.polygon([
        (c - head_width, head_top_y),
        (c + head_width, head_top_y),
        (c, head_bot_y)
    ], fill=(255, 255, 255))
    
    # Draw tray
    draw.rectangle([c - tray_width, tray_y, c + tray_width, tray_y + tray_height], fill=(255, 255, 255))
    
    # Save image
    os.makedirs("icons", exist_ok=True)
    img.save(f"icons/icon{size}.png", "PNG")
    print(f"Created icons/icon{size}.png")

if __name__ == "__main__":
    for s in [16, 48, 128]:
        create_icon(s)
    print("All icons successfully generated!")
