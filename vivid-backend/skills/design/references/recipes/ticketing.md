# Recipe: ticketing (event tickets as NFTs on Ark Constellation, with a check-in scanner)

On-chain (web3 skill) with the event recipe's public pages. Pages: Home (the event),
Tickets (buy), My tickets (QR per ticket), Check-in (organiser scanner), Resale (optional).
Owner area at /admin: sales, check-in list, contract controls.

Tickets: tiers from the contract (price in KASH, supply, sold), quantity, Connect wallet,
Buy (mint) with pending and confirmed, then My tickets shows each ticket as a card with a
QR encoding the token id and a signed message; transfer to a friend by address.

Check-in: the organiser signs in (wallet must be the owner or a scanner role), a camera
scanner or a paste field verifies the ticket on chain (owner matches, not yet used) and
marks it used with a transaction or an off-chain list when the spec says.

Contract: the Collectible pattern per tier with a `used` flag and an `admit` function for
the organiser role; events for every mint and admit.

Minimums for a first build: the contract deployed, 3 tiers, buying to a QR ticket on the
devnet, the check-in page verifying and admitting, admin at /admin with sales and the
list.
