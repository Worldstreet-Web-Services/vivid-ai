/** Preview sizes. Everything else here rendered local HTML, which the sandbox now does. */

export type PreviewDevice = "desktop" | "tablet" | "phone";

export type DevicePreset = {
  id: string;
  label: string;
  /** null means "whatever the pane is", i.e. no constraint. */
  width: number | null;
};

/**
 * Each device offers real sizes rather than one arbitrary width — the point of
 * a responsive check is seeing where a layout breaks, and that only shows up at
 * the edges (a 375px phone, a 1024px tablet in landscape).
 */
export const DEVICE_PRESETS: Record<PreviewDevice, DevicePreset[]> = {
  desktop: [
    { id: "fit", label: "Fit to pane", width: null },
    { id: "laptop", label: "Laptop · 1280", width: 1280 },
    { id: "desktop", label: "Desktop · 1440", width: 1440 },
    { id: "wide", label: "Wide · 1920", width: 1920 },
  ],
  // Ascending by width, iOS and Android interleaved, so the list reads as a
  // range of sizes rather than two vendor groups.
  tablet: [
    { id: "ipad-mini", label: "iPad mini · 768", width: 768 },
    { id: "galaxy-tab", label: "Galaxy Tab S9 · 800", width: 800 },
    { id: "ipad-air", label: "iPad Air · 820", width: 820 },
    { id: "ipad-pro", label: "iPad Pro · 1024", width: 1024 },
  ],
  phone: [
    { id: "galaxy-s23", label: "Galaxy S23 · 360", width: 360 },
    { id: "iphone-se", label: "iPhone SE · 375", width: 375 },
    { id: "iphone-15", label: "iPhone 15 · 393", width: 393 },
    { id: "pixel-8", label: "Pixel 8 · 412", width: 412 },
    { id: "iphone-max", label: "iPhone 15 Pro Max · 430", width: 430 },
  ],
};

/** The preset each device starts on. */
export const DEFAULT_PRESET: Record<PreviewDevice, string> = {
  desktop: "fit",
  tablet: "ipad-mini",
  phone: "iphone-15",
};

export function presetWidth(device: PreviewDevice, presetId: string): number | null {
  const presets = DEVICE_PRESETS[device];
  return (presets.find((preset) => preset.id === presetId) ?? presets[0]).width;
}
