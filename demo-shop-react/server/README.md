# demo-shop REST API — СтепМаркет

Серверная часть учебного магазина на Node.js, Express, Sequelize и PostgreSQL. Подготовлена под приложенный `mockData.json` с вариантами `variantA` (обувь) и `variantB` (спортинвентарь).

## 1. Установка и расположение файлов

Положите папку `server` рядом с `mockData.json`:

```text
demo-shop-react/
├── mockData.json
└── server/
    ├── .env.example
    ├── .gitignore
    ├── package.json
    ├── seed.js
    └── src/
```

Откройте терминал в `server` и установите зависимости:

```bash
npm install
```

Создайте в PostgreSQL базу `de_store`. Скопируйте `.env.example` в `.env` и укажите свои параметры подключения:

```env
DB_NAME=de_store
DB_USER=postgres
DB_PASSWORD=ваш_пароль
DB_HOST=localhost
DB_PORT=5432
PORT=5000
DATA_VARIANT=variantA
```

В `.env.example` и `.env` не нужно добавлять пароль в Git. Файлы `.env` и `node_modules` уже внесены в `.gitignore`.

## 2. Выбор варианта и заполнение БД

В приложенном JSON есть оба набора данных:

- `variantA` — ООО «СтепМаркет», каталог обуви;
- `variantB` — ООО «СпортЛиния», каталог спортинвентаря.

По умолчанию выбран `variantA`. Для варианта Б поменяйте в `.env` значение на `DATA_VARIANT=variantB`.

Заполните БД и запустите сервер:

```bash
npm run seed
npm run dev
```

`npm run seed` использует `../mockData.json`, синхронизирует таблицы с `force: true` и загружает выбранный набор заново. Повторный запуск не создаёт дубликаты, но очищает существующие учебные таблицы, поэтому не запускайте его на БД с нужными пользовательскими заказами.

### Как поля mockData.json попадают в БД

- Пользователи: `id`, `login`, `full_name` → `fullName`, `role_code` → `role`.
- Категории: `id`, `name`.
- Товары: `id`, `name`, `description`, `base_price` → `price`, `image`, `category_id` → `categoryId`, `manufacturer_name` → `manufacturerName`, `composition`.
- Размеры и остатки: каждый объект из `products[].variants[]` записывается в отдельную таблицу `product_variants` (`id`, `productId`, `size`, `stock`). Обязательное поле `Product.stock` хранит сумму остатков всех размеров и обновляется вместе с ними при покупке/отмене.
- Заказы: в JSON один заказ содержит массив `items`. Так как по заданию одна строка `Order` относится к одному товару, каждый элемент `items[]` импортируется как отдельная запись заказа. `sourceOrderId` и `sourceItemId` сохраняют исходные идентификаторы, `size` и `variantId` — размер позиции, `createdAt` берётся из `order_date`. Так сохраняются все позиции исходного заказа.

В исходных заказах нет поля статуса, поэтому для импортированных записей устанавливается `new`. Остатки вариантов берутся непосредственно из `variants[].quantity` — это текущие складские остатки в mockData; импортированные исторические позиции повторно из них не вычитаются.

Для обуви из `variantA` после seed должно быть 4 категории, 4 пользователя, 5 товаров, 14 размерных вариантов и 3 строки заказов.

## 3. Эндпоинты

| Метод | URL | Назначение |
|---|---|---|
| POST | `/api/auth/login` | Вход по `{ "login": "client1" }` |
| GET | `/api/categories` | Список категорий |
| GET | `/api/products` | Каталог с категорией, вариантами размеров и скидкой |
| GET | `/api/products/:id` | Один товар |
| GET | `/api/orders` | Заказы текущего клиента или все заказы менеджера/админа |
| POST | `/api/orders` | Создать заказ `{ "productId": "1", "quantity": 1 }` |
| PATCH | `/api/orders/:id` | Изменить статус, например `{ "status": "cancelled" }` |
| DELETE | `/api/orders/:id` | Удалить заказ (только администратор) |

### Фильтры каталога

Параметры поиска, категории и сортировки работают вместе:

```http
GET /api/products?search=кроссовки&categoryId=1&sort=price_asc
```

В каждом товаре возвращаются `discountPercent` (25 или 0) и `finalPrice`. Скидка 25% действует, если за последний месяц по товару не было заказов со статусом, отличным от `cancelled`.

### Заголовок для заказов

Для всех запросов `/api/orders` обязателен заголовок `x-user-id`. Вход не использует пароль — это учебная имитация авторизации по существующему логину.

Логины варианта А:

| Роль | Login | ID для `x-user-id` |
|---|---|---:|
| Клиент | `client1` | 1 |
| Клиент | `client2` | 2 |
| Менеджер | `manager1` | 3 |
| Администратор | `admin1` | 4 |

Для варианта Б логины и ID такие же, но ФИО пользователей другие.

### Выбор размера при создании заказа

По условию достаточно `{ "productId": "1", "quantity": 1 }`. Если у товара есть размерные варианты и `variantId`/`size` не передан, сервер автоматически выбирает первый по ID размер, где хватает остатка. В реальном запросе лучше указывать выбранный вариант явно:

```json
{
  "productId": "1",
  "variantId": "102",
  "quantity": 1
}
```

Вместо `variantId` можно передать `size`, например `"41"`. Остаток уменьшается и у варианта, и у общего `Product.stock`. При отмене (`cancelled`) оба остатка возвращаются. Повторная отмена возвращает 400 и не меняет склад второй раз.

## 4. Проверка в Postman / Thunder Client

Базовый адрес: `http://localhost:5000`.

1. **Авторизация.** `POST /api/auth/login`, Body → JSON: `{ "login": "client1" }`. Ожидается 200. Для неизвестного логина — 404.
2. **Каталог.** `GET /api/products?search=кроссовки&categoryId=1&sort=price_asc`. Поиск, категория и сортировка применяются одновременно.
3. **Создание заказа.** `POST /api/orders`, заголовки `Content-Type: application/json` и `x-user-id: 1`, Body → JSON:
   ```json
   { "productId": "1", "variantId": "102", "quantity": 1 }
   ```
   Ожидается 201; общий остаток товара 1 и остаток варианта 102 уменьшаются на 1. Для проверки ошибки можно повторить запрос с `variantId: "104"` — у этого размера изначально нулевой остаток, поэтому ожидается 400.
4. **Отмена.** `PATCH /api/orders/<id>` с `x-user-id: 1` и Body `{ "status": "cancelled" }`. Ожидается 200, остатки увеличиваются обратно. Повторная отмена — 400.
5. **Удаление.** `DELETE /api/orders/<id>` с `x-user-id: 3` (менеджер) должен вернуть 403. С `x-user-id: 4` (администратор) — 200.

Проверить состояние сервера можно запросом `GET /api/health`.

## 5. Структура проекта

```text
server/
├── .env.example
├── .gitignore
├── package.json
├── seed.js
└── src/
    ├── app.js
    ├── server.js
    ├── config/database.js
    ├── middleware/require-user.js
    ├── models/index.js
    ├── routes/
    │   ├── auth.routes.js
    │   ├── categories.routes.js
    │   ├── products.routes.js
    │   └── orders.routes.js
    └── utils/
        ├── discount.js
        └── roles.js
```
