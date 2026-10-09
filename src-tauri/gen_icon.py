#!/usr/bin/env python3
# 如期而至 应用图标源图生成器（numpy + Pillow，无其他第三方依赖）
#
# 配色不写死：启动时直接从 src/style.css 读取主题变量，和应用保持一致——
#   --accent       品牌红（底色渐变起点）
#   #ff8f6b        .logo 品牌渐变终点（与 --accent 组成 135° 品牌渐变）
#   --accent-btn   深红（投影 / 次要色）
#   --ok           成功色（对勾），可用 CHECK="green" 换成通用绿
#
# 设计：品牌红橙渐变圆角方块（Apple 连续曲率 squircle 近似）
#   + 白色日历卡片（带装订环 + 卡片投影） + 对勾（如期而至 / 已处理）
# 通过超采样渲染 + 高斯投影，输出 1024x1024 RGBA PNG，
# 供 `npm run icon`（tauri icon）生成各平台所需的尺寸。
#
# 备选：CONCEPT 可改为 "A2"（无装订环）/ "B"（时钟 + 对勾徽标）/ "C"（日历 + 铃铛）。
import pathlib
import re
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageChops

CONCEPT = "A"
CHECK = "green"       # "green" 用通用绿 #22c55e；"ok" 用主题成功色 --ok
HEADER = True         # 日历卡顶部的品牌红标题带；开启时底色自动压深一档，否则红标题带会融进背景

HERE = pathlib.Path(__file__).resolve().parent
CSS = HERE.parent / "src" / "style.css"

D, S = 1024.0, 2048          # 设计坐标系 1024，超采样渲染 2048
K = S / D


def sq(v):
    return v * K


def hx(s):
    s = s.lstrip("#")
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))


def mix(c1, c2, t):
    return tuple(round(a + (b - a) * t) for a, b in zip(c1, c2))


def css_color(var, default):
    try:
        txt = CSS.read_text(encoding="utf-8")
    except OSError:
        return hx(default)
    m = re.search(r"--%s\s*:\s*(#[0-9a-fA-F]{3,8})" % re.escape(var), txt)
    return hx(m.group(1)) if m else hx(default)


def css_logo_gradient_end(default="#ff8f6b"):
    try:
        txt = CSS.read_text(encoding="utf-8")
    except OSError:
        return hx(default)
    m = re.search(r"linear-gradient\([^)]*?,\s*#([0-9a-fA-F]{6})\s*\)", txt)
    return hx(m.group(1)) if m else hx(default)


ACCENT = css_color("accent", "#ff5a5f")        # 品牌红
ACCENT2 = css_logo_gradient_end("#ff8f6b")     # 品牌渐变终点
BTN = css_color("accent-btn", "#d23a40")       # 深红
OK = css_color("ok", "#2dd4bf")                # 成功色

SHADOW = mix(BTN, (0, 0, 0), 0.55)                     # 暖色投影
SHADE = mix(BTN, (0, 0, 0), 0.35)                      # 底部内阴影
CARD_1, CARD_2 = (255, 255, 255), mix((255, 255, 255), ACCENT, 0.045)
RING_EDGE = mix((255, 255, 255), ACCENT, 0.30)
CHECK_C = OK if CHECK == "ok" else (34, 197, 94)


def L(v=0):
    return Image.new("L", (S, S), v)


def translate(img, dx, dy):
    return img.transform(img.size, Image.AFFINE, (1, 0, -sq(dx), 0, 1, -sq(dy)),
                         resample=Image.BICUBIC, fillcolor=0)


def blur(img, r):
    return img.filter(ImageFilter.GaussianBlur(sq(r)))


def rgba(alpha, color):
    base = color if isinstance(color, Image.Image) else Image.new("RGB", (S, S), color)
    out = base.convert("RGBA")
    out.putalpha(alpha if isinstance(alpha, Image.Image) else Image.fromarray(alpha, "L"))
    return out


def scale_alpha(mask, op):
    return Image.fromarray((np.array(mask, np.float32) * op).clip(0, 255).astype(np.uint8), "L")


def shadow(mask, r, color, op, dx=0.0, dy=0.0):
    m = blur(mask, r)
    if dx or dy:
        m = translate(m, dx, dy)
    return rgba(scale_alpha(m, op), color)


def vgrad(c0, c1):
    t = np.linspace(0, 1, S, dtype=np.float32)[:, None, None]
    a, b = np.array(c0, np.float32)[None, None, :], np.array(c1, np.float32)[None, None, :]
    return Image.fromarray(np.repeat(a + (b - a) * t, S, axis=1).astype(np.uint8), "RGB")


