"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Toggle } from "@/components/ui/toggle";
import { PlanBadge } from "@/components/ui/plan-badge";
import { useToast } from "@/components/ui/toast";
import { deleteProject, updateProject } from "@/lib/api/endpoints";
import { buttonClass } from "@/lib/ui";
import { inputClass } from "./field";
import { NoProject } from "./no-project";
import { PageHeader } from "./page-header";
import { RowValue, SettingRow, SettingRows } from "./setting-row";
import { useSettingsProjectDoc } from "./settings-project";
import { SettingsSection } from "./settings-section";
import { ProjectSwitcher } from "./project-switcher";

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

export function ProjectGeneral() {
  const { doc, hydrated } = useSettingsProjectDoc();
  const router = useRouter();
  const { toast } = useToast();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!hydrated) {
    return (
      <SettingsSection title="Project details">
        <Skeleton className="h-32" />
      </SettingsSection>
    );
  }
  if (!doc) return <NoProject title="Project settings" />;

  const rename = async () => {
    setRenaming(false);
    try {
      await updateProject(doc.id, { name: name.trim() || doc.name });
      toast("Project renamed");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not rename", "warn");
    }
  };

  const remove = async () => {
    setConfirmDelete(false);
    try {
      await deleteProject(doc.id);
      toast(`${doc.name} deleted`, "warn");
      router.push("/projects");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not delete", "warn");
    }
  };

  return (
    <>
      <PageHeader
        title={doc.name}
        description={`Created ${dateFormat.format(Date.parse(doc.created_at))}`}
        action={<ProjectSwitcher />}
      />

      <SettingsSection title="Project details">
        <SettingRows>
          <SettingRow
            label="Project name"
            action={
              <button
                type="button"
                onClick={() => {
                  setName(doc.name);
                  setRenaming(true);
                }}
                className="cursor-pointer text-sm text-fg underline underline-offset-2"
              >
                {doc.name}
              </button>
            }
          />
          <SettingRow
            label="Live URL"
            action={
              <RowValue>
                {doc.published_url ? (
                  <a href={doc.published_url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                    {doc.published_url.replace(/^https?:\/\//, "")}
                  </a>
                ) : (
                  "Not published"
                )}
              </RowValue>
            }
          />
          <SettingRow label="Owner" action={<RowValue>You</RowValue>} />
          <SettingRow label="Stage" action={<RowValue>{doc.mode === "plan" ? "Planning" : "Building"}</RowValue>} />
          <SettingRow
            label="Backend"
            action={<RowValue>{doc.supabase_project_ref ? `Supabase · ${doc.supabase_project_ref}` : "None"}</RowValue>}
          />
          <SettingRow
            label="Payments"
            action={<RowValue>{doc.payments_provider === "none" ? "Off" : "Paystack"}</RowValue>}
          />
        </SettingRows>
      </SettingsSection>

      <SettingsSection title="Project monitoring">
        <SettingRow
          label={
            <>
              Project monitoring <PlanBadge tier="Pro" />
            </>
          }
          description="Regularly check this project for issues and improvements. Past checks and their credit usage are stored in your history."
          action={<Toggle checked={false} disabled onChange={() => {}} label="Project monitoring" />}
        />
      </SettingsSection>

      <SettingsSection title="Danger zone" danger>
        <SettingRow
          label="Delete project"
          description="Permanently delete this project, its files and its history."
          action={
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="cursor-pointer rounded-full px-4 py-2 text-[13px] font-bold text-warn transition-colors hover:bg-warn/10"
            >
              Delete
            </button>
          }
        />
      </SettingsSection>

      {renaming && (
        <Dialog title="Rename project" size="sm" onClose={() => setRenaming(false)}>
          <div className="flex flex-col gap-4 px-5 py-4">
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                void rename();
              }}
              className={inputClass}
            />
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setRenaming(false)}
                className={buttonClass({ variant: "secondary", size: "sm" })}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void rename()}
                className={buttonClass({ size: "sm" })}
              >
                Rename
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {confirmDelete && (
        <Dialog
          title={`Delete ${doc.name}?`}
          description="This removes the project, every file and its whole history. It cannot be undone."
          size="sm"
          onClose={() => setConfirmDelete(false)}
        >
          <div className="flex justify-end gap-2.5 px-5 py-4">
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className={buttonClass({ variant: "secondary", size: "sm" })}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                void remove();
              }}
              className={buttonClass({ size: "sm" })}
            >
              Delete project
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
