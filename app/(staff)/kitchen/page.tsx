import type { Metadata } from "next";
import { requireStaffPage } from "@/lib/requireStaff";
import KitchenBoard from "@/components/staff/KitchenBoard";

export const metadata: Metadata = { title: "Kitchen" };
export const dynamic = "force-dynamic";

export default async function KitchenPage() {
  await requireStaffPage("/kitchen");
  return <KitchenBoard />;
}