def diag_grad(c0, c1):
    """135° 对角渐变（左上 → 右下），与 CSS linear-gradient(135deg, …) 一致。"""
    t = np.linspace(0, 1, S, dtype=np.float32)
    g = ((t[:, None] + t[None, :]) / 2.0)[:, :, None]
    a, b = np.array(c0, np.float32)[None, None, :], np.array(c1, np.float32)[None, None, :]
    return Image.fromarray((a + (b - a) * g).astype(np.uint8), "RGB")


def radial_alpha(cx, cy, r):
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
    d = np.sqrt((xx - sq(cx)) ** 2 + (yy - sq(cy)) ** 2) / sq(r)
    return Image.fromarray(((np.clip(1 - d, 0, 1) ** 2) * 255).astype(np.uint8), "L")


def m_rrect(x0, y0, x1, y1, r):
    m = L()
    ImageDraw.Draw(m).rounded_rectangle([sq(x0), sq(y0), sq(x1), sq(y1)], radius=sq(r), fill=255)
    return m


def m_ellipse(cx, cy, rx, ry=None):
    ry = rx if ry is None else ry
    m = L()
    ImageDraw.Draw(m).ellipse([sq(cx - rx), sq(cy - ry), sq(cx + rx), sq(cy + ry)], fill=255)
    return m


def m_poly(pts):
    m = L()
    ImageDraw.Draw(m).polygon([(sq(x), sq(y)) for x, y in pts], fill=255)
    return m


def m_line(points, w):
    m = L()
    d = ImageDraw.Draw(m)
    d.line([(sq(x), sq(y)) for x, y in points], fill=255, width=int(sq(w)), joint="curve")
    for x, y in (points[0], points[-1]):
        d.ellipse([sq(x - w / 2), sq(y - w / 2), sq(x + w / 2), sq(y + w / 2)], fill=255)
    return m


def squircle(n=5.0, eps=0.007):
    """超椭圆 |x|^n+|y|^n=1 近似 Apple 连续曲率圆角（n=5 时圆角半径约 226/1024）。"""
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
    u, v = (xx + 0.5) / S * 2 - 1, (yy + 0.5) / S * 2 - 1
    f = np.abs(u) ** n + np.abs(v) ** n
    return Image.fromarray((np.clip(0.5 - (f - 1.0) / eps, 0, 1) * 255).astype(np.uint8), "L")


U, I = ImageChops.lighter, ImageChops.multiply


def base_bg(c0=None, c1=None, glow_c=(455, 190), glow_r=780, glow_op=0.22):
    """品牌渐变圆角方块 + 顶部柔光 + 顶缘高光 + 底部内阴影。"""
    c0 = ACCENT if c0 is None else c0
    c1 = ACCENT2 if c1 is None else c1
    sm = squircle()
    c = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    c = Image.alpha_composite(c, rgba(sm, diag_grad(c0, c1)))
    c = Image.alpha_composite(c, rgba(scale_alpha(I(radial_alpha(*glow_c, glow_r), sm), glow_op), (255, 255, 255)))
    rim = ImageChops.subtract(sm, translate(sm, 0, 5))
    c = Image.alpha_composite(c, rgba(scale_alpha(blur(rim, 1.4), 0.38), (255, 255, 255)))
    low = ImageChops.subtract(sm, translate(sm, 0, -9))
    c = Image.alpha_composite(c, rgba(scale_alpha(blur(low, 4), 0.26), SHADE))
    return c


def calendar_card(rings=True):
    # 有标题带时底色压深一档，让品牌红标题带从背景里跳出来；无标题带时直接用品牌渐变
    if HEADER:
        c = base_bg(mix(ACCENT, BTN, 0.30), mix(ACCENT2, BTN, 0.18))
    else:
        c = base_bg()
    card = m_rrect(196, 176, 828, 848, 108)
    c = Image.alpha_composite(c, shadow(card, 32, SHADOW, 0.30, dy=20))
    c = Image.alpha_composite(c, rgba(card, vgrad(CARD_1, CARD_2)))
    if HEADER:
        head = I(card, m_rrect(0, 176, 1024, 366, 2))
        c = Image.alpha_composite(c, rgba(head, vgrad(ACCENT, mix(BTN, (0, 0, 0), 0.25))))
        c = Image.alpha_composite(c, rgba(scale_alpha(blur(I(card, m_rrect(0, 366, 1024, 392, 1)), 8), 0.10), SHADE))
    if rings:
        def pill(ins=0):
            return U(m_rrect(392 - 19 + ins, 130 + ins, 392 + 19 - ins, 248 - ins, 19 - ins),
                     m_rrect(632 - 19 + ins, 130 + ins, 632 + 19 - ins, 248 - ins, 19 - ins))
        c = Image.alpha_composite(c, shadow(pill(), 7, SHADOW, 0.24, dy=6))
        c = Image.alpha_composite(c, rgba(ImageChops.subtract(pill(), pill(4)), RING_EDGE))
        c = Image.alpha_composite(c, rgba(pill(4), vgrad((255, 255, 255), mix((255, 255, 255), ACCENT, 0.10))))
    return c


