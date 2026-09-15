from PIL import Image, ImageDraw

NAVY = (13, 21, 38, 255)  # #0d1526
GOLD = (201, 162, 75)
GOLD_BRIGHT = (232, 200, 116, 255)

SCALE = 4  # supersampling factor for anti-aliasing before downscale


def render_mark(logical_size, background):
    """Draws the rings+checkmark mark in a `logical_size`-unit coordinate
    space (matching the original 512-unit design) at high resolution, then
    returns it resized down to `logical_size` px. When `background` is
    False the navy fill is omitted (transparent), for use as an Android
    adaptive-icon foreground layer."""
    px = logical_size * SCALE
    img = Image.new("RGBA", (px, px), NAVY if background else (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx = cy = px / 2
    unit = px / 512.0  # design was authored in 512-unit space

    def ring(radius, width, color, opacity=255):
        r = radius * unit
        w = width * unit
        col = color + (opacity,)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=col, width=int(w))

    ring(150, 26, GOLD)
    ring(96, 20, GOLD, opacity=140)

    stroke_w = int(30 * unit)

    def thick_line(p1, p2):
        x1, y1 = cx + p1[0] * unit, cy + p1[1] * unit
        x2, y2 = cx + p2[0] * unit, cy + p2[1] * unit
        d.line([x1, y1, x2, y2], fill=GOLD_BRIGHT, width=stroke_w)
        r = stroke_w / 2
        d.ellipse([x1 - r, y1 - r, x1 + r, y1 + r], fill=GOLD_BRIGHT)
        d.ellipse([x2 - r, y2 - r, x2 + r, y2 + r], fill=GOLD_BRIGHT)

    thick_line((-68, 6), (-14, 64))
    thick_line((-14, 64), (96, -66))

    return img.resize((logical_size, logical_size), Image.LANCZOS)


# ---- PWA / browser icons (unchanged sizes, in icons/) ----------------------
master = render_mark(1024, background=True)
master.resize((512, 512), Image.LANCZOS).save("icon-512.png")
master.resize((192, 192), Image.LANCZOS).save("icon-192.png")
master.resize((180, 180), Image.LANCZOS).save("apple-touch-icon.png")
master.resize((32, 32), Image.LANCZOS).save("favicon-32.png")

# ---- Native app store / Capacitor Assets source images (in ../assets/) ----
# Consumed by `npx @capacitor/assets generate` to produce Android launcher
# icons (all densities), the adaptive-icon foreground/background layers, and
# the splash screen. See https://github.com/ionic-team/capacitor-assets
master.save("../assets/icon.png")  # 1024x1024, legacy/fallback launcher icon + Play Store listing icon

# Adaptive icon background: flat navy fill (matches the app's theme color).
bg = Image.new("RGBA", (1024, 1024), NAVY)
bg.save("../assets/icon-background.png")

# Adaptive icon foreground: same mark, transparent background, same
# proportions as the master so it sits inside Android's ~66% safe zone.
fg = render_mark(1024, background=False)
fg.save("../assets/icon-foreground.png")

# Splash screen: navy field with the mark centered at a modest scale so it
# reads well even when Android insets/crops the edges on odd aspect ratios.
splash_size = 2732
splash = Image.new("RGBA", (splash_size, splash_size), NAVY)
splash_mark = render_mark(1024, background=False).resize((900, 900), Image.LANCZOS)
offset = ((splash_size - 900) // 2, (splash_size - 900) // 2)
splash.paste(splash_mark, offset, splash_mark)
splash.convert("RGB").save("../assets/splash.png")
splash.convert("RGB").save("../assets/splash-dark.png")

print("done")
