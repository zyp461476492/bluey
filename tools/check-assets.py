#!/usr/bin/env python3
"""
素材体检：体积、尺寸、主体与背景的对比度。

用法（仓库根目录）：
    python tools/check-assets.py
    python tools/check-assets.py --strict     # 有问题时退出码非 0

为什么需要它：AI 生成的图有两类"看不出来但孩子看不清"的问题——
  1. 单色主体与米色背景对比过低（旧版 egg 米色蛋壳 + 米色背景）
  2. 主体太小，缩略到卡片尺寸后糊成一片

判据来自 docs/09-asset-pipeline.md §8.7：
  前景占比 = 与背景色距离 > 30 的像素比例
  红线：**占比 < 8% 且 平均色差 < 150**（两个条件同时成立）。
  只有占比低不一定是问题——eye/tooth 占比 4–6% 但色差 284，属于面积小但极醒目。
"""
import sys
import glob
import math
import argparse
from PIL import Image

BG = (240, 233, 223)        # 产品卡片底色（docs/04 §5）
DIFF_T = 30                 # 判定为"前景"的色差阈值
MIN_RATIO = 0.08            # 前景占比下限
MIN_DELTA = 150             # 平均色差下限（与占比一起看）
SIZE_MIN = 512              # 源图短边最小边长
SIZE_MAX = 1024
VOL_MAX = 200 * 1024        # 单张体积上限（docs/04 §5）

# eye / tooth 这类"面积小但对比极强"的合法例外，靠 MIN_DELTA 自动放行，无需白名单


def measure(path):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    px = im.load()
    step = max(1, min(w, h) // 160)   # 采样步长，跟着尺寸走

    total = 0
    fg = 0
    delta_sum = 0.0
    for y in range(0, h, step):
        for x in range(0, w, step):
            total += 1
            d = math.dist(px[x, y], BG)
            if d > DIFF_T:
                fg += 1
                delta_sum += d
    ratio = fg / total if total else 0.0
    delta = delta_sum / fg if fg else 0.0
    return w, h, ratio, delta


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--strict", action="store_true", help="有问题时返回非 0")
    args = ap.parse_args()

    files = sorted(glob.glob("assets/*/*.webp"))
    if not files:
        print("assets/ 下没有 webp 素材")
        return 0

    print(f"{'文件':30s}{'尺寸':>10s}{'体积':>8s}{'占比':>8s}{'色差':>7s}  判定")
    bad = []
    total_kb = 0
    for f in files:
        name = f.replace("assets/", "").replace("\\", "/")
        kb = (lambda s: s // 1024)(__import__("os").path.getsize(f))
        total_kb += kb
        w, h, ratio, delta = measure(f)

        reasons = []
        if ratio < MIN_RATIO and delta < MIN_DELTA:
            reasons.append("对比不足")
        if min(w, h) < SIZE_MIN:
            reasons.append(f"尺寸偏小({min(w,h)})")
        if kb * 1024 > VOL_MAX:
            reasons.append("体积超限")

        verdict = "OK" if not reasons else " / ".join(reasons)
        if reasons:
            bad.append((name, verdict))
        print(f"{name:30s}{f'{w}x{h}':>10s}{str(kb)+'KB':>8s}{ratio:8.1%}{delta:7.0f}  {verdict}")

    print(f"\n共 {len(files)} 张，合计 {total_kb}KB，平均 {total_kb//len(files)}KB")
    if bad:
        print(f"需要处理 {len(bad)} 张：")
        for n, r in bad:
            print(f"  - {n}: {r}")
        return 1 if args.strict else 0
    print("全部通过")
    return 0


if __name__ == "__main__":
    sys.exit(main())