def concept_A():
    c = calendar_card(True)
    chk = m_line([(352, 597), (478, 723), (672, 491)], 72)
    c = Image.alpha_composite(c, shadow(chk, 9, mix(CHECK_C, (0, 0, 0), 0.45), 0.20, dy=8))
    return Image.alpha_composite(c, rgba(chk, diag_grad(CHECK_C, mix(CHECK_C, (0, 0, 0), 0.28))))


def concept_A2():
    c = calendar_card(False)
    chk = m_line([(346, 580), (474, 712), (676, 468)], 76)
    c = Image.alpha_composite(c, shadow(chk, 10, mix(CHECK_C, (0, 0, 0), 0.45), 0.20, dy=8))
    return Image.alpha_composite(c, rgba(chk, diag_grad(CHECK_C, mix(CHECK_C, (0, 0, 0), 0.28))))


def concept_B():
    c = base_bg()
    face = m_ellipse(512, 512, 302)
    c = Image.alpha_composite(c, shadow(face, 30, SHADOW, 0.32, dy=20))
    c = Image.alpha_composite(c, rgba(face, vgrad(CARD_1, CARD_2)))
    ticks_maj, ticks_min = L(), L()
    for i in range(12):
        t = np.deg2rad(i * 30 - 90)
        major = i % 3 == 0
        r0, r1 = (224, 274) if major else (242, 268)
        seg = m_line([(512 + r0 * np.cos(t), 512 + r0 * np.sin(t)),
                      (512 + r1 * np.cos(t), 512 + r1 * np.sin(t))], 20 if major else 10)
        (ticks_maj if major else ticks_min).paste(seg, (0, 0), seg)
    c = Image.alpha_composite(c, rgba(ticks_min, mix((255, 255, 255), ACCENT, 0.35)))
    c = Image.alpha_composite(c, rgba(ticks_maj, ACCENT))

    def pt(a, ln):
        return (512 + ln * np.sin(np.deg2rad(a)), 512 - ln * np.cos(np.deg2rad(a)))

    hands = U(m_line([(512, 512), pt(300, 142)], 32), m_line([(512, 512), pt(60, 204)], 32))
    c = Image.alpha_composite(c, shadow(hands, 5, SHADOW, 0.16, dy=4))
    c = Image.alpha_composite(c, rgba(hands, mix(BTN, (0, 0, 0), 0.35)))
    c = Image.alpha_composite(c, rgba(m_ellipse(512, 512, 26), mix(BTN, (0, 0, 0), 0.35)))
    bx, by, br = 722, 740, 142
    c = Image.alpha_composite(c, shadow(m_ellipse(bx, by, br), 14, SHADOW, 0.30, dy=8))
    c = Image.alpha_composite(c, rgba(m_ellipse(bx, by, br), (255, 255, 255)))
    c = Image.alpha_composite(c, rgba(m_ellipse(bx, by, br - 26), diag_grad(CHECK_C, mix(CHECK_C, (0, 0, 0), 0.28))))
    c = Image.alpha_composite(c, rgba(m_line([(bx - 58, by + 2), (bx - 16, by + 44), (bx + 60, by - 42)], 32), (255, 255, 255)))
    return c


def bell_mask(cx, cy, half=86, top=-88, bot=74, dome_r=46):
    ys = np.linspace(top, bot, 80)
    wdt = lambda y: half * np.sin(((y - top) / (bot - top)) ** 1.32 * (np.pi / 2))
    pts = [(cx - wdt(y), cy + y) for y in ys] + [(cx + wdt(y), cy + y) for y in ys[::-1]]
    return U(m_poly(pts), m_ellipse(cx, cy + top + 30, dome_r, dome_r * 0.94))


def concept_C():
    c = calendar_card(False)
    cx, cy = 512, 596
    bell = U(U(bell_mask(cx, cy), m_rrect(cx - 108, cy + 66, cx + 108, cy + 98, 16)), m_ellipse(cx, cy + 124, 21, 19))
    c = Image.alpha_composite(c, shadow(bell, 9, SHADOW, 0.20, dy=8))
    return Image.alpha_composite(c, rgba(bell, diag_grad(ACCENT, mix(BTN, (0, 0, 0), 0.30))))


CONCEPTS = {"A": concept_A, "A2": concept_A2, "B": concept_B, "C": concept_C}

if __name__ == "__main__":
    master = CONCEPTS[CONCEPT]()
    master.resize((1024, 1024), Image.LANCZOS).save(str(HERE / "icon-source.png"))
    print("icon-source.png written (concept %s, accent #%02x%02x%02x, check #%02x%02x%02x)"
          % ((CONCEPT,) + ACCENT + CHECK_C))
