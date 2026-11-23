import { useMemo, useState } from "react";
import { enrichProduct, getProductImageSrc } from "../utils/catalogLogic";

export default function ProductDetailPage({
  product,
  categories,
  orders,
  user,
  users,
  draftItems,
  targetClient,
  onAddItem,
  onRemoveItem,
  onSelectClient,
  onConfirmOrder,
  onCancelOrder,
  onGoLogin,
  onBack,
}) {
  const enriched = useMemo(
    () => enrichProduct(product, categories, orders),
    [product, categories, orders]
  );

  const [selectedVariantId, setSelectedVariantId] = useState(null);
  const [quantity, setQuantity] = useState("1");
  const [fieldError, setFieldError] = useState("");

  const selectedVariant =
    (enriched.variants || []).find((variant) => variant.id === selectedVariantId) || null;

  const reservedInDraft = useMemo(
    () =>
      draftItems
        .filter((item) => item.variant_id === selectedVariantId)
        .reduce((sum, item) => sum + item.quantity, 0),
    [draftItems, selectedVariantId]
  );

  const maxAvailable = selectedVariant ? selectedVariant.quantity - reservedInDraft : 0;
  const draftTotal = draftItems.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  );

  const canManageOrders =
    user !== null && (user.role_code === "manager" || user.role_code === "admin");
  const clientUsers = users.filter((item) => item.role_code === "client");

  const imgSrc = getProductImageSrc(enriched);

  const handleImageError = (event) => {
    event.currentTarget.onerror = null;
    event.currentTarget.src = "/picture.png";
  };

  const handleVariantSelect = (variant) => {
    if (variant.quantity <= 0) {
      return;
    }
    setSelectedVariantId(variant.id);
    setQuantity("1");
    setFieldError("");
  };

  const handleQuantityChange = (event) => {
    const raw = event.target.value;

    if (raw !== "" && !/^\d*$/.test(raw)) {
      setFieldError("Введите целое положительное число.");
      return;
    }

    setQuantity(raw);

    if (raw === "") {
      setFieldError("Введите количество.");
      return;
    }

    const value = Number(raw);
    if (value <= 0) {
      setFieldError("Количество должно быть больше нуля.");
      return;
    }

    if (!selectedVariant) {
      setFieldError("Сначала выберите вариант (размер).");
      return;
    }

    if (value > maxAvailable) {
      setFieldError(`Доступно не более ${maxAvailable} шт.`);
      return;
    }

    setFieldError("");
  };

  const handleAdd = () => {
    if (!selectedVariant) {
      setFieldError("Сначала выберите вариант (размер).");
      return;
    }

    const value = Number(quantity);
    if (!Number.isInteger(value) || value <= 0) {
      setFieldError("Введите целое положительное число.");
      return;
    }
    if (value > maxAvailable) {
      setFieldError(`Доступно не более ${maxAvailable} шт.`);
      return;
    }

    onAddItem({
      variant_id: selectedVariant.id,
      product_id: enriched.id,
      product_name: enriched.name,
      manufacturer_name: enriched.manufacturer_name,
      size: selectedVariant.size,
      quantity: value,
      unit_price: enriched.discountedPrice,
    });

    setFieldError("");
    setQuantity("1");
  };

  return (
    <>
      <div className="panel">
        <div className="page-bar">
          <h1>
            {enriched.manufacturer_name} | {enriched.name}
          </h1>
          <button type="button" className="btn" onClick={onBack}>
            ← Назад
          </button>
        </div>

        <div className="detail-grid">
          <img
            className="detail-image"
            src={imgSrc}
            alt={enriched.name}
            onError={handleImageError}
          />

          <div>
            <div className="product-meta">
              <span>Категория: {enriched.categoryName}</span>
              <span>Состав: {enriched.composition}</span>
              <span>Описание: {enriched.description}</span>
              <span>
                Остаток на складе: {enriched.totalStock} шт. ({enriched.stockLabel})
              </span>
            </div>

            <div className="product-price-col" style={{ alignItems: "flex-start", margin: "14px 0" }}>
              {enriched.discountPercent > 0 && (
                <span className="price-old">{enriched.basePrice} ₽</span>
              )}
              <span className="price-current">{enriched.discountedPrice} ₽</span>
              {enriched.discountPercent > 0 && (
                <span className="discount-badge">
                  Скидка −{enriched.discountPercent}% (нет заказов в прошлом месяце)
                </span>
              )}
            </div>

            {!user ? (
              <>
                <div className="notice notice-info">
                  <div className="notice-body">
                    <span className="notice-icon">ℹ️</span>
                    <span>Чтобы оформить заказ, войдите в систему.</span>
                  </div>
                </div>
                <button type="button" className="btn btn-primary" onClick={onGoLogin}>
                  Войти
                </button>
              </>
            ) : (
              <>
                <h3>Выберите вариант</h3>
                <div className="size-buttons">
                  {(enriched.variants || []).map((variant) => {
                    const isActive = variant.id === selectedVariantId;
                    return (
                      <button
                        key={variant.id}
                        type="button"
                        className={isActive ? "size-btn active" : "size-btn"}
                        disabled={variant.quantity <= 0}
                        onClick={() => handleVariantSelect(variant)}
                      >
                        {variant.size} ({variant.quantity} шт.)
                      </button>
                    );
                  })}
                </div>

                <label htmlFor="quantity-input">
                  <strong>Количество:</strong>
                </label>
                <input
                  id="quantity-input"
                  className="input"
                  inputMode="numeric"
                  value={quantity}
                  onChange={handleQuantityChange}
                  disabled={!selectedVariant}
                />

                {selectedVariant && (
                  <div className="field-hint">
                    Доступно к заказу: {maxAvailable} шт. (с учётом черновика)
                  </div>
                )}

                {fieldError && <div className="field-error">{fieldError}</div>}

                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ marginTop: 12 }}
                  onClick={handleAdd}
                  disabled={!selectedVariant || maxAvailable <= 0}
                >
                  Добавить в заказ
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {draftItems.length > 0 && (
        <div className="panel">
          <h2>Черновик заказа</h2>

          <table className="table">
            <thead>
              <tr>
                <th>Товар</th>
                <th>Вариант</th>
                <th>Кол-во</th>
                <th>Цена</th>
                <th>Сумма</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {draftItems.map((item) => (
                <tr key={item.variant_id}>
                  <td>
                    {item.manufacturer_name} | {item.product_name}
                  </td>
                  <td>{item.size}</td>
                  <td>{item.quantity}</td>
                  <td>{item.unit_price} ₽</td>
                  <td>{item.quantity * item.unit_price} ₽</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => onRemoveItem(item.variant_id)}
                    >
                      Убрать
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p>
            <strong>Итого: {draftTotal} ₽</strong>
          </p>

          {canManageOrders && clientUsers.length > 0 && (
            <div>
              <label htmlFor="client-select">
                <strong>Оформить на клиента:</strong>
              </label>
              <select
                id="client-select"
                className="select"
                value={targetClient ? targetClient.id : ""}
                onChange={(event) => onSelectClient(Number(event.target.value))}
              >
                {clientUsers.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.full_name} ({client.role_name})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-primary" onClick={onConfirmOrder}>
              Подтвердить заказ
            </button>
            <button type="button" className="btn btn-danger" onClick={onCancelOrder}>
              Отказаться от заказа
            </button>
          </div>
        </div>
      )}
    </>
  );
}