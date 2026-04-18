
import os
import re
import json
import shutil
from datetime import datetime
from pathlib import Path
import cv2
import numpy as np
from pdf2image import convert_from_bytes
from pyzbar.pyzbar import decode as decode_qr
from PIL import Image
import img2pdf

TEMP_FOLDER = Path(__file__).parent / "temp"
DEBUG_FOLDER = Path(__file__).parent / "debug"
DPI = 300
ENABLE_DEBUG_IMAGES = True


def ensure_temp_folder():
    TEMP_FOLDER.mkdir(parents=True, exist_ok=True)
    return TEMP_FOLDER


def ensure_debug_folder():
    DEBUG_FOLDER.mkdir(parents=True, exist_ok=True)
    return DEBUG_FOLDER


def create_session_folder():
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    session_folder = TEMP_FOLDER / f"session_{timestamp}"
    session_folder.mkdir(parents=True, exist_ok=True)
    return session_folder


def combine_images_to_pdf(image_paths: list, output_path: Path) -> bool:
    """Combine multiple images into a single PDF file."""
    try:
        if not image_paths:
            return False
        valid_paths = [str(p) for p in image_paths if Path(p).exists()]
        if not valid_paths:
            return False
        with open(output_path, "wb") as f:
            f.write(img2pdf.convert(valid_paths))
        print(f"Created PDF: {output_path.name} ({len(valid_paths)} pages)")
        return True
    except Exception as e:
        print(f"Error creating PDF: {e}")
        return False


def rotate_image(image: np.ndarray, angle: int) -> np.ndarray:
    """Rotate an image by 90, 180, or 270 degrees."""
    if angle == 90:
        return cv2.rotate(image, cv2.ROTATE_90_CLOCKWISE)
    elif angle == 180:
        return cv2.rotate(image, cv2.ROTATE_180)
    elif angle == 270:
        return cv2.rotate(image, cv2.ROTATE_90_COUNTERCLOCKWISE)
    return image.copy()


def extract_page_num(path):
    """Extract page number from filename like '..._P4_TP11.jpg'"""
    filename = Path(path).name
    match = re.search(r'_P(\d+)_TP', filename)
    if match:
        return int(match.group(1))
    return 0


def generate_filename(qr_data: dict) -> str:
    """Generate filename from QR data."""
    cms_id = str(qr_data.get('cmsId', 'unknown')).replace('/', '-')
    section = str(qr_data.get('s', 'X'))
    course_code = str(qr_data.get('c', 'XXX')).replace('/', '-').replace(' ', '-')
    question = str(qr_data.get('q', '')).replace(')', '').replace('(', '')
    part = str(qr_data.get('p', '')).replace(')', '').replace('(', '')
    sub_part = str(qr_data.get('sp', '')).replace(')', '').replace('(', '')
    page_no = qr_data.get('pg', 0)
    total_pages = qr_data.get('tp', 0)
    
    parts = [cms_id, section, course_code]
    if question: parts.append(question)
    if part: parts.append(part)
    if sub_part: parts.append(sub_part)
    parts.extend([f"P{page_no}", f"TP{total_pages}"])
    
    return "_".join(parts).replace(' ', '_') + ".jpg"

# QR CODE DETECTION

def decode_qr_with_location(image: np.ndarray) -> tuple[dict | None, tuple | None]:
    """Decode QR code and return data + bounding box."""
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image.copy()
    
    attempts = [
        gray,
        cv2.equalizeHist(gray),
        cv2.GaussianBlur(gray, (3, 3), 0),
        cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                             cv2.THRESH_BINARY, 11, 2),
        cv2.threshold(gray, 127, 255, cv2.THRESH_BINARY)[1],
    ]
    
    for attempt in attempts:
        qr_codes = decode_qr(attempt)
        if qr_codes:
            qr = qr_codes[0]
            try:
                qr_data = json.loads(qr.data.decode('utf-8'))
                rect = qr.rect
                return qr_data, (rect.left, rect.top, rect.width, rect.height)
            except (json.JSONDecodeError, UnicodeDecodeError):
                continue
    return None, None


