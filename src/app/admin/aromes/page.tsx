import type { Metadata } from "next";

import { AdminHeader } from "@/components/admin/admin-header";
import { AromaAdmin } from "@/components/admin/aroma-admin";
import { requireAdminUser } from "@/lib/auth/admin";
import { listAdminAromaTaxonomy } from "@/lib/services/admin-aromas";

export const metadata: Metadata = { title: "Arômes · Administration" };

export default async function AdminAromasPage() {
  await requireAdminUser("category:manage");
  const taxonomy = await listAdminAromaTaxonomy();
  return (
    <>
      <AdminHeader
        eyebrow="Taxonomie sensorielle"
        title="Arômes"
        description="Gère les familles, synonymes, traductions et l’ordre proposé lors d’une capture."
      />
      <AromaAdmin families={taxonomy.families} aromas={taxonomy.aromas} />
    </>
  );
}
