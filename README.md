# medai — ИИ в медицине: база знаний и модель «Концентрация и дыхание»

Статический пул из девяти страниц. Ни сборки, ни сервера: откройте `site/index.html`.

| Файл | Что это |
|---|---|
| `site/index.html` | титульная страница комплекта |
| `site/00-ukazatel-bz-ii-medicina.html` | российский сегмент базы знаний |
| `site/01-zarubezhnyy-segment.html` | зарубежный сегмент: США, ЕС, Великобритания, Китай, Залив, ЕАЭС |
| `site/02-paralleli-i-modeli.html` | параллели с агентными платежами, интерактивные модели |
| `site/03-koncentraciya-i-ii-medicina.html` | инструменты: формулировки, скрининг, мандат, сессия с датчиком |
| `site/04-processnaya-model.html` | процессная модель карты инструментов |
| `site/05-trek-osvoeniya.html` | трек освоения базы знаний |
| `site/06-uroven-uchastiya.html` | уровень участия пациента |
| `site/concentration-breathing-model.html` | рабочая модель «Концентрация и дыхание» |

## Запуск
```bash
open site/index.html          # macOS
python3 -m http.server -d site 8080   # если нужен http (Bluetooth-датчик требует https или file://)
```

## Тесты
```bash
npm install
npm test
```

## Деплой
Скопировать `site/` на хостинг. Ссылки между страницами относительные.
