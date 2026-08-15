# alert-stat

Статичний дашборд статистики повітряних тривог по Україні (області, райони,
громади) — дані, історія, розподіл по годинах/днях тижня, тривалість,
проміжки між тривогами тощо.

**Повністю статичний сайт, без бекенду і без логіна.** GitHub Actions за
розкладом (погодинно) тягне свіжі дані, рахує статистику й комітить готові
JSON-файли в репозиторій; GitHub Pages роздає сайт з папки `docs/`.

## Структура

```
scripts/          Python-пайплайн (фетч даних, довідник локацій, агрегація)
raw_cache/         закешовані сирі відповіді API, по одному файлу на день (комітяться)
alerts.db          SQLite-база, ЗАВЖДИ перебудовується з raw_cache/, не комітиться
docs/              сам сайт (GitHub Pages джерело)
docs/data/         згенеровані JSON для фронтенду (локації, маніфест, статистика)
docs/js/modules/   кожен графік/статистика — окремий незалежний модуль
.github/workflows/ погодинне оновлення даних
```

## Локальний запуск пайплайну

```bash
cd scripts
pip install -r requirements.txt
python fetch_alerts.py --rebuild-db-only   # перебудувати alerts.db з raw_cache/, без мережі
python fetch_alerts.py                     # інкрементальний фетч (сьогодні+вчора+прогалини)
python locations.py                        # довідник область->район->громада
python aggregate.py                        # per-location статистика -> docs/data/
```

Одноразовий повний історичний бекфіл (з дня 1 = 24.02.2022):

```bash
python fetch_alerts.py --backfill-from 1 --backfill-to <today_index - 1>
```

## Локальний перегляд сайту

```bash
python -m http.server 8420 --directory docs
```

## Джерело даних і важливе застереження

Дані беруться з `https://api.alerts.in.ua/v3/alerts/day/{N}.json` —
**недокументованого, офіційно приватного API**. Сама відповідь містить
дисклеймер: "This API is private and may change anytime. Contact
api@alerts.in.ua for public API access."

Тому:
- частота запитів навмисно помірна (погодинно, ~2 запити/год);
- User-Agent описовий і містить контакт (`scripts/common.py`);
- перед публічним запуском варто написати на `api@alerts.in.ua`, розкривши
  проєкт (URL, мету, частоту запитів).

## Додати новий модуль статистики

1. Створити файл у `docs/js/modules/новий-модуль.js`, що експортує
   `{ id, title, description, render(container, locationData, ctx), isApplicable? }`.
2. Додати один `import` і один рядок у масив у `docs/js/module-registry.js`.
3. Якщо модулю потрібні нові поля даних — додати їх у `compute_stats()`
   в `scripts/aggregate.py`.
