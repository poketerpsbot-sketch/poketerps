import { LoadingState } from "@/components/ui/states";

export default function AdminLoading() {
  return (
    <div className="page-shell page-stack">
      <LoadingState label="Synchronisation de la console…" />
      <div className="admin-stat-grid" aria-hidden="true">
        {Array.from({ length: 6 }).map((_, index) => (
          <div className="admin-stat" key={index}>
            <span className="skeleton skeleton--short" />
            <span className="skeleton skeleton--medium" />
          </div>
        ))}
      </div>
    </div>
  );
}
