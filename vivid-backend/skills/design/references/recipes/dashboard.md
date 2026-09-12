# Recipe: dashboard / internal tool

Layout: a left sidebar (icons and labels, collapsible to icons on tablets, a sheet on
phones) and a top bar with the page title, search and the user. Content area p-4 sm:p-6.

Home: four stat cards (label, value, small delta), a chart or table below, recent activity
on the right on desktop.

Lists: a table on desktop (sticky header, zebra rows off, hover row), cards on phones. A
toolbar above with search, filters as select or pills, and one primary action. Empty
state with an action. Pagination or "Load more".

Detail and edit: a dialog for short edits, a page for long ones. Forms in a single column,
labels above, help text below, destructive actions in a confirm dialog.

Density: text-sm everywhere, gap-4, rounded-md. Status as badges with the same colour
meaning across the app.

Minimums for a first build: every list seeded with 12 or more realistic rows, the four
stat cards computed from that data, create and edit dialogs that work, and search and one
filter functioning.
