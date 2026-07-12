from __future__ import annotations

import json
from pathlib import Path

from pypdf import PdfReader


root = Path(__file__).resolve().parents[2]
pdf_path = root / "output" / "pdf" / "NOW_WHAT_complete_engine_architecture_v1.2_2026-07-12.pdf"
inventory_path = root / "tmp" / "pdfs" / "engine_inventory.json"

reader = PdfReader(str(pdf_path))
page_text = [(page.extract_text() or "") for page in reader.pages]
text = "\n".join(page_text)
sections = [
    "1. Introducing NOW_WHAT?",
    "2. Product Principles and Boundaries",
    "3. System Architecture",
    "4. Local Identity and Data Core",
    "5. Domain Model Reference",
    "6. Feature Modules and User Workflows",
    "7. NOW_WHAT? Engine Architecture",
    "8. Data Lifecycle, Export, Import, and Integrity",
    "9. PWA and Offline Architecture",
    "10. Quality Assurance and Verification",
    "11. Security, Privacy, and Reliability Posture",
    "12. Known Limitations and Technical Debt",
    "13. Architecture Extension Map",
    "Appendix A. Complete Micro-Action Library",
    "Appendix B. Core File Inventory",
    "Appendix C. Package Integrity and Handoff Notes",
    "END OF REPORT",
]
inventory = json.loads(inventory_path.read_text(encoding="utf-8-sig"))
missing_sections = [section for section in sections if section not in text]
missing_actions = [
    action["id"]
    for action in inventory["microActions"]
    if action["id"] not in text
]
blank_pages = [index + 1 for index, value in enumerate(page_text) if not value.strip()]

print(f"pages={len(reader.pages)}")
print(f"characters={len(text)}")
print(f"blank_pages={blank_pages}")
print(f"replacement_characters={text.count(chr(0xFFFD))}")
print(f"missing_sections={missing_sections}")
print(f"micro_actions_expected={len(inventory['microActions'])}")
print(f"missing_micro_action_ids={missing_actions}")

if blank_pages or missing_sections or missing_actions or chr(0xFFFD) in text:
    raise SystemExit(1)
