import type { Metadata } from "next";
import { Heart } from "lucide-react";
import { serverApi, unwrapList } from "@/components/data/server-api";
import type { EntrySummaryDto } from "@/components/data/types";
import { EntryGrid } from "@/components/entries/entry-card";
import { EmptyState, ErrorState } from "@/components/ui/states";

export const metadata: Metadata = { title: "Mes favoris" };

type FavoriteItem = EntrySummaryDto & { entry?: EntrySummaryDto };

export default async function FavoritesPage() {
  const result = await serverApi<unknown>("/api/favorites");
  const raw = unwrapList<FavoriteItem>(result.data, ["favorites"]);
  const entries = raw.map((item) => item.entry ?? item).filter((item) => item?.id && item?.slug);
  return (
    <div className="page-shell page-stack">
      <header className="page-header">
        <div className="page-header__copy">
          <p className="eyebrow">Collection personnelle</p>
          <h1 className="page-title">Mes favoris</h1>
          <p>Retrouve rapidement les captures que tu as sauvegardées.</p>
        </div>
        <Heart className="page-header__mark" size={58} aria-hidden="true" />
      </header>
      {result.error ? (
        <ErrorState title="Favoris inaccessibles" message={result.error} retryHref="/favoris" />
      ) : entries.length > 0 ? (
        <EntryGrid entries={entries} />
      ) : (
        <EmptyState
          title="Ta collection est vide"
          description="Ajoute une capture à tes favoris depuis sa fiche."
          action={{ href: "/explorer", label: "Explorer" }}
        />
      )}
    </div>
  );
}
