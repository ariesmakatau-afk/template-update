import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/** Staff screens: no public header/footer, nothing indexed. */
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-[100svh] bg-porcelain">{children}</div>;
}
