import { FaqList } from "@/components/ui/faq-list";
import { LANDING_FAQS } from "./data";

export function FaqSection() {
  return (
    <section id="faq" className="border-t border-line bg-bg-2 px-gutter py-[clamp(60px,9vw,120px)]">
      <div className="mx-auto max-w-[860px]">
        <h2 className="text-[clamp(28px,3.6vw,44px)] leading-[1.08] font-extrabold tracking-[-0.035em]">
          Questions, answered.
        </h2>
        <div className="mt-8">
          <FaqList items={LANDING_FAQS} />
        </div>
      </div>
    </section>
  );
}
