import { Suspense } from "react";
import { GoogleCallback } from "@/components/auth/google-callback";

export const metadata = { title: "Signing in", robots: { index: false, follow: false } };

/** Where Decane returns the browser after Google. The URL carries the result. */
export default function AuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <GoogleCallback />
    </Suspense>
  );
}
