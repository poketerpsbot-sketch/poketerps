import { LoadingState, SkeletonGrid } from "@/components/ui/states";

export default function Loading() {
  return (
    <div className="page-shell page-stack">
      <LoadingState />
      <SkeletonGrid />
    </div>
  );
}
