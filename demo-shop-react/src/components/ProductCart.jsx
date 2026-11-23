import { getProductImageSrc } from "../utils/catalogLogic";

export default function ProductCard({ product, onSelect }) {
  const imgSrc = getProductImageSrc(product);
  const cardClass = product.isLowStock ? "product-card low-stock" : "product-card";

  const handleImageError = (event) => {
    event.currentTarget.onerror = null;
    event.currentTarget.src = "/picture.png";
  };

  return (
    <article className={cardClass} onClick={() => onSelect(product.id)}>
      <img
        className="product-thumb"
        src={imgSrc}
        alt={product.name}
        onError={handleImageError}
      />

      <div>
        <h3 className="product-title">
          {product.manufacturer_name} | {product.name}
        </h3>
        <div className="product-meta">
          <span>Категория: {product.categoryName}</span>
          <span>
            Количество: {product.stockLabel} ({product.totalStock} шт.)
          </span>
          <span>Состав: {product.composition}</span>
        </div>
      </div>

      <div className="product-price-col">
        {product.discountPercent > 0 && (
          <span className="price-old">{product.basePrice} ₽</span>
        )}
        <span className="price-current">{product.discountedPrice} ₽</span>
        {product.discountPercent > 0 && (
          <span className="discount-badge">Скидка −{product.discountPercent}%</span>
        )}
      </div>
    </article>
  );
}