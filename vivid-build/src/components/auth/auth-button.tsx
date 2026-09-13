"use client";

import { useCallback, type ComponentPropsWithoutRef } from "react";
import { bindMagnet } from "@/lib/pointer-effects";
import { useAuthModal, type AuthMode } from "./auth-modal-provider";

type AuthButtonProps = Omit<ComponentPropsWithoutRef<"button">, "onClick" | "type"> & {
  mode?: AuthMode;
  /** Pull the button towards the pointer. */
  magnetic?: boolean;
};

/** A button that opens the sign up / log in modal. Safe to drop into server components. */
export function AuthButton({ mode = "signup", magnetic = false, ...rest }: AuthButtonProps) {
  const { openAuth } = useAuthModal();
  const ref = useCallback(
    (node: HTMLButtonElement | null) => (node && magnetic ? bindMagnet(node) : undefined),
    [magnetic],
  );

  return <button ref={ref} type="button" onClick={() => openAuth(mode)} {...rest} />;
}
