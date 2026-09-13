import type { ReactNode } from "react";
import { BackToTop } from "@/components/layout/back-to-top";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

export default function MarketingLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <SiteHeader />
      {/* overflow-x-clip (not hidden) contains the decorative glows without breaking position: sticky. */}
      <main id="main" className="overflow-x-clip">
        {children}
      </main>
      <SiteFooter />
      <BackToTop />
    </>
  );
}
