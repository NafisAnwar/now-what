from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


root = Path(__file__).resolve().parents[2]
render_dir = root / "tmp" / "pdfs" / "render"
output_dir = root / "tmp" / "pdfs" / "contact"
output_dir.mkdir(parents=True, exist_ok=True)

pages = sorted(render_dir.glob("page-*.png"), key=lambda path: int(path.stem.split("-")[-1]))
columns = 3
rows = 4
thumb_width = 350
label_height = 28
gap = 14
margin = 18
font = ImageFont.load_default(size=16)

for sheet_index in range((len(pages) + columns * rows - 1) // (columns * rows)):
    selected = pages[sheet_index * columns * rows:(sheet_index + 1) * columns * rows]
    with Image.open(selected[0]) as sample:
        thumb_height = round(sample.height * thumb_width / sample.width)
    canvas_width = margin * 2 + columns * thumb_width + (columns - 1) * gap
    canvas_height = margin * 2 + rows * (thumb_height + label_height) + (rows - 1) * gap
    canvas = Image.new("RGB", (canvas_width, canvas_height), "#d8d8d8")
    draw = ImageDraw.Draw(canvas)
    for index, path in enumerate(selected):
        row = index // columns
        column = index % columns
        x = margin + column * (thumb_width + gap)
        y = margin + row * (thumb_height + label_height + gap)
        with Image.open(path) as page:
            thumb = page.convert("RGB").resize((thumb_width, thumb_height), Image.Resampling.LANCZOS)
        canvas.paste(thumb, (x, y + label_height))
        page_number = int(path.stem.split("-")[-1])
        draw.text((x, y + 4), f"PAGE {page_number}", fill="#111111", font=font)
        draw.rectangle((x, y + label_height, x + thumb_width - 1, y + label_height + thumb_height - 1), outline="#777777")
    output_path = output_dir / f"contact-{sheet_index + 1}.png"
    canvas.save(output_path, optimize=True)
    print(output_path)
