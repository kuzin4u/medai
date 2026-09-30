#!/usr/bin/env python3
"""Хук после правки: журнал, защита ключевых файлов, поиск секретов."""
import json, os, re, sys, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LOG = os.path.join(ROOT, ".claude", "hooks.log")

# файлы, правку которых отмечаем отдельно: авторская модель и формат записи
WATCH = ("site/concentration-breathing-model.html",)
SECRET = re.compile(r"(sk-ant-[A-Za-z0-9\-_]{10,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)")

def log(msg):
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(f"{datetime.datetime.now().isoformat(timespec='seconds')}  {msg}\n")

def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        return 0
    tool = data.get("tool_name", "")
    inp = data.get("tool_input", {}) or {}
    path = inp.get("file_path") or inp.get("path") or ""
    cmd = inp.get("command", "")
    rel = os.path.relpath(path, ROOT) if path else ""

    if cmd:
        log(f"Bash: {cmd[:160]}")
        # правки через shell тоже считаем правками
        for m in re.finditer(r"(?:cp|mv|sed -i|tee|cat\s*>>?)\s+\S*?(site/[\w\-.]+\.html)", cmd):
            log(f"  правка через shell: {m.group(1)}")
    elif rel:
        log(f"{tool}: {rel}")
        if rel.replace("\\", "/") in WATCH:
            log("  ВНИМАНИЕ: правка авторской модели — правка должна быть точечной, нужен прогон npm test")

    # поиск секретов в изменённом файле
    if path and os.path.isfile(path):
        try:
            text = open(path, encoding="utf-8", errors="ignore").read()
            if SECRET.search(text):
                print("Найден похожий на секрет фрагмент в " + rel + ". Правка отклонена.", file=sys.stderr)
                log(f"  БЛОКИРОВКА: секрет в {rel}")
                return 2
        except Exception:
            pass
    return 0

sys.exit(main())
