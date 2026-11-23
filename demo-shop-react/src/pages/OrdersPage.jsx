import { useMemo, useState } from "react";
import { calcOrderTotal, enrichProduct } from "../utils/catalogLogic";

export default function OrdersPage({
  orders,
  products,
  categories,
  user,
  onBack,
  onDeleteOrder,
  onDeleteOrderItem,
  onChangeOrderDate,
  onOpenProduct,
}) {
  const isAdmin = user?.role_code === "admin";

  const [pendingAction, setPendingAction] = useState(null);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [search, setSearch] = useState("");

  const enrichedProducts = useMemo(
    () => products.map((product) => enrichProduct(product, categories, orders)),
    [products, categories, orders]
  );

  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return enrichedProducts;
    }
    return enrichedProducts.filter(
      (product) =>
        product.name.toLowerCase().includes(query) ||
        (product.description || "").toLowerCase().includes(query)
    );
  }, [enrichedProducts, search]);

  const handleConfirmPending = () => {
    if (!pendingAction) {
      return;
    }
    if (pendingAction.type === "order") {
      onDeleteOrder(pendingAction.orderId);
    } else {
      onDeleteOrderItem(pendingAction.orderId, pendingAction.itemId);
    }
    setPendingAction(null);
  };

  return (
    <div>
      <div className="page-bar">
        <h1>Управление заказами ({user.role_name})</h1>
        <button type="button" className="btn" onClick={onBack}>
          ← Назад
        </button>
      </div>

      {pendingAction && (
        <div className="notice notice-warning">
          <div className="notice-body">
            <span className="notice-icon">⚠️</span>
            <span>
              {pendingAction.type === "order"
                ? `Удалить заказ №${pendingAction.orderId} целиком? Списанные остатки вернутся в каталог.`
                : "Удалить позицию из заказа? Количество вернётся в остаток. Операция необратима."}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-danger" onClick={handleConfirmPending}>
              Да, удалить
            </button>
            <button type="button" className="btn" onClick={() => setPendingAction(null)}>
              Отмена
            </button>
          </div>
        </div>
      )}

      <div className="panel">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setShowNewOrder((value) => !value)}
        >
          {showNewOrder ? "Скрыть поиск товаров" : "Оформить новый заказ"}
        </button>

        {showNewOrder && (
          <div style={{ marginTop: 14 }}>
            <input
              className="input"
              type="search"
              placeholder="Поиск товара по наименованию..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            {searchResults.length === 0 ? (
              <p className="field-hint">Товары не найдены.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Товар</th>
                    <th>Категория</th>
                    <th>Остаток</th>
                    <th>Цена</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {searchResults.map((product) => (
                    <tr key={product.id}>
                      <td>
                        {product.manufacturer_name} | {product.name}
                      </td>
                      <td>{product.categoryName}</td>
                      <td>
                        {product.stockLabel} ({product.totalStock} шт.)
                      </td>
                      <td>{product.discountedPrice} ₽</td>
                      <td>
                        <button
                          type="button"
                          className="btn"
                          disabled={product.totalStock <= 0}
                          onClick={() => onOpenProduct(product.id)}
                        >
                          Выбрать
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <p className="field-hint">
              Нажмите «Выбрать», задайте вариант и количество, затем подтвердите заказ
              в черновике на карточке товара.
            </p>
          </div>
        )}
      </div>

      {orders.length === 0 ? (
        <div className="panel">Заказов пока нет.</div>
      ) : (
        orders.map((order) => (
          <div className="panel" key={order.id}>
            <div className="page-bar">
              <h3 style={{ margin: 0 }}>Заказ №{order.id}</h3>

              {isAdmin ? (
                <label className="field-hint">
                  Дата:{" "}
                  <input
                    className="input"
                    style={{ width: "auto", display: "inline-block" }}
                    type="date"
                    value={order.order_date}
                    onChange={(event) => onChangeOrderDate(order.id, event.target.value)}
                  />
                </label>
              ) : (
                <span className="field-hint">Дата: {order.order_date}</span>
              )}
            </div>

            <p className="field-hint">Клиент: {order.client_full_name}</p>

            {order.items.length === 0 ? (
              <p className="field-hint">В заказе нет позиций.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Товар</th>
                    <th>Вариант</th>
                    <th>Кол-во</th>
                    <th>Цена за ед.</th>
                    <th>Сумма</th>
                    {isAdmin && <th />}
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        {item.manufacturer_name} | {item.product_name}
                      </td>
                      <td>{item.size}</td>
                      <td>{item.quantity}</td>
                      <td>{item.unit_price} ₽</td>
                      <td>{item.quantity * item.unit_price} ₽</td>
                      {isAdmin && (
                        <td>
                          <button
                            type="button"
                            className="btn btn-danger"
                            onClick={() =>
                              setPendingAction({
                                type: "item",
                                orderId: order.id,
                                itemId: item.id,
                              })
                            }
                          >
                            Удалить позицию
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <p>
              <strong>Итого: {calcOrderTotal(order)} ₽</strong>
            </p>

            <button
              type="button"
              className="btn btn-danger"
              onClick={() => setPendingAction({ type: "order", orderId: order.id })}
            >
              Удалить заказ
            </button>
          </div>
        ))
      )}
    </div>
  );
}