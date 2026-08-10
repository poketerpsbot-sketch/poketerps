import Link from "next/link";
import {
  Candy,
  ChevronRight,
  Cigarette,
  CircleDot,
  Cloud,
  Droplet,
  FlaskConical,
  Flower2,
  Gem,
  Sparkles,
  SprayCan,
  type LucideIcon,
} from "lucide-react";
import type { CategoryDto } from "@/components/data/types";
import { formatCount } from "@/components/ui/states";

const categoryIcons: Record<string, LucideIcon> = {
  fleur: Flower2,
  "pre-roll": Cigarette,
  hash: Gem,
  rosin: Droplet,
  "extractions-solvants": FlaskConical,
  vape: Cloud,
  edibles: Candy,
  topiques: SprayCan,
  "concentres-sans-solvant": Sparkles,
};

export function CategoryCard({ category }: { category: CategoryDto }) {
  const Icon = categoryIcons[category.slug ?? ""] ?? CircleDot;
  return (
    <Link
      className="category-card"
      href={`/categories/${encodeURIComponent(category.slug ?? String(category.id))}`}
    >
      <span className="category-card__icon" aria-hidden="true">
        <Icon size={25} strokeWidth={2.4} />
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
