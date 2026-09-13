# Recipe: chat-assistant (an AI chatbot or assistant product: chat UI, history, a knowledge base)

Pages: Sign in, Chat (the app), Conversations list, Knowledge or Sources (upload
documents), Settings (persona, model, keys when the spec has them), a marketing Home when
the spec asks. Owner area at /admin: usage, users, sources.

Chat: a conversation list rail (desktop) or a drawer (phone), the thread with user and
assistant bubbles, markdown rendering with code blocks and copy, streaming text, a
composer with attachments and a send button, suggested prompts on an empty thread, rename
and delete, a "new chat" button always visible.

Knowledge: upload PDFs or paste text, a list of sources with status, used for answers when
the spec asks; the answer shows its sources as chips.

Backend: the assistant calls a server function (edge function on Supabase or the app's
own API as the spec says) that holds the model key; the browser never holds it. Stream
responses; show a stop button.

Data: conversations, messages (role, content, sources), sources and chunks, usage.

Minimums for a first build: sign in, a working chat with streaming against the configured
model endpoint (a clearly labelled mock when no key exists), conversation history,
knowledge upload saving, admin at /admin with usage.
