"use client";

import { Check, ChevronDown, Monitor, Smartphone, Tablet } from "lucide-react";
import { Menu } from "@/components/ui/menu";
import { cn } from "@/lib/cn";
import { DEFAULT_PRESET, DEVICE_PRESETS, type PreviewDevice } from "@/lib/preview/render";

const DEVICES: { key: PreviewDevice; label: string; Icon: typeof Monitor }[] = [
  { key: "desktop", label: "Desktop", Icon: Monitor },
  { key: "tablet", label: "Tablet", Icon: Tablet },
  { key: "phone", label: "Phone", Icon: Smartphone },
];

type Props = {
  device: PreviewDevice;
  preset: string;
  onChange: (device: PreviewDevice, preset: string) => void;
  align?: "start" | "end";
  className?: string;
};

/**
 * Device class and the size within it. Picking a class jumps to that class's
 * default size, so the common case is still one click.
 */
export function DeviceControls({ device, preset, onChange, align = "end", className }: Props) {
  const presets = DEVICE_PRESETS[device];
  const current = presets.find((item) => item.id === preset) ?? presets[0];

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div role="group" aria-label="Preview device" className="flex gap-1 rounded-lg border border-line-2 p-1">
        {DEVICES.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            aria-pressed={device === key}
            aria-label={label}
            onClick={() => onChange(key, DEFAULT_PRESET[key])}
            className={cn(
              "flex cursor-pointer items-center rounded-md px-1.5 py-1 transition-colors",
              device === key ? "bg-surface-2 text-fg" : "text-muted hover:text-fg",
            )}
          >
            <Icon aria-hidden className="size-4" />
          </button>
        ))}
      </div>

      <Menu
        ariaLabel="Preview size"
        align={align}
        label={
          <span className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-semibold whitespace-nowrap text-fg-2 transition-colors hover:bg-surface">
            {current.label}
            <ChevronDown aria-hidden className="size-3.5 flex-none text-muted-2" />
          </span>
        }
        items={presets.map((item) => ({
          label: item.label,
          trailing: item.id === current.id ? <Check className="size-3.5" /> : undefined,
          onSelect: () => onChange(device, item.id),
        }))}
      />
    </div>
  );
}
