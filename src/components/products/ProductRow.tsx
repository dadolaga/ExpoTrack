import Link from "next/link";

import { NavigationIcon } from "@/components/layout/NavigationIcon";

import type { ProductListItem } from "@/features/products/product-list";

const currency = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

export function ProductRow({ product, href }: {
  product: ProductListItem;
  href: string;
}) {
  return (
    <li className="product-row">
      <span
        className="product-row-thumbnail"
        aria-hidden="true"
      ><NavigationIcon name="products" />
      </span>
      <div className="product-row-info">
        <h2>
          <Link
            href={href}
            className="product-row-link"
          >{product.name}
          </Link>
        </h2>
        <p>{product.standName} · {product.categoryName}</p>
        <div className="product-row-badges">
          <span
            className="product-kind"
            data-kind={product.kind}
          >{product.kind === "registered" ? "Registrato" : "Pianificato"}
          </span>
          <span
            className="product-row-rating"
            aria-label={product.rating === null ? "Non valutato" : `Valutazione ${product.rating} su 10`}
          >{product.rating ?? "—"}/10
          </span>
          {product.price !== null && <span className="product-row-price">{currency.format(product.price)}</span>}
        </div>
      </div>
      <span
        className="product-row-heart"
        data-favorite={product.favorite}
        aria-label={product.favorite ? "Preferito" : "Non preferito"}
      >{product.favorite ? "♥" : "♡"}
      </span>
      <span
        className="product-row-chevron"
        aria-hidden="true"
      >›
      </span>
    </li>
  );
}
