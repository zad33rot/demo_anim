export function getProductImageSrc(product) {
  const raw = product.image_name || product.image || "";
  if (!raw) {
    return "/picture.png";
  }
  return raw.startsWith("/") ? raw : `/images/${raw}`;
}

export function getTotalStock(product) {
  const variants = product.variants || [];
  return variants.reduce((sum, variant) => sum + (Number(variant.quantity) || 0), 0);
}

export function hasOrdersInPreviousMonth(productId, orders, today = new Date()) {
  const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const targetYear = prevMonthDate.getFullYear();
  const targetMonth = prevMonthDate.getMonth();

  return orders.some((order) => {
    const orderDate = new Date(order.order_date);
    if (Number.isNaN(orderDate.getTime())) {
      return false;
    }
    const samePrevMonth =
      orderDate.getFullYear() === targetYear && orderDate.getMonth() === targetMonth;
    if (!samePrevMonth) {
      return false;
    }
    return order.items.some((item) => item.product_id === productId);
  });
}

export function enrichProduct(product, categories, orders, today = new Date()) {
  const basePrice = Number(product.base_price ?? product.price ?? 0);
  const totalStock = getTotalStock(product);
  const hasPrevOrders = hasOrdersInPreviousMonth(product.id, orders, today);
  const discountPercent = hasPrevOrders ? 0 : 25;
  const discountedPrice = Math.round(basePrice * (1 - discountPercent / 100));

  const category = (categories || []).find((item) => item.id === product.category_id);
  const categoryName = category ? category.name : product.category_name || "Без категории";

  let stockLabel = "нет в наличии";
  if (totalStock > 5) {
    stockLabel = "много";
  } else if (totalStock > 0) {
    stockLabel = "мало";
  }

  return {
    ...product,
    basePrice,
    categoryName,
    totalStock,
    stockLabel,
    isLowStock: totalStock <= 3,
    discountPercent,
    discountedPrice,
  };
}

export function filterAndSortProducts(products, { search = "", categoryId = "all", sortBy = "" } = {}) {
  const query = search.trim().toLowerCase();

  const filtered = products.filter((product) => {
    if (categoryId && categoryId !== "all" && String(product.category_id) !== String(categoryId)) {
      return false;
    }
    if (!query) {
      return true;
    }
    const name = (product.name || "").toLowerCase();
    const description = (product.description || "").toLowerCase();
    return name.includes(query) || description.includes(query);
  });

  const sorted = [...filtered];

  if (sortBy === "price_asc") {
    sorted.sort((a, b) => a.discountedPrice - b.discountedPrice);
  } else if (sortBy === "price_desc") {
    sorted.sort((a, b) => b.discountedPrice - a.discountedPrice);
  }

  return sorted;
}

// Иммутабельное списание остатков по позициям заказа
export function decrementStock(products, items) {
  return products.map((product) => {
    const nextVariants = (product.variants || []).map((variant) => {
      const ordered = items
        .filter((item) => item.variant_id === variant.id)
        .reduce((sum, item) => sum + Number(item.quantity), 0);

      if (ordered === 0) {
        return variant;
      }
      return { ...variant, quantity: Math.max(0, variant.quantity - ordered) };
    });

    return { ...product, variants: nextVariants };
  });
}

// Иммутабельный возврат остатков (при удалении заказа или позиции)
export function incrementStock(products, items) {
  return products.map((product) => {
    const nextVariants = (product.variants || []).map((variant) => {
      const returned = items
        .filter((item) => item.variant_id === variant.id)
        .reduce((sum, item) => sum + Number(item.quantity), 0);

      if (returned === 0) {
        return variant;
      }
      return { ...variant, quantity: variant.quantity + returned };
    });

    return { ...product, variants: nextVariants };
  });
}

export function calcOrderTotal(order) {
  return order.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
}