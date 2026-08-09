import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { serverApi, unwrapObject } from "@/components/data/server-api";
import { extractProfilePayload, PublicProfileView } from "@/components/profiles/profile-view";
import { ErrorState } from "@/components/ui/states";

type Props = { params: Promise<{ slug: string }> };

async function getProfile(slug: string) {
  const result = await serverApi<unknown>(`/api/profiles/${encodeURIComponent(slug)}`);
  const root = unwrapObject<Record<string, unknown>>(result.data);
  return { result, profile: extractProfilePayload(root) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { profile } = await getProfile(slug);
  return {
    title: profile?.displayName ?? "Profil de Dresseur",
    description: profile?.bio ?? "Profil public d’un Dresseur du Pokédex.",
  };
}

export default async function PublicProfilePage({ params }: Props) {
  const { slug } = await params;
  const { result, profile } = await getProfile(slug);
  if (result.status === 404) notFound();
  if (result.error || !profile)
    return (
      <div className="page-shell">
        <ErrorState
          title={result.status === 403 ? "Profil privé" : "Profil inaccessible"}
          message={result.error ?? "Ce profil ne peut pas être affiché."}
          retryHref={`/profil/${encodeURIComponent(slug)}`}
        />
      </div>
    );
  return <PublicProfileView profile={profile} />;
}
