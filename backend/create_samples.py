import os
from PIL import Image, ImageDraw, ImageFont
import numpy as np
from pathlib import Path
from config import SAMPLES_DIR


def generate_benchmark_images():
    """
    Generates 6 high-fidelity benchmark worker images for testing
    each safety condition:
      1. full_compliant
      2. missing_helmet
      3. missing_vest
      4. missing_mask
      5. missing_gloves
      6. missing_shoes
    """
    W, H = 640, 720

    scenarios = [
        {
            "id": "full_compliant",
            "name": "1. Fully Compliant Worker (All 5 PPE)",
            "has_helmet": True,
            "has_vest": True,
            "has_mask": True,
            "has_gloves": True,
            "has_shoes": True,
        },
        {
            "id": "missing_helmet",
            "name": "2. Missing Hard Hat / Helmet",
            "has_helmet": False,
            "has_vest": True,
            "has_mask": True,
            "has_gloves": True,
            "has_shoes": True,
        },
        {
            "id": "missing_vest",
            "name": "3. Missing High-Vis Safety Vest",
            "has_helmet": True,
            "has_vest": False,
            "has_mask": True,
            "has_gloves": True,
            "has_shoes": True,
        },
        {
            "id": "missing_mask",
            "name": "4. Missing Face Mask",
            "has_helmet": True,
            "has_vest": True,
            "has_mask": False,
            "has_gloves": True,
            "has_shoes": True,
        },
        {
            "id": "missing_gloves",
            "name": "5. Missing Safety Gloves",
            "has_helmet": True,
            "has_vest": True,
            "has_mask": True,
            "has_gloves": False,
            "has_shoes": True,
        },
        {
            "id": "missing_shoes",
            "name": "6. Non-Compliant Footwear / Missing Safety Boots",
            "has_helmet": True,
            "has_vest": True,
            "has_mask": True,
            "has_gloves": True,
            "has_shoes": False,
        },
    ]

    for sc in scenarios:
        # Create industrial inspection background
        img = Image.new("RGB", (W, H), (225, 230, 235))
        draw = ImageDraw.Draw(img)

        # Background factory/entry portal elements
        # Yellow and black hazard caution strips on the sides
        for y in range(0, H, 40):
            draw.polygon([(0, y), (25, y + 20), (25, y + 40), (0, y + 20)], fill=(240, 190, 0))
            draw.polygon([(0, y + 20), (25, y + 40), (25, y + 60), (0, y + 40)], fill=(40, 40, 40))
            draw.polygon([(W - 25, y), (W, y + 20), (W, y + 40), (W - 25, y + 20)], fill=(240, 190, 0))
            draw.polygon([(W - 25, y + 20), (W, y + 40), (W, y + 60), (W - 25, y + 40)], fill=(40, 40, 40))

        # Industrial floor line & standing platform
        draw.rectangle([60, 610, W - 60, 700], fill=(70, 75, 85))
        draw.line([80, 610, 80, 700], fill=(240, 190, 0), width=4)
        draw.line([W - 80, 610, W - 80, 700], fill=(240, 190, 0), width=4)
        draw.rectangle([180, 650, W - 180, 680], outline=(240, 190, 0), width=3)

        # Overhead gantry camera beam
        draw.rectangle([100, 30, W - 100, 55], fill=(50, 55, 60))
        draw.ellipse([W // 2 - 15, 40, W // 2 + 15, 70], fill=(20, 20, 20), outline=(240, 190, 0), width=2)
        draw.ellipse([W // 2 - 5, 50, W // 2 + 5, 60], fill=(80, 160, 240))

        # --- Worker Body Coordinates ---
        cx = W // 2
        # Head center
        head_cx, head_cy = cx, 145
        head_r = 42

        # 1. HEAD & HELMET / HAIR
        if sc["has_helmet"]:
            # Hard Hat: Vibrant Safety Yellow dome with brim
            draw.chord([head_cx - head_r - 6, head_cy - head_r - 18, head_cx + head_r + 6, head_cy + head_r - 10], 180, 360, fill=(255, 215, 0), outline=(220, 170, 0), width=3)
            # Hard hat brim
            draw.rectangle([head_cx - head_r - 10, head_cy - 16, head_cx + head_r + 10, head_cy - 8], fill=(245, 200, 0))
            # Retroreflective top stripe on helmet
            draw.rectangle([head_cx - 8, head_cy - head_r - 14, head_cx + 8, head_cy - 16], fill=(240, 245, 255))
        else:
            # Bare hair (Black/dark brown)
            draw.ellipse([head_cx - head_r, head_cy - head_r - 5, head_cx + head_r, head_cy], fill=(35, 25, 20))

        # Face (Skin tone)
        draw.ellipse([head_cx - head_r + 5, head_cy - head_r + 10, head_cx + head_r - 5, head_cy + head_r - 2], fill=(225, 185, 155))
        # Eyes
        draw.ellipse([head_cx - 16, head_cy - 5, head_cx - 8, head_cy + 1], fill=(40, 40, 40))
        draw.ellipse([head_cx + 8, head_cy - 5, head_cx + 16, head_cy + 1], fill=(40, 40, 40))

        # 2. FACE MASK
        if sc["has_mask"]:
            # Surgical Blue / White mask covering nose, mouth and chin
            draw.rectangle([head_cx - 26, head_cy + 4, head_cx + 26, head_cy + 36], fill=(95, 175, 230), outline=(60, 140, 200), width=2)
            # White mask elastic ear straps
            draw.line([head_cx - 26, head_cy + 10, head_cx - 36, head_cy], fill=(240, 240, 240), width=2)
            draw.line([head_cx + 26, head_cy + 10, head_cx + 36, head_cy], fill=(240, 240, 240), width=2)
            # Pleat lines on mask
            draw.line([head_cx - 22, head_cy + 14, head_cx + 22, head_cy + 14], fill=(240, 245, 255), width=1)
            draw.line([head_cx - 22, head_cy + 24, head_cx + 22, head_cy + 24], fill=(240, 245, 255), width=1)
        else:
            # Bare nose and mouth
            draw.line([head_cx, head_cy + 4, head_cx - 3, head_cy + 16], fill=(190, 145, 120), width=2)
            draw.line([head_cx - 10, head_cy + 24, head_cx + 10, head_cy + 24], fill=(160, 80, 80), width=3)

        # Neck
        draw.rectangle([head_cx - 16, head_cy + head_r - 5, head_cx + 16, head_cy + head_r + 14], fill=(215, 175, 145))

        # 3. TORSO & VEST
        torso_y1 = head_cy + head_r + 10
        torso_y2 = 440
        torso_w = 95

        # Base shirt
        draw.rectangle([cx - torso_w, torso_y1, cx + torso_w, torso_y2], fill=(45, 50, 60))

        # Arms
        draw.rectangle([cx - torso_w - 30, torso_y1 + 10, cx - torso_w, 360], fill=(45, 50, 60))
        draw.rectangle([cx + torso_w, torso_y1 + 10, cx + torso_w + 30, 360], fill=(45, 50, 60))
        # Forearms
        draw.rectangle([cx - torso_w - 28, 360, cx - torso_w - 2, 430], fill=(225, 185, 155))
        draw.rectangle([cx + torso_w + 2, 360, cx + torso_w + 28, 430], fill=(225, 185, 155))

        if sc["has_vest"]:
            # High-Vis Fluorescent Orange Vest
            draw.rectangle([cx - torso_w + 6, torso_y1 + 2, cx + torso_w - 6, torso_y2], fill=(255, 95, 20))
            # Silver retro-reflective vertical and horizontal stripes
            # Vertical stripes
            draw.rectangle([cx - 45, torso_y1 + 2, cx - 25, torso_y2], fill=(235, 240, 245))
            draw.rectangle([cx + 25, torso_y1 + 2, cx + 45, torso_y2], fill=(235, 240, 245))
            # Horizontal stripe
            draw.rectangle([cx - torso_w + 6, 340, cx + torso_w - 6, 365], fill=(235, 240, 245))
            draw.rectangle([cx - torso_w + 6, 395, cx + torso_w - 6, 420], fill=(235, 240, 245))
            # Vest zipper
            draw.line([cx, torso_y1 + 20, cx, torso_y2], fill=(30, 30, 30), width=3)
        else:
            # Plain black or grey t-shirt without vest
            draw.rectangle([cx - torso_w + 6, torso_y1 + 2, cx + torso_w - 6, torso_y2], fill=(35, 38, 45))

        # 4. GLOVES
        left_hand_box = [cx - torso_w - 30, 425, cx - torso_w, 475]
        right_hand_box = [cx + torso_w, 425, cx + torso_w + 30, 475]

        if sc["has_gloves"]:
            # White / Light Yellow industrial work gloves
            draw.rounded_rectangle(left_hand_box, radius=8, fill=(245, 245, 250), outline=(200, 200, 205), width=2)
            draw.rounded_rectangle(right_hand_box, radius=8, fill=(245, 245, 250), outline=(200, 200, 205), width=2)
            # Reinforced blue rubber palm/knuckle grips
            draw.rectangle([left_hand_box[0] + 5, 435, left_hand_box[2] - 5, 465], fill=(50, 110, 200))
            draw.rectangle([right_hand_box[0] + 5, 435, right_hand_box[2] - 5, 465], fill=(50, 110, 200))
        else:
            # Bare human skin hands
            draw.rounded_rectangle(left_hand_box, radius=8, fill=(225, 185, 155))
            draw.rounded_rectangle(right_hand_box, radius=8, fill=(225, 185, 155))

        # Pants / Trousers
        pants_y1 = torso_y2
        pants_y2 = 615
        draw.rectangle([cx - 75, pants_y1, cx - 10, pants_y2], fill=(35, 45, 60))
        draw.rectangle([cx + 10, pants_y1, cx + 75, pants_y2], fill=(35, 45, 60))

        # 5. SHOES / BOOTS
        left_foot_box = [cx - 85, 605, cx - 5, 645]
        right_foot_box = [cx + 5, 605, cx + 85, 645]

        if sc["has_shoes"]:
            # Steel-toe heavy work safety boots (Black leather with heavy tread sole)
            draw.polygon([(cx - 80, 605), (cx - 10, 605), (cx - 5, 640), (cx - 95, 640)], fill=(25, 25, 30))
            draw.rectangle([cx - 95, 635, cx - 5, 645], fill=(60, 65, 75))  # Deep rubber tread sole
            draw.polygon([(cx + 10, 605), (cx + 80, 605), (cx + 95, 640), (cx + 5, 640)], fill=(25, 25, 30))
            draw.rectangle([cx + 5, 635, cx + 95, 645], fill=(60, 65, 75))
        else:
            # Bare ankles / bright casual flip-flops (Clear violation)
            draw.rectangle([cx - 65, 605, cx - 20, 625], fill=(225, 185, 155))
            draw.rectangle([cx + 20, 605, cx + 65, 625], fill=(225, 185, 155))
            # Bright cyan casual sandals
            draw.rectangle([cx - 75, 625, cx - 10, 635], fill=(20, 220, 240))
            draw.rectangle([cx + 10, 625, cx + 75, 635], fill=(20, 220, 240))

        # Scenario Title Overlay Badge
        draw.rectangle([10, 10, W - 10, 40], fill=(20, 25, 35))
        draw.text((20, 18), sc["name"], fill=(255, 255, 255))

        out_path = SAMPLES_DIR / f"{sc['id']}.jpg"
        img.save(out_path, quality=95)
        print(f"Generated benchmark test scenario: {out_path.name}")


if __name__ == "__main__":
    generate_benchmark_images()
