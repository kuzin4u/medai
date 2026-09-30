#!/usr/bin/env python3
"""Сводка в конце сессии: что правили, что стоит сделать дальше."""
import os, re, datetime, collections

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LOG = os.path.join(ROOT, ".claude", "hooks.log")
if not os.path.exists(LOG):
    raise SystemExit(0)

today = datetime.date.today().isoformat()
files, bash, warns = collections.Counter(), 0, 0
for line in open(LOG, encoding="utf-8"):
    if not line.startswith(today):
        continue
    if "ВНИМАНИЕ" in line or "БЛОКИРОВКА" in line:
        warns += 1
    m = re.search(r"(?:Write|Edit|MultiEdit):\s+(\S+)", line)
    if m:
        files[m.group(1)] += 1
    elif "Bash:" in line:
        bash += 1
    m2 = re.search(r"правка через shell:\s+(\S+)", line)
    if m2:
        files[m2.group(1)] += 1

if not files and not bash:
    raise SystemExit(0)

print("\n── Сводка сессии ─────────────────────────────")
if files:
    print("Правились файлы:")
    for f, n in files.most_common():
        print(f"  {f}  ({n})")
print(f"Команд в shell: {bash}")
if warns:
    print(f"Предупреждений хука: {warns}")
touched_site = any(f.startswith("site/") for f in files)
if touched_site:
    print("\nНапоминание:")
    print("  • прогнать `npm test`")
    print("  • обновить docs/STATUS.md")
    print("  • коммит — по команде владельца; push и Pull Request делает владелец")
print("──────────────────────────────────────────────\n")
