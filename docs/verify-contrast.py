#!/usr/bin/env python3
"""Final lock verification for the Lasertopia 'Industrial Arcade' palette."""

def srgb_to_lin(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def luminance(h):
    r, g, b = rgb(h)
    return 0.2126*srgb_to_lin(r) + 0.7152*srgb_to_lin(g) + 0.0722*srgb_to_lin(b)

def ratio(fg, bg):
    l1, l2 = luminance(fg), luminance(bg)
    if l1 < l2:
        l1, l2 = l2, l1
    return (l1 + 0.05) / (l2 + 0.05)

def over(fg, bg, alpha):
    """Composite fg over bg at alpha -> solid hex."""
    f, b = rgb(fg), rgb(bg)
    out = tuple(round(f[i]*alpha + b[i]*(1-alpha)) for i in range(3))
    return '#%02X%02X%02X' % out

P = {
    'canvas':   '#0B0B0A', 'sunken':   '#060605', 'raised':   '#151613',
    'raised-2': '#1E201C', 'rule':     '#2B2E28', 'border':   '#6A6E62',
    'text':     '#F2F3EC', 'text-2':   '#A6A99D', 'text-3':   '#8E9284',
    'accent':   '#C7F73C', 'accent-press': '#A9D62F', 'accent-dim': '#8FB32A',
    'filling':  '#FFA300', 'full':     '#FF5A2B', 'party':    '#FF3EA5',
    'blocked':  '#8E9284', 'ink':      '#0B0B0A',
}

FAILS = []
def chk(fg, bg, label, need, note=''):
    f, b = P.get(fg, fg), P.get(bg, bg)
    r = ratio(f, b)
    ok = r >= need
    if not ok:
        FAILS.append(label)
    print(f'{label:<50} {f} / {b}  {r:6.2f}:1  need {need}  {"PASS" if ok else "FAIL"} {note}')

print('=== BODY TEXT (AA 4.5:1) ===')
for bgn in ['canvas', 'raised', 'raised-2', 'sunken']:
    for fgn in ['text', 'text-2', 'text-3']:
        chk(fgn, bgn, f'{fgn} on {bgn}', 4.5)

print('\n=== ACCENT + SEMANTIC AS TEXT (AA 4.5:1) ===')
for fgn in ['accent', 'accent-dim', 'filling', 'full', 'party', 'blocked']:
    for bgn in ['canvas', 'raised']:
        chk(fgn, bgn, f'{fgn} on {bgn}', 4.5)

print('\n=== INK ON FILLED CHIPS/BUTTONS (AA 4.5:1) ===')
for bgn in ['accent', 'accent-press', 'filling', 'full', 'party']:
    chk('ink', bgn, f'ink on {bgn} fill', 4.5)

print('\n=== NON-TEXT UI CONTRAST (WCAG 1.4.11 = 3:1) ===')
for bgn in ['canvas', 'raised', 'raised-2']:
    chk('border', bgn, f'control border on {bgn}', 3.0)
chk('accent', 'canvas', 'focus ring on canvas', 3.0)
chk('accent', 'raised', 'focus ring on raised', 3.0)
chk('text', 'canvas', 'focus ring (white outer) on canvas', 3.0)

print('\n=== SELECTED-CELL ACCENT WASH (flat composite, no blur) ===')
for a in (0.10, 0.12, 0.14, 0.18):
    w = over(P['accent'], P['canvas'], a)
    print(f'  accent @ {int(a*100):>2}% over canvas = {w}   '
          f'text {ratio(P["text"], w):5.2f}  accent-text {ratio(P["accent"], w):5.2f}  '
          f'text-2 {ratio(P["text-2"], w):5.2f}')
wash = over(P['accent'], P['canvas'], 0.12)
chk('text', wash, 'primary text on accent wash 12%', 4.5)
chk('accent', wash, 'accent text on accent wash 12%', 4.5)

print('\n=== HATCH STRIPE COLOUR ON SUNKEN (blocked/disabled) ===')
for a in (0.30, 0.40, 0.50):
    h = over(P['blocked'], P['sunken'], a)
    print(f'  blocked @ {int(a*100)}% over sunken = {h}  text-3 on it {ratio(P["text-3"], h):5.2f}')

print('\n' + ('ALL CHECKS PASS' if not FAILS else f'FAILURES: {FAILS}'))
