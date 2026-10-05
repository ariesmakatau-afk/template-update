import type { Metadata } from "next";
import StaffLogin from "@/components/staff/StaffLogin";

export const metadata: Metadata = { title: "Staff sign in" };

export default async function StaffLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  // Only ever redirect to our own paths — never an absolute URL (open redirect).
  const raw = (await searchParams).next ?? "/kitchen";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/kitchen";
  return (
    <div className="whitewash flex min-h-[100svh] items-center justify-center px-4 py-14">
      <StaffLogin next={next} />
    </div>
  );
}
