"use client";

import { Check, ChevronRight, Copy, FolderClosed, FolderOpen } from "lucide-react";
import { useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { key, listAssets, listFiles, readFile } from "@/lib/api/endpoints";
import { useResource } from "@/lib/api/use-resource";
import { cn } from "@/lib/cn";
import { isBinaryPath, isImagePath, looksBinary } from "@/lib/binary";
import { buildTree, countLines, type FileTreeNode } from "@/lib/files";
import { languageFor } from "@/lib/highlight";
import { usePrefs } from "@/lib/store/prefs";
import { CodeView } from "./code-view";
import { FileIcon } from "./file-icon";

type Props = {
  projectId: string;
  selectedFile: string | null;
  onFileSelect: (path: string) => void;
};

/**
 * A read-only view of the project's files.
 *
 * The tree and the open file are two requests: `/files` lists paths and
 * `/files/{path}` returns one body. Fetching every file to build the tree would
 * pull a whole app over the wire to draw a sidebar.
 */
export function CodeBrowser({ projectId, selectedFile, onFileSelect }: Props) {
  // Appearance settings drive these, so those controls aren't decorative.
  const prefs = usePrefs();
  const wrap = prefs.status === "ready" ? prefs.data.workspace.codeWrap : false;
  const fontSize = prefs.status === "ready" ? prefs.data.workspace.codeFontSize : 12.5;

  const listing = useResource(key.files(projectId), () => listFiles(projectId));
  const paths = useMemo(() => (listing.status === "ready" ? listing.data.files : []), [listing]);
  const tree = useMemo(() => buildTree(paths), [paths]);

  const activePath = (selectedFile && paths.includes(selectedFile) ? selectedFile : paths[0]) ?? null;
  const binary = Boolean(activePath && isBinaryPath(activePath));

  // Never fetched for a binary path: the endpoint would hand back a JPEG
  // decoded as UTF-8, and the highlighter would tokenise the wreckage.
  const file = useResource(
    activePath && !binary ? key.file(projectId, activePath) : null,
    () => readFile(projectId, activePath!),
    { enabled: Boolean(activePath) && !binary },
  );

  // Generated and uploaded images are also assets, and those carry a real URL —
  // the only way to actually show a picture the agent made.
  const assets = useResource(binary ? key.assets(projectId) : null, () => listAssets(projectId), {
    enabled: binary,
  });
  const asset =
    assets.status === "ready" && activePath
      ? assets.data.find((item) => item.name === activePath.split("/").pop())
      : undefined;

  const [copied, setCopied] = useState(false);

  const copy = () => {
    if (file.status !== "ready") return;
    navigator.clipboard
      ?.writeText(file.data.content)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      })
      .catch(() => {});
  };

  if (listing.status === "loading") return <Skeleton className="h-full min-h-[420px] rounded-2xl" />;

  if (listing.status === "error") {
    return (
      <p className="rounded-2xl border border-dashed border-line-2 p-6 text-center text-sm text-muted">
        {listing.error.message}
      </p>
    );
  }

  if (!paths.length) {
    return (
      <p className="rounded-2xl border border-dashed border-line-2 p-6 text-center text-sm text-muted">
        No files yet. They appear once the first build runs.
      </p>
    );
  }

  return (
    <div className="grid h-full min-h-[420px] gap-4 md:grid-cols-[224px_1fr]">
      <nav
        aria-label="Files"
        className="no-scrollbar min-w-0 overflow-auto rounded-2xl border border-line-2 bg-surface py-2"
      >
        <p className="px-3 pb-1.5 text-[10px] font-bold tracking-[0.14em] text-muted-3 uppercase">Explorer</p>
        <ul role="tree" className="flex flex-col">
          {tree.map((node) => (
            <TreeNode key={node.path} node={node} depth={0} activePath={activePath} onSelect={onFileSelect} />
          ))}
        </ul>
      </nav>

      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-line-2 bg-surface">
        <div className="flex flex-none items-center gap-3 border-b border-line pr-2 pl-1">
          {/* The open file reads as a tab, the way an editor shows it. */}
          <span className="flex min-w-0 items-center gap-2 border-b-2 border-fg-2 px-3 py-2.5">
            {activePath && <FileIcon name={activePath} />}
            <span className="truncate text-xs font-bold text-fg">{activePath?.split("/").pop()}</span>
          </span>
          {file.status === "ready" && !binary && (
            <span className="ml-auto flex-none text-[11px] font-semibold text-muted-3">
              {countLines(file.data.content)} lines
            </span>
          )}
          <button
            type="button"
            onClick={copy}
            aria-label="Copy file"
            className={cn(
              "flex cursor-pointer items-center rounded-lg px-2 py-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-fg",
              (binary || file.status !== "ready") && "invisible",
            )}
          >
            {copied ? <Check aria-hidden className="size-3.5 text-fg" /> : <Copy aria-hidden className="size-3.5" />}
          </button>
        </div>

        {binary && activePath ? (
          <BinaryFile path={activePath} url={asset?.url} loading={assets.status === "loading"} />
        ) : file.status === "ready" && activePath ? (
          looksBinary(file.data.content) ? (
            <BinaryFile path={activePath} />
          ) : (
            <CodeView content={file.data.content} language={languageFor(activePath)} wrap={wrap} fontSize={fontSize} />
          )
        ) : (
          <div className="min-h-0 flex-1 p-4">
            {file.status === "error" ? (
              <p className="text-sm text-muted">{file.error.message}</p>
            ) : (
              <Skeleton className="h-full min-h-[200px]" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** An image preview when one is reachable, an honest note when it is not. */
function BinaryFile({ path, url, loading }: { path: string; url?: string; loading?: boolean }) {
  const name = path.split("/").pop() ?? path;

  if (isImagePath(path) && url) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-surface-2 p-6">
        {/* A signed, time-limited URL on a host that is not known at build time. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={name} className="max-h-full max-w-full rounded-lg object-contain" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1.5 p-6 text-center">
      <p className="text-sm font-semibold text-fg">{name}</p>
      <p className="text-sm text-muted">
        {loading ? "Looking for a preview…" : "This file is not text, so there is nothing to show here."}
      </p>
    </div>
  );
}

function TreeNode({
  node,
  depth,
  activePath,
  onSelect,
}: {
  node: FileTreeNode;
  depth: number;
  activePath: string | null;
  onSelect: (path: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const indent = { paddingLeft: `${depth * 12 + 10}px` };

  if (node.kind === "dir") {
    const Folder = open ? FolderOpen : FolderClosed;
    return (
      <li role="treeitem" aria-expanded={open} aria-selected={false}>
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          style={indent}
          className="flex w-full cursor-pointer items-center gap-1 rounded-md py-1.5 pr-2 text-left text-[13px] font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-fg"
        >
          <ChevronRight
            aria-hidden
            className={cn("size-3 flex-none text-muted-3 transition-transform", open && "rotate-90")}
          />
          <Folder aria-hidden className="size-3.5 flex-none text-code-fn/80" />
          <span className="truncate">{node.name}</span>
        </button>
        {open && (
          <ul role="group" className="relative flex flex-col">
            {/* The guide line is what keeps deep nesting readable. */}
            <span aria-hidden className="absolute inset-y-0 w-px bg-line-2" style={{ left: `${depth * 12 + 16}px` }} />
            {node.children.map((child) => (
              <TreeNode key={child.path} node={child} depth={depth + 1} activePath={activePath} onSelect={onSelect} />
            ))}
          </ul>
        )}
      </li>
    );
  }

  const selected = node.path === activePath;
  return (
    <li role="treeitem" aria-selected={selected}>
      <button
        type="button"
        onClick={() => onSelect(node.path)}
        style={indent}
        className={cn(
          "flex w-full cursor-pointer items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-[13px] transition-colors",
          selected ? "bg-surface-2 font-semibold text-fg" : "text-muted hover:bg-surface-2/60 hover:text-fg",
        )}
      >
        <span aria-hidden className="size-3 flex-none" />
        <FileIcon name={node.name} />
        <span className="truncate">{node.name}</span>
      </button>
    </li>
  );
}
