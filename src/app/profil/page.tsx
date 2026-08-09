import type { Metadata } from "next";
import { serverApi, unwrapObject } from "@/components/data/server-api";
import { extractProfilePayload, MyProfileView } from "@/components/profiles/profile-view";
import { ErrorState } from "@/components/ui/states";

export const metadata: Metadata = { title: "Mon profil" };

export default async function MyProfilePage() {
  const result = await serverApi<unknown>("/api/me");
  const root = unwrapObject<Record<string, unknown>>(result.data);
  const profile = extractProfilePayload(root);
  if (result.error || !profile?.displayName) {
    return (
      <div className="page-shell">
        <ErrorState
          title="Profil inaccessible"
          message={result.error ?? "Le profil Telegram n’a pas pu être chargé."}
          retryHref="/profil"
        />
      </div>
    );
  }
  return <MyProfileView profile={profile} />;
}
