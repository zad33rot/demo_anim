import { useMemo } from "react";
import ProductCard from "../components/ProductCart";
import { enrichProduct, filterAndSortProducts } from "../utils/catalogLogic";

export default function CatalogPage({
  title,
  products,
  categories,
  orders,
  user,
  search,
  categoryId,
  sortBy,
  onSearchChange,
  onCategoryChange,
  onSortChange,
  onSelectProduct,
}) {
  const enrichedProducts = useMemo(
    () => products.map((product) => enrichProduct(product, categories, orders)),
    [products, categories, orders]
  );

  const visibleProducts = useMemo(
    () => filterAndSortProducts(enrichedProducts, { search, categoryId, sortBy }),
    [enrichedProducts, search, categoryId, sortBy]
  );

  return (
    <div>
      <div className="page-bar">
        <h1>{title}</h1>
        <span className="field-hint">
          Найдено: {visibleProducts.length} из {enrichedProducts.length}
        </span>
      </div>

      {user && (
        <div className="filters-bar">
          <input
            className="input"
            type="search"
            placeholder="Поиск по названию и описанию..."
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />

          <select
            className="select"
            value={categoryId}
            onChange={(event) => onCategoryChange(event.target.value)}
          >
            <option value="all">Все категории</option>
            {categories.map((category) => (
              <option key={category.id} value={String(category.id)}>
                {category.name}
              </option>
            ))}
          </select>

          <select
            className="select"
            value={sortBy}
            onChange={(event) => onSortChange(event.target.value)}
          >
            <option value="">Без сортировки</option>
            <option value="price_asc">Цена: по возрастанию</option>
            <option value="price_desc">Цена: по убыванию</option>
          </select>
        </div>
      )}

      {!user && (
        <div className="notice notice-info">
          <div className="notice-body">
            <span className="notice-icon">ℹ️</span>
            <span>
              Вы просматриваете каталог как гость. Войдите, чтобы пользоваться поиском,
              фильтрами и оформлять заказы.
            </span>
          </div>
        </div>
      )}

      {visibleProducts.length === 0 ? (
        <div className="panel">Ничего не найдено. Измените условия поиска или фильтры.</div>
      ) : (
        <div className="catalog-list">
          {visibleProducts.map((product) => (
            <ProductCard key={product.id} product={product} onSelect={onSelectProduct} />
          ))}
        </div>
      )}
    </div>
  );
}