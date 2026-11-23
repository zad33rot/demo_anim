import { useEffect, useState } from "react";
import rawMockData from "./data/mockData.json";

import Header from "./src/components/Header";
import NoticeBanner from "./src/components/NoticeBanner";
import CatalogPage from "./src/pages/CatalogPage";
import LoginPage from "./src/pages/LoginPage";
import ProductDetailPage from "./src/pages/ProductDetailPage";
import OrdersPage from "./src/pages/OrdersPage";

import { loadFromStorage, saveToStorage } from "./src/services/storage";
import { decrementStock, incrementStock } from "./src/utils/catalogLogic";

// Выберите вариант: "variantA" (обувь) или "variantB" (спортинвентарь)
const ACTIVE_VARIANT = "variantA";
const STORAGE_KEY = `pr_de_state_${ACTIVE_VARIANT}`;

const initialDataset = rawMockData[ACTIVE_VARIANT];
const COMPANY_NAME = initialDataset.companyName;

const PAGE_TITLES = {
  catalog: `${COMPANY_NAME} — ${initialDataset.catalogTitle}`,
  detail: `${COMPANY_NAME} — Карточка товара`,
  login: `${COMPANY_NAME} — Авторизация`,
  orders: `${COMPANY_NAME} — Управление заказами`,
};

function loadInitialState() {
  const saved = loadFromStorage(STORAGE_KEY, null);

  if (saved && Array.isArray(saved.products) && Array.isArray(saved.orders)) {
    return saved;
  }

  return {
    products: initialDataset.products,
    orders: initialDataset.orders,
  };
}

