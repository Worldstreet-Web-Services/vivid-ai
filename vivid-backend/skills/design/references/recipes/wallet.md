# Recipe: wallet (a self-custody crypto wallet for Ark Constellation)

A wallet is a security product first and a fintech app second. It looks like a modern
mobile banking app (light or dark, one accent, big balance, clear actions) and behaves
with the caution of one. Phone width is the primary layout; desktop centres a 420px
column. The web3 skill's wallet patterns are the implementation; this recipe is the shape.

Pages (routes): Welcome (/), Create (/create, three steps: password, write down the 12
words, confirm 3 of them), Import (/import, 12 or 24 words or a private key), Unlock
(/unlock), Home (/home), Send (/send), Receive (/receive), Activity (/activity), Tokens
(/tokens), Settings (/settings: reveal recovery phrase behind the password, change
password, network details with RPC and explorer, lock, remove wallet).

Welcome: the brand mark, one line ("Your KASH, your keys"), two buttons: Create a new
wallet (primary), I already have one. A one-line note that the wallet lives on this device.

Create: step indicator; the password screen explains it only unlocks this device; the
phrase screen shows the 12 words numbered in a 3-column grid on a blurred card until the
user taps "Reveal", with Copy, a warning strip ("Anyone with these words owns your KASH.
Vivid never sees them"), and a checkbox "I wrote them down"; the confirm screen asks for
three random positions. Then straight to Home.

Home: balance in KASH large (text-5xl, tabular numbers) with a naira estimate line only if
the spec gives a rate; the address as a short pill (tap to copy, long-press for QR); four
round actions: Send, Receive, Faucet (devnet) and Explorer; a "Recent activity" list of
the last five transactions with direction arrow, counterparty short address, amount, time,
status; an empty state for a fresh wallet with the faucet as the call to action.

Send: recipient (0x… or ark1…, pasted or scanned, validated as you type, with the
converted form shown underneath), amount with a MAX button and the fee estimate, a review
sheet (to, amount, fee, total) with a slide or hold-to-confirm, then a status screen:
pending with the explorer link, then confirmed. Insufficient balance and bad address are
inline errors, never toasts alone.

Receive: the QR of the 0x address, the address in full with Copy, the ark1… form below
with its own Copy, and a Share button (Web Share API when available).

Activity: all transactions from the explorer API, newest first, grouped by day, with
filters Sent / Received / Contract; each opens a detail sheet (hash with explorer link,
block, fee, status, method).

Tokens: ERC-20 balances the explorer knows for the address, with symbol, balance and a
Send that works like the KASH send; an "Add token by address" form.

Settings: the network card (name, chain id, RPC, explorer, faucet), reveal recovery phrase
(password required, same blurred card), change password, auto-lock timer, Lock now, and
"Remove wallet from this device" behind a typed confirmation.

Chrome: a bottom tab bar on phones (Home, Activity, Tokens, Settings) and a top bar with
the lock icon; the send and receive flows are full-screen sheets. Locked state: every
route except Welcome, Create and Import redirects to Unlock. Auto-lock after 15 minutes
idle and on tab hide.

Minimums for a first build: every page above; create, import and unlock working against
the real chain; a send that lands on the devnet; the activity list from the explorer;
the faucet reachable from Home; nothing about keys ever leaves the browser; no admin area
(a wallet has no owner side).
