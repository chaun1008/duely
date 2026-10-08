#!/usr/bin/env python3
# 如期而至 应用图标源图生成器（纯 Python，无第三方依赖）
# 设计：蓝色渐变圆角方块 + 白色日历卡片（带装订环） + 绿色对勾（如期/已处理）
# 采用有符号距离场（SDF）做边缘抗锯齿，输出 1024x1024 RGBA PNG，供 `tauri icon` 生成各尺寸。
import struct, zlib, math

W = H = 1024
AA = 2.0  # 抗锯齿半宽（像素）

# 渐变背景（上→下）
BG_TOP = (79, 140, 255)     # #4F8CFF
BG_BOTTOM = (43, 91, 215)   # #2B5BD7
CARD = (255, 255, 255)      # 白色卡片
RING = (51, 65, 85)         # #334155 装订环
CHECK = (34, 197, 94)       # #22C55E 绿色对勾

R_OUT = 200                # 背景圆角半径
# 日历卡片
CARD_CX, CARD_CY = 512, 512
CARD_W, CARD_H = 600, 620
CARD_R = 70
# 装订环
RING_R = 30
RINGS = [(CARD_CX - 85, 214), (CARD_CX + 85, 214)]
# 对勾三段端点：正确走势 A(左上)→B(中下折点)→C(右上高点)，形成 ✓ 而非 ^
A = (365.0, 525.0)
B = (475.0, 635.0)
C = (685.0, 455.0)
CHECK_TH = 56.0


def lerp(a, b, t):
    return a + (b - a) * t


def sdf_round_box(px, py, cx, cy, w, h, r):
    dx = abs(px - cx) - (w / 2 - r)
    dy = abs(py - cy) - (h / 2 - r)
    ax = max(dx, 0.0)
    ay = max(dy, 0.0)
    outside = math.hypot(ax, ay)
    inside = -min(max(dx, dy), 0.0)
    return outside + inside - r


def sdf_circle(px, py, cx, cy, rr):
    return math.hypot(px - cx, py - cy) - rr


def sdf_seg(px, py, ax, ay, bx, by):
    dx = bx - ax
    dy = by - ay
    if dx == 0 and dy == 0:
        return math.hypot(px - ax, py - ay)
    t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)
    t = max(0.0, min(1.0, t))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def cov(sdf):
    return max(0.0, min(1.0, 0.5 - sdf / AA))


def blend(buf, px, py, color, a):
    if a <= 0:
        return
    o = (py * W + px) * 4
    ba = buf[o + 3] / 255.0
    na = a + ba * (1 - a)
    if na <= 0:
        return
    for i in range(3):
        buf[o + i] = int((color[i] * a + buf[o + i] * ba * (1 - a)) / na)
    buf[o + 3] = int(na * 255)


buf = bytearray(W * H * 4)  # 全透明

for py in range(H):
    t = py / (H - 1)
    g = (int(lerp(BG_TOP[0], BG_BOTTOM[0], t)),
         int(lerp(BG_TOP[1], BG_BOTTOM[1], t)),
         int(lerp(BG_TOP[2], BG_BOTTOM[2], t)))
    for px in range(W):
        # 背景圆角方块
        d = sdf_round_box(px, py, W / 2, H / 2, W, H, R_OUT)
        blend(buf, px, py, g, cov(d))
        # 白色日历卡片
        d = sdf_round_box(px, py, CARD_CX, CARD_CY, CARD_W, CARD_H, CARD_R)
        blend(buf, px, py, CARD, cov(d))
        # 装订环
        for (rx, ry) in RINGS:
            blend(buf, px, py, RING, cov(sdf_circle(px, py, rx, ry, RING_R)))
        # 绿色对勾（两段胶囊并集）
        d = min(sdf_seg(px, py, A[0], A[1], B[0], B[1]),
                sdf_seg(px, py, B[0], B[1], C[0], C[1])) - CHECK_TH / 2
        blend(buf, px, py, CHECK, cov(d))


def chunk(typ, data):
    return struct.pack(">I", len(data)) + typ + data + struct.pack(">I", zlib.crc32(typ + data) & 0xffffffff)


raw = bytearray()
for py in range(H):
    raw.append(0)
    raw += buf[py * W * 4:(py + 1) * W * 4]

png = b"\x89PNG\r\n\x1a\n"
png += chunk(b"IHDR", struct.pack(">IIBBBBB", W, H, 8, 6, 0, 0, 0))
png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
png += chunk(b"IEND", b"")

with open("src-tauri/icon-source.png", "wb") as f:
    f.write(png)
print("icon-source.png written:", len(png), "bytes")
