export interface Source {
  id: string;
  title: string;
  // Shown under the title and used for the favicon letter.
  domain: string;
  url: string;
  snippet: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  // Assistant messages cite the sources they drew on.
  sources?: Source[];
  // Set once the reader rates an answer, so the buttons can show state.
  rating?: "up" | "down";
}

export interface Session {
  id: string;
  title: string;
  updatedAt: string;
  messages: Message[];
}

export type ExportFormat = "markdown" | "pdf" | "docx";

export const EXPORT_FORMATS: { value: ExportFormat; label: string; detail: string }[] = [
  { value: "markdown", label: "Markdown", detail: "Plain text with formatting preserved." },
  { value: "pdf", label: "PDF", detail: "Formatted for printing and sharing." },
  { value: "docx", label: "Word", detail: "Editable document." },
];

export const REPORT_REASONS = [
  { value: "inaccurate", label: "Inaccurate or misleading" },
  { value: "harmful", label: "Harmful or unsafe" },
  { value: "offensive", label: "Offensive or inappropriate" },
  { value: "copyright", label: "Copyright concern" },
  { value: "other", label: "Something else" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["value"];
