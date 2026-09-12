import { Toaster as Sonner, type ToasterProps } from "sonner";

// Follows the `dark` class on <html>, which is how this app switches theme.
function currentTheme(): ToasterProps["theme"] {
  if (typeof document === "undefined") return "system";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme={currentTheme()}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
export { toast } from "sonner";
