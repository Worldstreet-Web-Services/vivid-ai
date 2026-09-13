# Recipe: dao (a voting or governance app on Ark Constellation: proposals, votes, treasury)

On-chain (web3 skill). Pages: Home, Proposals, Proposal, Create proposal, Members or
Voters, Treasury, About. Owner area at /admin only if the spec has an admin; otherwise
governance is the admin.

Home: the group's name and purpose, live numbers (members, proposals, treasury in KASH),
Connect wallet, active proposals as cards with a countdown and vote bars, how voting
works, footer with the contract address.

Proposal: title, description, author, status (active, passed, failed, executed), the vote
bars (for, against, abstain) with percentages and counts, your vote and eligibility, a
Vote panel (simulate, send, confirm), a timeline of events from the chain, discussion
link. Create: a form (title, description, options or action, duration) that sends a
transaction; a deposit if the spec has one.

Contract: the Ballot pattern extended to many proposals with deadlines, one vote per
address (or token-weighted with the Token pattern), an execute step that pays out from
the treasury when the spec has one.

Minimums for a first build: the contract deployed, 6 seeded proposals in different states
(seeded by the deployer through transactions), voting working on the devnet, treasury
balance live, member list from events.
