# Как поднять репозиторий и прогнать с Claude Code

## 1. Разложить у себя
```bash
mkdir -p ~/repos && cd ~/repos
unzip ~/Downloads/medai-repo.zip -d medai
cd medai
```

## 2. Git и GitHub
```bash
git init
git add -A
git commit -m "medai: пул базы знаний и модель «Концентрация и дыхание»"
git branch -M main
git checkout -b claude-setup
```
Создайте пустой репозиторий на GitHub (без README и .gitignore), затем:
```bash
git remote add origin git@github.com:<ваш-аккаунт>/medai.git
git push -u origin main
git push -u origin claude-setup
```
Push делаете вы: Claude Code это запрещено настройками.

## 3. Зависимости и тесты
```bash
npm install
npm test
```
Должно пройти около тридцати проверок.

## 4. Claude Code
```bash
claude
```
Первой командой — `/start`. Он прочитает CLAUDE.md, STATUS и DECISIONS и покажет план.

Доступные команды: `/start`, `/task`, `/verify`, `/audit`, `/decision`, `/finish`.
Подагент `reviewer` вызывается перед коммитом.

## 5. Что запрещено настройками
`git push`, `git remote`, `gh pr`, `gh release`, чтение `.env` и файлов с «secret»/«token», `curl`, `rm -rf`.
Правки в `site/` и коммиты — с подтверждением.

## 6. Публикация
Содержимое `site/` кладётся на хостинг целиком. Для GitHub Pages:
настройки репозитория → Pages → ветка `main`, папка `/site`.
