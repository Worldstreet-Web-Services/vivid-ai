import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";

const MARK_SIZES = {
  sm: "size-5 rounded-md",
  md: "size-[26px] rounded-lg",
  lg: "size-[30px] rounded-[9px]",
  xl: "size-[34px] rounded-[10px]",
} as const;

export function LogoMark({ size = "md", className }: { size?: keyof typeof MARK_SIZES; className?: string }) {
  return (
    <Image
      src="/vividbuild-mark.jpeg"
      alt=""
      aria-hidden
      width={256}
      height={256}
      preload
      className={cn("flex-none object-cover", MARK_SIZES[size], className)}
    />
  );
}

export function Wordmark({ size = "md", className }: { size?: "sm" | "md"; className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2.5 text-fg", className)}>
      <LogoMark size={size} />
      <span
        className={cn(
          size === "md"
            ? "text-[19px] font-extrabold tracking-[-0.03em]"
            : "text-[15px] font-bold tracking-[-0.02em]",
        )}
      >
        VividBuild
      </span>
    </Link>
  );
}
