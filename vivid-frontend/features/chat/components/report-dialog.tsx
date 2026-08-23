"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { REPORT_REASONS, type ReportReason } from "@/features/chat/lib/types";

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReportDialog({ open, onOpenChange }: ReportDialogProps) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [detail, setDetail] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setReason(null);
    setDetail("");
    setError(null);
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
      title="Report this session"
      description="Tell us what's wrong. Reports are reviewed by the safety team."
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              if (!reason) {
                setError("Pick a reason so we know what to look at.");
                return;
              }
              onOpenChange(false);
              reset();
              toast("Report submitted", {
                description: "Thanks. We'll take a look at this session.",
              });
            }}
          >
            Submit report
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">Reason</legend>
          {REPORT_REASONS.map((option) => {
            const on = reason === option.value;
            return (
              <label
                key={option.value}
                className={cn(
                  "vd-glass-control vd-sheen flex cursor-pointer items-center gap-3 rounded-[14px] px-3.5 py-3",
                  "transition-colors hover:border-white/28",
                  on && "border-white/45 bg-white/14"
                )}
              >
                <input
                  type="radio"
                  name="report-reason"
                  value={option.value}
                  checked={on}
                  onChange={() => {
                    setReason(option.value);
                    setError(null);
                  }}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid size-4 shrink-0 place-items-center rounded-full border transition-colors",
                    on ? "border-white bg-white" : "border-white/30"
                  )}
                >
                  {on ? <span className="size-1.5 rounded-full bg-black" /> : null}
                </span>
                <span className="text-[13px] font-medium text-white/85">{option.label}</span>
              </label>
            );
          })}
        </fieldset>

        {error ? (
          <p role="alert" className="text-down text-[12px] font-normal">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          <label htmlFor="report-detail" className="text-[13px] font-semibold text-white/85">
            Anything else? <span className="font-normal text-white/40">Optional</span>
          </label>
          <Textarea
            id="report-detail"
            rows={3}
            placeholder="Add any detail that would help us understand the problem."
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}
