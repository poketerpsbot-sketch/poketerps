import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { CategoryDto } from "@/components/data/types";
import { formatCount } from "@/components/ui/states";

export function CategoryCard({ category }: { category: CategoryDto }) {
  const letter = category.icon || category.name.charAt(0).toLocaleUpperCase("fr-FR");
  return (
    <Link
      className="category-card"
      href={`/categories/${encodeURIComponent(category.slug ?? String(category.id))}`}
    >
      <span className="category-card__icon" aria-hidden="true">
        {letter}
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <h3>{category.name}</h3>
        <p>{category.description || "Explorer les captures de cette catégorie"}</p>
      </span>
      <span className="category-card__count">
        {formatCount(category.entryCount)} <span className="sr-only">fiches</span>
      </span>
      <ChevronRight size={17} aria-hidden="true" />
    </Link>
  );
}

export function CategoryGrid({ categories }: { categories: CategoryDto[] }) {
  return (
    <div className="category-grid">
      {categories.map((category) => (
        <CategoryCard category={category} key={String(category.id)} />
      ))}
    </div>
  );
}
