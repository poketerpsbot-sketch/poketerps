import { LoadingState, SkeletonGrid } from "@/components/ui/states";

export default function ProfileLoading() {
  return (
    <div className="page-shell page-stack">
      <LoadingState label="Synchronisation du profil…" />
      <SkeletonGrid count={4} />
    </div>
  );
}
