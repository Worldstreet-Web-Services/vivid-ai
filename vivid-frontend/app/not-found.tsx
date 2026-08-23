import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-full place-items-center px-5 py-24 text-center">
      <div className="max-w-[42ch]">
        <p className="text-accent text-[13px] font-semibold">404</p>
        <h1 className="ws-display mt-2 text-[26px] text-white">Page not found</h1>
        <p className="mt-2 text-[13.5px] font-normal text-white/50">
          That page doesn&apos;t exist, or it has moved.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-10 cursor-pointer items-center rounded-full bg-white px-5 text-[13.5px] font-semibold text-black transition-opacity hover:opacity-90"
        >
          Back to Vivid
        </Link>
      </div>
    </div>
  );
}