export default function App() {
  const [initialState] = useState(loadInitialState);

  const [products, setProducts] = useState(initialState.products);
  const [orders, setOrders] = useState(initialState.orders);

  const users = initialDataset.users;
  const categories = initialDataset.categories;

  const [user, setUser] = useState(null);
  const [loginInput, setLoginInput] = useState("");

  const [screen, setScreen] = useState("catalog");
  const [prevScreen, setPrevScreen] = useState("catalog");
  const [selectedProductId, setSelectedProductId] = useState(null);

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [sortBy, setSortBy] = useState("");

  const [draftItems, setDraftItems] = useState([]);
  const [targetClient, setTargetClient] = useState(null);

  const [notice, setNotice] = useState(null);

  // 1. Динамический заголовок вкладки браузера
  useEffect(() => {
    document.title = PAGE_TITLES[screen] || COMPANY_NAME;
  }, [screen]);

  // 2. Сохранение данных в localStorage при любых изменениях
  useEffect(() => {
    saveToStorage(STORAGE_KEY, { products, orders });
  }, [products, orders]);

  const navigateTo = (nextScreen) => {
    setPrevScreen(screen);
    setScreen(nextScreen);
  };

  const handleBack = () => {
    if (prevScreen && prevScreen !== screen) {
      setScreen(prevScreen);
    } else {
      setScreen("catalog");
    }
  };

  const handleGoLogin = () => {
    navigateTo("login");
  };

  const handleLogin = (event) => {
    event.preventDefault();

    const cleanedLogin = loginInput.trim();

    if (!cleanedLogin) {
      setNotice({
        type: "error",
        title: "Ошибка авторизации",
        message: "Поле «Логин» не может быть пустым. Введите логин пользователя.",
      });
      return;
    }

    const foundUser = users.find((item) => item.login === cleanedLogin);

    if (!foundUser) {
      setNotice({
        type: "error",
        title: "Ошибка авторизации",
        message: `Пользователь с логином «${cleanedLogin}» не найден.`,
      });
      return;
    }

    setUser(foundUser);
    setTargetClient(foundUser);
    setLoginInput("");
    setScreen("catalog");
    setPrevScreen("catalog");
    setNotice({
      type: "info",
      title: "Вход выполнен",
      message: `Добро пожаловать, ${foundUser.full_name} (${foundUser.role_name}).`,
    });
  };

  const handleLogout = () => {
    setUser(null);
    setTargetClient(null);
    setDraftItems([]);
    setSearch("");
    setCategoryId("all");
    setSortBy("");
    setSelectedProductId(null);
    setScreen("catalog");
    setPrevScreen("catalog");
    setNotice({
      type: "info",
      title: "Выход выполнен",
      message: "Вы вышли из аккаунта.",
    });
  };

  const handleOpenProduct = (productId) => {
    setSelectedProductId(productId);
    setPrevScreen(screen);
    setScreen("detail");
  };

  // -------- Черновик заказа --------

  const handleAddDraftItem = (item) => {
    setDraftItems((prev) => {
      const existing = prev.find((row) => row.variant_id === item.variant_id);

      if (existing) {
        return prev.map((row) =>
          row.variant_id === item.variant_id
            ? { ...row, quantity: row.quantity + item.quantity }
            : row
        );
      }

      return [...prev, item];
    });

    setNotice({
      type: "info",
      title: "Позиция добавлена",
      message: `${item.manufacturer_name} | ${item.product_name}, вариант ${item.size} — ${item.quantity} шт.`,
    });
  };

  const handleRemoveDraftItem = (variantId) => {
    setDraftItems((prev) => prev.filter((item) => item.variant_id !== variantId));
  };

  const handleCancelDraft = () => {
    setDraftItems([]);
    setNotice({
      type: "warning",
      title: "Заказ отменён",
      message: "Черновик заказа очищен, остатки не изменились.",
    });
  };

  const handleSelectClient = (userId) => {
    const found = users.find((item) => item.id === userId);
    if (found) {
      setTargetClient(found);
    }
  };

  const canManageOrders =
    user !== null && (user.role_code === "manager" || user.role_code === "admin");

  // Подтверждение заказа: создание заказа + иммутабельное списание остатков
  const handleConfirmOrder = () => {
    const orderOwner = targetClient || user;

    if (!orderOwner) {
      setNotice({
        type: "error",
        title: "Заказ не оформлен",
        message: "Не выбран клиент, на которого оформляется заказ.",
      });
      return;
    }

    if (draftItems.length === 0) {
      setNotice({
        type: "warning",
        title: "Заказ не оформлен",
        message: "Добавьте хотя бы одну позицию в черновик заказа.",
      });
      return;
    }

    const nextOrderId =
      orders.length > 0 ? Math.max(...orders.map((order) => order.id)) + 1 : 1;

    const newOrder = {
      id: nextOrderId,
      user_id: orderOwner.id,
      client_full_name: orderOwner.full_name,
      order_date: new Date().toISOString().slice(0, 10),
      items: draftItems.map((item, index) => ({
        id: Date.now() + index,
        variant_id: item.variant_id,
        product_id: item.product_id,
        product_name: item.product_name,
        manufacturer_name: item.manufacturer_name,
        size: item.size,
        quantity: item.quantity,
        unit_price: item.unit_price,
      })),
    };

    // Иммутабельное списание остатков
    setProducts((prev) => decrementStock(prev, newOrder.items));
    setOrders((prev) => [newOrder, ...prev]);

    setDraftItems([]);
    setTargetClient(user);

    const nextScreen = canManageOrders && prevScreen === "orders" ? "orders" : "catalog";
    setScreen(nextScreen);
    setPrevScreen("catalog");

    setNotice({
      type: "info",
      title: "Заказ оформлен",
      message: `Заказ №${newOrder.id} на сумму ${newOrder.items.reduce(
        (sum, item) => sum + item.quantity * item.unit_price,
        0
      )} ₽ успешно сохранён.`,
    });
  };

  // -------- Операции администратора над заказами --------

  const handleDeleteOrder = (orderId) => {
    const order = orders.find((item) => item.id === orderId);
    if (!order) {
      return;
    }

    setProducts((prev) => incrementStock(prev, order.items));
    setOrders((prev) => prev.filter((item) => item.id !== orderId));

    setNotice({
      type: "info",
      title: "Заказ удалён",
      message: `Заказ №${orderId} удалён, остатки возвращены в каталог.`,
    });
  };

  const handleDeleteOrderItem = (orderId, itemId) => {
    const order = orders.find((item) => item.id === orderId);
    if (!order) {
      return;
    }

    const targetItem = order.items.find((item) => item.id === itemId);
    if (!targetItem) {
      return;
    }

    setProducts((prev) => incrementStock(prev, [targetItem]));
    setOrders((prev) =>
      prev.map((item) =>
        item.id === orderId
          ? { ...item, items: item.items.filter((row) => row.id !== itemId) }
          : item
      )
    );

    setNotice({
      type: "info",
      title: "Позиция удалена",
      message: `«${targetItem.product_name}» (${targetItem.size}) — ${targetItem.quantity} шт. возвращено в остаток.`,
    });
  };

  const handleChangeOrderDate = (orderId, nextDate) => {
    if (!nextDate) {
      return;
    }

    setOrders((prev) =>
      prev.map((order) =>
        order.id === orderId ? { ...order, order_date: nextDate } : order
      )
    );
  };

  const selectedProduct = products.find((item) => item.id === selectedProductId) || null;

  return (
    <div>
      <Header
        companyName={COMPANY_NAME}
        user={user}
        canManageOrders={canManageOrders}
        onGoCatalog={() => navigateTo("catalog")}
        onGoOrders={() => navigateTo("orders")}
        onGoLogin={handleGoLogin}
        onLogout={handleLogout}
      />

      <main className="container">
        <NoticeBanner notice={notice} onClose={() => setNotice(null)} />

        {/* Экран 1: Авторизация */}
        {screen === "login" && (
          <LoginPage
            users={users}
            loginInput={loginInput}
            onLoginInputChange={setLoginInput}
            onSubmit={handleLogin}
            onBack={handleBack}
          />
        )}

        {/* Экран 2: Каталог */}
        {screen === "catalog" && (
          <CatalogPage
            title={initialDataset.catalogTitle}
            products={products}
            categories={categories}
            orders={orders}
            user={user}
            search={search}
            categoryId={categoryId}
            sortBy={sortBy}
            onSearchChange={setSearch}
            onCategoryChange={setCategoryId}
            onSortChange={setSortBy}
            onSelectProduct={handleOpenProduct}
          />
        )}

        {/* Экран 3: Карточка товара */}
        {screen === "detail" && selectedProduct && (
          <ProductDetailPage
            product={selectedProduct}
            categories={categories}
            orders={orders}
            user={user}
            users={users}
            draftItems={draftItems}
            targetClient={targetClient}
            onAddItem={handleAddDraftItem}
            onRemoveItem={handleRemoveDraftItem}
            onSelectClient={handleSelectClient}
            onConfirmOrder={handleConfirmOrder}
            onCancelOrder={handleCancelDraft}
            onGoLogin={handleGoLogin}
            onBack={handleBack}
          />
        )}

        {screen === "detail" && !selectedProduct && (
          <div className="panel">
            Товар не найден.{" "}
            <button type="button" className="btn" onClick={handleBack}>
              ← Назад
            </button>
          </div>
        )}

        {/* Экран 4: Заказы */}
        {screen === "orders" && canManageOrders && (
          <OrdersPage
            orders={orders}
            products={products}
            categories={categories}
            user={user}
            onBack={handleBack}
            onDeleteOrder={handleDeleteOrder}
            onDeleteOrderItem={handleDeleteOrderItem}
            onChangeOrderDate={handleChangeOrderDate}
            onOpenProduct={handleOpenProduct}
          />
        )}
      </main>
    </div>
  );
}