"use client";

import { useId, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { CONTACT_TOPICS, TEAM_SIZES } from "./data";

const EMAIL_PATTERN = /.+@.+\..+/;

const initialFields = { name: "", email: "", company: "", size: "10 to 49", message: "" };
type Fields = typeof initialFields;

const inputClass =
  "rounded-xl border bg-bg px-3.5 py-[13px] text-[15px] font-normal text-fg outline-none transition-colors focus-visible:border-line-3";

export function ContactForm() {
  const [topic, setTopic] = useState(0);
  const [fields, setFields] = useState<Fields>(initialFields);
  const [onchain, setOnchain] = useState(false);
  const [sent, setSent] = useState(false);
  const hintId = useId();

  const update =
    (key: keyof Fields) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setFields((current) => ({ ...current, [key]: event.target.value }));

  const valid =
    fields.name.trim().length > 1 && EMAIL_PATTERN.test(fields.email.trim()) && fields.message.trim().length > 9;
  const emailInvalid = fields.email.length > 3 && !EMAIL_PATTERN.test(fields.email);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (valid) setSent(true);
  };

  if (sent) {
    const firstName = fields.name.trim().split(" ")[0] || "there";
    const team = onchain ? "onchain" : CONTACT_TOPICS[topic].toLowerCase().split(" ")[0];
    return (
      <div role="status" className="flex flex-col gap-4 py-5">
        <div className="flex size-11 items-center justify-center rounded-full bg-btn">
          <span
            aria-hidden
            className="block h-[7px] w-[13px] border-b-[2.6px] border-l-[2.6px] border-logo-ink [transform:rotate(-45deg)_translate(1px,-2px)]"
          />
        </div>
        <h2 className="text-2xl font-bold tracking-[-0.03em]">Message received, {firstName}.</h2>
        <p className="max-w-[420px] text-[15px] leading-[1.6] text-muted">
          We routed it to the {team} team. Expect a reply at {fields.email} within one business day. Urgent security
          reports go straight to the on-call rota.
        </p>
        <button
          type="button"
          onClick={() => {
            setSent(false);
            setFields((current) => ({ ...current, message: "" }));
          }}
          className="cursor-pointer self-start rounded-full border border-line-3 px-5 py-[11px] text-sm font-semibold text-fg"
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-[18px]">
      <fieldset>
        <legend className="mb-2.5 text-xs font-semibold text-muted-2">What is this about?</legend>
        <div className="flex flex-wrap gap-2">
          {CONTACT_TOPICS.map((label, i) => {
            const active = i === topic;
            return (
              <button
                key={label}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setTopic(i);
                  if (i === 1) setOnchain(true);
                }}
                className={cn(
                  "cursor-pointer rounded-full border px-3.5 py-[9px] text-[13px] font-semibold transition-colors duration-250",
                  active ? "border-transparent bg-btn text-btn-fg" : "border-line-2 bg-surface text-fg-2",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
        <Field label="Full name">
          <input
            name="name"
            autoComplete="name"
            required
            value={fields.name}
            onChange={update("name")}
            placeholder="Ada Okonjo"
            className={cn(inputClass, "border-line-2")}
          />
        </Field>
        <Field label="Work email">
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            aria-invalid={emailInvalid || undefined}
            value={fields.email}
            onChange={update("email")}
            placeholder="ada@company.com"
            className={cn(inputClass, emailInvalid ? "border-warn" : "border-line-2")}
          />
        </Field>
        <Field label="Company">
          <input
            name="company"
            autoComplete="organization"
            value={fields.company}
            onChange={update("company")}
            placeholder="Kestrel Labs"
            className={cn(inputClass, "border-line-2")}
          />
        </Field>
        <Field label="Team size">
          <select
            name="size"
            value={fields.size}
            onChange={update("size")}
            className={cn(inputClass, "appearance-none border-line-2")}
          >
            {TEAM_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="What are you building?">
        <textarea
          name="message"
          required
          rows={5}
          value={fields.message}
          onChange={update("message")}
          placeholder="A member portal for 12,000 field agents, replacing two SaaS contracts. We need SSO and an audit log."
          className={cn(inputClass, "resize-y border-line-2 leading-normal")}
        />
      </Field>

      <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-normal text-muted">
        <input
          type="checkbox"
          checked={onchain}
          onChange={(event) => setOnchain(event.target.checked)}
          className="mt-[3px] size-4 flex-none accent-accent"
        />
        This project deploys to Ark-Konstellation, route it to the onchain team
      </label>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span id={hintId} className={cn("text-xs font-semibold", valid ? "text-muted" : "text-muted-3")}>
          {valid ? "Ready to send" : "Name, work email and a short description, please"}
        </span>
        <button
          type="submit"
          aria-disabled={!valid}
          aria-describedby={hintId}
          className={cn(
            "rounded-full px-[26px] py-3.5 text-[15px] font-bold shadow-sheen",
            valid ? "cursor-pointer bg-btn text-btn-fg" : "cursor-not-allowed bg-surface-2 text-muted-3 opacity-85",
          )}
        >
          Send message
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-[7px] text-xs font-semibold text-muted-2">
      {label}
      {children}
    </label>
  );
}