def try_qr_with_rotations(image: np.ndarray) -> tuple[dict | None, tuple | None, np.ndarray, int]:
    """Try QR decode at 0°, 90°, 180°, 270°. Returns (qr_data, qr_bbox, corrected_image, angle)."""
    qr_data, qr_bbox = decode_qr_with_location(image)
    if qr_data is not None:
        return qr_data, qr_bbox, image, 0
    
    for angle in [90, 180, 270]:
        rotated = rotate_image(image, angle)
        qr_data, qr_bbox = decode_qr_with_location(rotated)
        if qr_data is not None:
            print(f"  QR found after {angle}° rotation")
            return qr_data, qr_bbox, rotated, angle
    
    return None, None, image, 0


# MARKER DETECTION -5 mm black box corners

def _find_best_square_in_region(gray_region: np.ndarray, min_area: int = 200, max_area: int = 12000) -> tuple | None:
    """Find the best filled black square in a cropped region.
    Returns (cx, cy) relative to the region, or None."""
    candidates = []
    
    blur = cv2.GaussianBlur(gray_region, (5, 5), 0)
    
    binary_images = [
        cv2.threshold(blur, 80, 255, cv2.THRESH_BINARY_INV)[1],
        cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)[1],
        cv2.threshold(blur, 100, 255, cv2.THRESH_BINARY_INV)[1],
    ]
    
    for binary in binary_images:
        kernel = np.ones((3, 3), np.uint8)
        clean = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=2)
        clean = cv2.morphologyEx(clean, cv2.MORPH_OPEN, kernel, iterations=1)
        
        contours, _ = cv2.findContours(clean, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area < min_area or area > max_area:
                continue
            
            x, y, bw, bh = cv2.boundingRect(cnt)
            if bw < 8 or bh < 8:
                continue
            
            ar = bw / float(bh)
            if ar < 0.60 or ar > 1.65:
                continue
            
            hull = cv2.convexHull(cnt)
            hull_area = cv2.contourArea(hull)
            solidity = area / hull_area if hull_area > 0 else 0
            if solidity < 0.75:
                continue
            
            fill = area / (bw * bh)
            if fill < 0.50:
                continue
            
            M = cv2.moments(cnt)
            cx = int(M["m10"] / M["m00"]) if M["m00"] > 0 else x + bw // 2
            cy = int(M["m01"] / M["m00"]) if M["m00"] > 0 else y + bh // 2
            
            squareness = 1.0 - abs(1.0 - ar)
            score = squareness * solidity * fill * (area ** 0.5)
            
            candidates.append({
                'center': (cx, cy),
                'area': area,
                'score': score,
                'bbox': (x, y, bw, bh),
            })
    
    if not candidates:
        return None
    
    # Dedup by 30px grid
    seen = {}
    for c in candidates:
        key = (c['center'][0] // 30, c['center'][1] // 30)
        if key not in seen or c['score'] > seen[key]['score']:
            seen[key] = c
    
    deduped = list(seen.values())
    deduped.sort(key=lambda c: c['score'], reverse=True)
    return deduped[0] if deduped else None


def find_corner_markers(image: np.ndarray, qr_bbox: tuple = None) -> dict | None:
    h, w = image.shape[:2]
    
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image.copy()
    
    rx = int(w * 0.48)
    ry = int(h * 0.48)
    
    corners_found = {}
    
    corner_defs = {
        'TL': (0, 0, rx, ry),
        'TR': (w - rx, 0, rx, ry),
        'BL': (0, h - ry, rx, ry),
        'BR': (w - rx, h - ry, rx, ry),
    }
    
    tr_qr_y_min = 0 
    if qr_bbox:
        qx, qy, qw, qh = qr_bbox
        tr_qr_y_min = qy + qh + 20
    
    for corner_name, (ox, oy, cw, ch) in corner_defs.items():
        search_oy = oy
        search_ch = ch
        if corner_name == 'TR' and tr_qr_y_min > oy:
            skip_amount = min(tr_qr_y_min - oy, ch // 2)  
            search_oy = oy + skip_amount
            search_ch = ch - skip_amount
        
        region = gray[search_oy:search_oy + search_ch, ox:ox + cw]
        
        if region.size == 0:
            print(f"  {corner_name}: empty region, skipping")
            continue
        
        result = _find_best_square_in_region(region)
        
        if result is None:
            print(f"  {corner_name}: No marker found in corner region")
        else:
            abs_cx = ox + result['center'][0]
            abs_cy = search_oy + result['center'][1]
            corners_found[corner_name] = {
                'center': (abs_cx, abs_cy),
                'area': result['area'],
                'score': result['score'],
                'bbox': (ox + result['bbox'][0], search_oy + result['bbox'][1],
                         result['bbox'][2], result['bbox'][3]),
            }
            print(f"  {corner_name}: Found at ({abs_cx}, {abs_cy}), area={result['area']:.0f}")
    
    if len(corners_found) < 2:
        print(f"  Only {len(corners_found)} corners found, cannot proceed")
        return None
    
    centers = {k: v['center'] for k, v in corners_found.items()}
    all_corners = {'TL', 'TR', 'BL', 'BR'}
    missing = all_corners - set(centers.keys())
    
    for m in missing:
        ghost = _calculate_ghost(centers, m)
        if ghost:
            ghost = (max(0, min(w-1, ghost[0])), max(0, min(h-1, ghost[1])))
            centers[m] = ghost
            print(f"  {m}: Estimated at {ghost}")
    
    if len(centers) == 4:
        return centers
    return None

def find_all_square_markers(image: np.ndarray, qr_bbox: tuple = None) -> list:
    h, w = image.shape[:2]
    
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image.copy()
    
    qr_tight_zone = None
    qr_wide_zone = None
    if qr_bbox:
        qx, qy, qw, qh = qr_bbox
        tight_margin = int(max(qw, qh) * 0.3)
        qr_tight_zone = (
            max(0, qx - tight_margin), max(0, qy - tight_margin),
            qw + 2 * tight_margin, qh + 2 * tight_margin
        )
    
    gray_blur = cv2.GaussianBlur(gray, (5, 5), 0)
    
    candidates = []
    seen = {} 

    _, binary = cv2.threshold(gray_blur, 150, 255, cv2.THRESH_BINARY_INV)
    kernel = np.ones((25, 25), np.uint8)
    clean = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)
    
    binary_images = [("morph", clean)]
    
    for method_name, clean in binary_images:
        contours, _ = cv2.findContours(clean, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area < 300 or area > 8000:
                continue
            
            x, y, bw, bh = cv2.boundingRect(cnt)
            if bw < 10 or bh < 10:
                continue
            
            ar = bw / float(bh)
            if ar < 0.65 or ar > 1.55:
                continue
            
            hull = cv2.convexHull(cnt)
            hull_area = cv2.contourArea(hull)
            solidity = area / hull_area if hull_area > 0 else 0
            if solidity < 0.80:
                continue
            
            fill = area / (bw * bh)
            if fill < 0.55:
                continue
            
            M = cv2.moments(cnt)
            cx = int(M["m10"] / M["m00"]) if M["m00"] > 0 else x + bw // 2
            cy = int(M["m01"] / M["m00"]) if M["m00"] > 0 else y + bh // 2
            
            dist_left = cx / w
            dist_right = (w - cx) / w
            dist_top = cy / h
            dist_bottom = (h - cy) / h
            min_x_dist = min(dist_left, dist_right)
            min_y_dist = min(dist_top, dist_bottom)
            
            edge_prox = 1.0 - (min_x_dist + min_y_dist)

            edge_bonus = 1.0
            if min_x_dist < 0.20 and min_y_dist < 0.20:
                edge_bonus = 3.0  
            elif min_x_dist < 0.20 or min_y_dist < 0.20:
                edge_bonus = 1.5  
            
            squareness = 1.0 - abs(1.0 - ar)
            quality = squareness * solidity * fill
            score = quality * (area ** 0.5) * edge_bonus
            
            key = (cx // 30, cy // 30)
            if key in seen:
                if score > seen[key]['score']:
                    seen[key] = {
                        'center': (cx, cy),
                        'bbox': (x, y, bw, bh),
                        'area': area,
                        'ar': ar,
                        'solidity': solidity,
                        'fill': fill,
                        'score': score,
                        'edge_bonus': edge_bonus,
                    }
            else:
                seen[key] = {
                    'center': (cx, cy),
                    'bbox': (x, y, bw, bh),
                    'area': area,
                    'ar': ar,
                    'solidity': solidity,
                    'fill': fill,
                    'score': score,
                    'edge_bonus': edge_bonus,
                }
    
    candidates = list(seen.values())
    candidates.sort(key=lambda c: c['score'], reverse=True)
    
    if candidates:
        print(f"  Found {len(candidates)} marker candidates (top-5):")
        for c in candidates[:5]:
            print(f"    center={c['center']}, area={c['area']:.0f}, "
                  f"AR={c['ar']:.2f}, fill={c['fill']:.2f}, "
                  f"score={c['score']:.0f}, edge_bonus={c['edge_bonus']:.1f}")
    
    return candidates[:60]


def select_best_4_markers(candidates: list, img_w: int, img_h: int) -> dict | None:
    if len(candidates) < 4:
        return None
    
    mid_x = img_w / 2
    mid_y = img_h / 2
    
    tls = [c for c in candidates if c['center'][0] < mid_x and c['center'][1] < mid_y]
    trs = [c for c in candidates if c['center'][0] >= mid_x and c['center'][1] < mid_y]
    bls = [c for c in candidates if c['center'][0] < mid_x and c['center'][1] >= mid_y]
    brs = [c for c in candidates if c['center'][0] >= mid_x and c['center'][1] >= mid_y]
    
    print(f"  Quadrant counts: TL={len(tls)}, TR={len(trs)}, BL={len(bls)}, BR={len(brs)}")
    
    for name, group in [('TL', tls), ('TR', trs), ('BL', bls), ('BR', brs)]:
        for c in group[:3]:
            print(f"    {name} candidate: center={c['center']}, area={c['area']:.0f}, score={c['score']:.1f}")
    
    tls = tls[:5]
    trs = trs[:5]
    bls = bls[:5]
    brs = brs[:5]
    
    if tls and trs and bls and brs:
        best = None
        best_rect_area = 0
        
        for tl in tls:
            for tr in trs:
                for bl in bls:
                    for br in brs:
                        result = _evaluate_rectangle(tl, tr, bl, br, img_w, img_h)
                        if result and result > best_rect_area:
                            best_rect_area = result
                            best = {
                                'TL': tl['center'], 'TR': tr['center'],
                                'BL': bl['center'], 'BR': br['center'],
                            }
        
        if best:
            print(f"  4 markers found, rect area = {best_rect_area:.0f}")
            return best
    
    quadrant_data = {'TL': tls, 'TR': trs, 'BL': bls, 'BR': brs}
    filled_quads = {k: v[0] for k, v in quadrant_data.items() if v}
    
    if len(filled_quads) == 3:
        missing = (set(['TL', 'TR', 'BL', 'BR']) - set(filled_quads.keys())).pop()
        centers = {k: v['center'] for k, v in filled_quads.items()}
        ghost = _calculate_ghost(centers, missing)
        if ghost:
            centers[missing] = ghost
            print(f"  3 markers found, ghost for {missing} at {ghost}")
            return centers
    
    # opposite quadrants 
    if len(filled_quads) >= 2:
        for p1, p2 in [('TL', 'BR'), ('TR', 'BL')]:
            if p1 in filled_quads and p2 in filled_quads:
                c1 = filled_quads[p1]['center']
                c2 = filled_quads[p2]['center']
                if p1 == 'TL':
                    est = {
                        'TL': c1, 'BR': c2,
                        'TR': (c2[0], c1[1]),
                        'BL': (c1[0], c2[1]),
                    }
                else:
                    est = {
                        'TR': c1, 'BL': c2,
                        'TL': (c2[0], c1[1]),
                        'BR': (c1[0], c2[1]),
                    }
                print(f"  2 opposite markers ({p1}+{p2}), estimated rectangle")
                return est
    
    return None


def _evaluate_rectangle(tl, tr, bl, br, img_w, img_h) -> float | None:
    w_top = tr['center'][0] - tl['center'][0]
    w_bot = br['center'][0] - bl['center'][0]
    h_left = bl['center'][1] - tl['center'][1]
    h_right = br['center'][1] - tr['center'][1]
    
    min_w = img_w * 0.60
    min_h = img_h * 0.60
    
    if w_top < min_w or w_bot < min_w or h_left < min_h or h_right < min_h:
        return None
    
    w_ratio = min(w_top, w_bot) / max(w_top, w_bot)
    h_ratio = min(h_left, h_right) / max(h_left, h_right)
    
    if w_ratio < 0.85 or h_ratio < 0.85:
        return None
    
    rect_area = ((w_top + w_bot) / 2) * ((h_left + h_right) / 2)
    
    # Area consistency: the 4 markers should have similar sizes
    areas = [tl['area'], tr['area'], bl['area'], br['area']]
    max_a, min_a = max(areas), min(areas)
    area_consistency = min_a / max_a if max_a > 0 else 0
    # Boost if all markers are similar size
    area_factor = area_consistency if area_consistency > 0.3 else area_consistency * 0.5
    
    edge_scores = [
        tl.get('edge_bonus', 1.0),
        tr.get('edge_bonus', 1.0),
        bl.get('edge_bonus', 1.0),
        br.get('edge_bonus', 1.0),
    ]
    avg_edge = sum(edge_scores) / 4.0
    
    return rect_area * area_factor * avg_edge


def _calculate_ghost(centers: dict, missing: str) -> tuple | None:
    """Calculate missing 4th corner using vector addition."""
    if missing == 'TL':
        tr, bl, br = centers['TR'], centers['BL'], centers['BR']
        return (tr[0] + bl[0] - br[0], tr[1] + bl[1] - br[1])
    elif missing == 'TR':
        tl, bl, br = centers['TL'], centers['BL'], centers['BR']
        return (tl[0] + br[0] - bl[0], tl[1] + br[1] - bl[1])
    elif missing == 'BR':
        tl, tr, bl = centers['TL'], centers['TR'], centers['BL']
        return (bl[0] + tr[0] - tl[0], bl[1] + tr[1] - tl[1])
    elif missing == 'BL':
        tl, tr, br = centers['TL'], centers['TR'], centers['BR']
        return (br[0] + tl[0] - tr[0], br[1] + tl[1] - tr[1])
    return None


# CROPPING 

def crop_by_markers(image: np.ndarray, corners: dict, pad_x: int = 0, pad_y: int = 0) -> np.ndarray | None:

    tl = corners['TL']
    tr = corners['TR']
    bl = corners['BL']
    br = corners['BR']
    
    # Calculate output dimensions + padding
    w_top = np.sqrt((tr[0] - tl[0])**2 + (tr[1] - tl[1])**2) + 2 * pad_x
    w_bot = np.sqrt((br[0] - bl[0])**2 + (br[1] - bl[1])**2) + 2 * pad_x
    width = int(max(w_top, w_bot))
    
    h_left = np.sqrt((bl[0] - tl[0])**2 + (bl[1] - tl[1])**2) + 2 * pad_y
    h_right = np.sqrt((br[0] - tr[0])**2 + (br[1] - tr[1])**2) + 2 * pad_y
    height = int(max(h_left, h_right))
    
    if width < 200 or height < 200:
        print(f"  Crop too small: {width}x{height}")
        return None
    
    src = np.array([
        [tl[0] - pad_x, tl[1] - pad_y],
        [tr[0] + pad_x, tr[1] - pad_y],
        [br[0] + pad_x, br[1] + pad_y],
        [bl[0] - pad_x, bl[1] + pad_y]
    ], dtype=np.float32)
    
    dst = np.array([[0, 0], [width-1, 0], [width-1, height-1], [0, height-1]], dtype=np.float32)
    
    M = cv2.getPerspectiveTransform(src, dst)
    result = cv2.warpPerspective(image, M, (width, height),
                                  borderMode=cv2.BORDER_CONSTANT,
                                  borderValue=(255, 255, 255))
    
    print(f"  Cropped: {width}x{height}")
    return result


def fallback_border_crop(image: np.ndarray) -> np.ndarray | None:

    h, w = image.shape[:2]
    
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image.copy()
    
    # Try edge-based approach
    for canny_low, canny_high in [(30, 100), (50, 150), (20, 80)]:
        edges = cv2.Canny(gray, canny_low, canny_high)
        kernel = np.ones((3, 3), np.uint8)
        edges = cv2.dilate(edges, kernel, iterations=2)
        
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        best_contour = None
        best_area = 0
        min_area = (w * h) * 0.3
        max_area = (w * h) * 0.95
        
        for contour in contours:
            area = cv2.contourArea(contour)
            if min_area < area < max_area:
                epsilon = 0.02 * cv2.arcLength(contour, True)
                approx = cv2.approxPolyDP(contour, epsilon, True)
                if 4 <= len(approx) <= 6 and area > best_area:
                    best_area = area
                    best_contour = approx
        
        if best_contour is not None:
            rect = cv2.minAreaRect(best_contour)
            box = cv2.boxPoints(rect)
            pts = np.array(box, dtype=np.float32)
            s = pts.sum(axis=1)
            diff = np.diff(pts, axis=1).flatten()
            
            corners = {
                'TL': tuple(pts[np.argmin(s)].astype(int)),
                'TR': tuple(pts[np.argmin(diff)].astype(int)),
                'BR': tuple(pts[np.argmax(s)].astype(int)),
                'BL': tuple(pts[np.argmax(diff)].astype(int)),
            }
            
            result = crop_by_markers(image, corners)
            if result is not None:
                print(f"  Fallback: border detection crop")
                return result
    
    # Adaptive threshold approach
    binary = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                   cv2.THRESH_BINARY_INV, 31, 5)
    kernel = np.ones((5, 5), np.uint8)
    binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=3)
    
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    best_contour = None
    best_area = 0
    min_area = (w * h) * 0.3
    max_area = (w * h) * 0.95
    
    for contour in contours:
        area = cv2.contourArea(contour)
        if min_area < area < max_area and area > best_area:
            best_area = area
            best_contour = contour
    
    if best_contour is not None:
        rect = cv2.minAreaRect(best_contour)
        box = cv2.boxPoints(rect)
        pts = np.array(box, dtype=np.float32)
        s = pts.sum(axis=1)
        diff = np.diff(pts, axis=1).flatten()
        
        corners = {
            'TL': tuple(pts[np.argmin(s)].astype(int)),
            'TR': tuple(pts[np.argmin(diff)].astype(int)),
            'BR': tuple(pts[np.argmax(s)].astype(int)),
            'BL': tuple(pts[np.argmax(diff)].astype(int)),
        }
        
        result = crop_by_markers(image, corners)
        if result is not None:
            print(f"  Fallback: adaptive threshold crop")
            return result
    
    return None

def process_pdf(pdf_bytes: bytes, paper_id: str = None) -> dict:

    ensure_temp_folder()
    session_folder = create_session_folder()
    session_id = session_folder.name
    
    result = {
        "success": False,
        "session_id": session_id,
        "students": [],
        "error": None
    }
    
    if ENABLE_DEBUG_IMAGES:
        debug_session = ensure_debug_folder() / session_id
        debug_session.mkdir(parents=True, exist_ok=True)
    
    try:
        print(f"Converting PDF at {DPI} DPI...")
        images = convert_from_bytes(pdf_bytes, dpi=DPI)
        print(f"Converted {len(images)} pages")
        
        # Scan all QR codes
        print(f"\n{'='*60}")
        print("PASS 1: Scanning all QR codes")
        print(f"{'='*60}")
        
        page_data = []
        
        for page_idx, pil_image in enumerate(images):
            print(f"\n--- Page {page_idx + 1}/{len(images)} ---")
            
            cv_image = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
            
            # Try QR decode with rotation fallback
            qr_data, qr_bbox, corrected_image, rotation_angle = try_qr_with_rotations(cv_image)
            
            if qr_data is not None:
                if rotation_angle != 0:
                    corrected_pil = Image.fromarray(cv2.cvtColor(corrected_image, cv2.COLOR_BGR2RGB))
                else:
                    corrected_pil = pil_image
                
                cms_id = qr_data.get('cmsId', 'unknown')
                page_number = qr_data.get('pg', -1)
                print(f"  QR: CMS={cms_id}, Page={page_number}" +
                      (f" (rotated {rotation_angle}°)" if rotation_angle else ""))
                
                page_data.append({
                    'page_idx': page_idx,
                    'qr_data': qr_data,
                    'qr_bbox': qr_bbox,
                    'cv_image': corrected_image,
                    'pil_image': corrected_pil,
                    'cms_id': cms_id,
                    'page_number': page_number,
                    'rotation': rotation_angle,
                    'qr_found': True
                })
            else:
                print(f"  No QR found")
                page_data.append({
                    'page_idx': page_idx,
                    'qr_data': None,
                    'qr_bbox': None,
                    'cv_image': cv_image,
                    'pil_image': pil_image,
                    'cms_id': None,
                    'page_number': -1,
                    'rotation': 0,
                    'qr_found': False
                })
        
        for i, pd in enumerate(page_data):
            if not pd['qr_found']:
                for j in range(i - 1, -1, -1):
                    if page_data[j]['qr_found']:
                        pd['cms_id'] = page_data[j]['cms_id']
                        print(f"  Page {i+1} (no QR) -> {pd['cms_id']}")
                        break
                if pd['cms_id'] is None:
                    for j in range(i + 1, len(page_data)):
                        if page_data[j]['qr_found']:
                            pd['cms_id'] = page_data[j]['cms_id']
                            print(f"  Page {i+1} (no QR) -> {pd['cms_id']}")
                            break
        
        # PASS 2: Group by cmsId, sort, detect markers, crop
        print(f"\n{'='*60}")
        print("PASS 2: Grouping and cropping")
        print(f"{'='*60}")
        
        # Group pages by cmsId
        student_pages = {}
        for pd in page_data:
            cms_id = pd['cms_id']
            if cms_id is None:
                continue
            if cms_id not in student_pages:
                student_pages[cms_id] = []
            student_pages[cms_id].append(pd)
        
        # Sort each student pages by page number
        for cms_id in student_pages:
            student_pages[cms_id].sort(key=lambda x: x['page_number'])
        
        print(f"\nFound {len(student_pages)} students:")
        for cms_id, pages in student_pages.items():
            pg_nums = [p['page_number'] for p in pages]
            print(f"  {cms_id}: pages {pg_nums}")
        
        # Process each student
        students = []
        
        for cms_id, pages in student_pages.items():
            print(f"\n{'='*40}")
            print(f"Student: {cms_id}")
            print(f"{'='*40}")
            
            cms_id_safe = cms_id.replace('/', '-')
            student_folder = session_folder / cms_id_safe
            student_folder.mkdir(parents=True, exist_ok=True)
            cropped_folder = student_folder / "cropped"
            cropped_folder.mkdir(parents=True, exist_ok=True)
            originals_folder = student_folder / "originals"
            originals_folder.mkdir(parents=True, exist_ok=True)
            review_folder = student_folder / "review_needed"
            
            cropped_paths = []
            original_paths = []
            student_qr_data = None
            
            for pd in pages:
                page_number = pd['page_number']
                qr_data = pd['qr_data']
                cv_image = pd['cv_image']
                pil_image = pd['pil_image']
                page_idx = pd['page_idx']
                qr_bbox = pd['qr_bbox']
                
                if qr_data and student_qr_data is None:
                    student_qr_data = qr_data
                
                # Cover page, did not croped
                if page_number == 0:
                    cover_path = originals_folder / "page_00_cover.jpg"
                    pil_image.save(cover_path, "JPEG", quality=85)
                    pil_image.save(student_folder / "cover.jpg", "JPEG", quality=85)
                    original_paths.append(str(cover_path))
                    print(f"\n  Page {page_number}: Cover saved")
                    continue
                
                print(f"\n  Page {page_number}:")
                
                # Save original
                original_filename = f"page_{page_number:02d}.jpg"
                original_path = originals_folder / original_filename
                pil_image.save(original_path, "JPEG", quality=85)
                original_paths.append(str(original_path))
                
                # Find all square marker candidates
                candidates = find_all_square_markers(cv_image, qr_bbox)
                print(f"  Found {len(candidates)} marker candidates total")
                
                # Select best 4 forming a rectangle 
                marker_corners = select_best_4_markers(
                    candidates, cv_image.shape[1], cv_image.shape[0]
                )
                
                # Crop 
                cropped = None
                if marker_corners:
                    cropped = crop_by_markers(cv_image, marker_corners)
                
                # Fallback to border detection 
                if cropped is None:
                    print(f"  Marker crop failed, trying border detection...")
                    cropped = fallback_border_crop(cv_image)
                
                # Generate filename
                if qr_data:
                    filename = generate_filename(qr_data)
                else:
                    filename = f"{cms_id_safe}_unknown_P{page_number}_TP0.jpg"
                
                # Save result
                if cropped is not None:
                    cropped_path = cropped_folder / filename
                    cv2.imwrite(str(cropped_path), cropped)
                    cropped_paths.append(str(cropped_path))
                    print(f"  ✓ Saved: {filename}")
                else:
                    review_folder.mkdir(parents=True, exist_ok=True)
                    review_path = review_folder / filename
                    cv2.imwrite(str(review_path), cv_image)
                    cropped_paths.append(str(review_path))
                    print(f"  ✗ Review needed: {filename}")
                
                # Debug image
                if ENABLE_DEBUG_IMAGES:
                    debug_img = cv_image.copy()
                    # Draw all candidates as small circles
                    for c in candidates:
                        cv2.circle(debug_img, c['center'], 8, (255, 0, 0), 2)
                    # Draw selected markers as large circles
                    if marker_corners:
                        for name, pt in marker_corners.items():
                            cv2.circle(debug_img, (int(pt[0]), int(pt[1])), 25, (0, 255, 0), 3)
                            cv2.putText(debug_img, name, 
                                       (int(pt[0]) + 30, int(pt[1])),
                                       cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
                    cv2.imwrite(str(debug_session / f"page_{page_idx + 1}.jpg"), debug_img)
            
            # Sort cropped paths by page number
            cropped_paths = sorted(cropped_paths, key=extract_page_num)
            
            # Build student record
            if student_qr_data:
                students.append({
                    "cms_id": cms_id,
                    "name": student_qr_data.get('n', ''),
                    "section": student_qr_data.get('s', 'X'),
                    "course_code": student_qr_data.get('c', ''),
                    "pages": cropped_paths,
                    "original_pages": original_paths
                })
        
        # Generate combined PDF
        print(f"\nGenerating combined PDFs...")
        for s in students:
            original_pages = s.get("original_pages", [])
            if original_pages:
                cms_id = s["cms_id"].replace('/', '-')
                student_folder = session_folder / cms_id
                pdf_path = student_folder / "answer_sheet.pdf"
                if combine_images_to_pdf(original_pages, pdf_path):
                    s["pdf_path"] = str(pdf_path)
                else:
                    s["pdf_path"] = None
            else:
                s["pdf_path"] = None
        
        result["success"] = True
        result["students"] = [
            {
                "cms_id": s["cms_id"],
                "name": s.get("name", ""),
                "section": s["section"],
                "course_code": s["course_code"],
                "total_pages": len(s.get("original_pages", [])),
                "pdf_path": str(Path(s["pdf_path"]).relative_to(session_folder)) if s.get("pdf_path") else None,
                "cropped_images": [str(Path(p).relative_to(session_folder)) for p in s["pages"]],
                "original_images": [str(Path(p).relative_to(session_folder)) for p in s.get("original_pages", [])]
            }
            for s in students
        ]
        total = sum(len(s["pages"]) for s in students)
        print(f"\n{'='*60}")
        print(f"DONE: {len(students)} students, {total} pages processed")
        print(f"{'='*60}")
        
    except Exception as e:
        result["error"] = str(e)
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    
    return result

# SESSION MANAGEMENT

def get_all_sessions() -> list[dict]:
    ensure_temp_folder()
    sessions = []
    
    for session_dir in sorted(TEMP_FOLDER.iterdir(), reverse=True):
        if session_dir.is_dir() and session_dir.name.startswith("session_"):
            session_data = {
                "session_id": session_dir.name,
                "created_at": session_dir.name.replace("session_", ""),
                "students": []
            }
            
            for student_dir in session_dir.iterdir():
                if student_dir.is_dir():
                    student_data = {
                        "cms_id": student_dir.name,
                        "has_cover": (student_dir / "cover.jpg").exists(),
                        "cropped_images": [],
                        "review_needed": []
                    }
                    
                    cropped_dir = student_dir / "cropped"
                    if cropped_dir.exists():
                        imgs = sorted(cropped_dir.glob("*.jpg"),
                                     key=lambda p: extract_page_num(str(p)))
                        for img in imgs:
                            student_data["cropped_images"].append(
                                str(img.relative_to(TEMP_FOLDER)))
                    
                    review_dir = student_dir / "review_needed"
                    if review_dir.exists():
                        imgs = sorted(review_dir.glob("*.jpg"),
                                     key=lambda p: extract_page_num(str(p)))
                        for img in imgs:
                            student_data["review_needed"].append(
                                str(img.relative_to(TEMP_FOLDER)))
                    
                    session_data["students"].append(student_data)
            
            sessions.append(session_data)
    return sessions

def clear_temp_folder() -> bool:
    try:
        if TEMP_FOLDER.exists():
            shutil.rmtree(TEMP_FOLDER)
        TEMP_FOLDER.mkdir(parents=True, exist_ok=True)
        return True
    except:
        return False

def clear_session(session_id: str) -> bool:
    try:
        session_folder = TEMP_FOLDER / session_id
        if session_folder.exists():
            shutil.rmtree(session_folder)
        return True
    except:
        return False
