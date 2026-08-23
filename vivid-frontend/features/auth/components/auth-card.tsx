import { cn } from "@/lib/utils";

interface AuthCardProps {
  title: string;
  subtitle?: string;
  // Sits above the title. Used for the step counter during onboarding.
  eyebrow?: React.ReactNode;
  footer?: React.ReactNode;
  width?: "sm" | "md" | "lg";
  className?: string;
  children: React.ReactNode;
}

const WIDTH = {
  sm: "max-w-[400px]",
  md: "max-w-[480px]",
  lg: "max-w-[760px]",
};

// The frame every auth and onboarding step renders inside, so the wordmark,
// heading rhythm and card weight stay identical across the flow.
export function AuthCard({
  title,
  subtitle,
  eyebrow,
  footer,
  width = "sm",
  className,
  children,
}: AuthCardProps) {
  return (
    <div className={cn("w-full", WIDTH[width], className)}>
      <div className="mb-7 text-center">
        <p className="ws-display text-[26px] leading-none text-white">
          Vivid <span className="font-medium text-white/45">AI</span>
        </p>
      </div>

      <div className="vd-glass-card vd-sheen p-7">
        {eyebrow ? <div className="mb-3">{eyebrow}</div> : null}

        <h1 className="ws-display text-[21px] leading-tight text-white">{title}</h1>
        {subtitle ? (
          <p className="mt-2 text-[13.5px] leading-relaxed font-normal text-white/55">{subtitle}</p>
        ) : null}

        <div className="mt-6">{children}</div>
      </div>

      {footer ? (
        <div className="mt-5 text-center text-[12.5px] font-normal text-white/45">{footer}</div>
      ) : null}
    </div>
  );
}
