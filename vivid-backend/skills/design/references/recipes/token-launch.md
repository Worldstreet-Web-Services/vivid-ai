# Recipe: token-launch (a community or loyalty token on Ark Constellation with a dashboard)

On-chain (web3 skill). Pages: Home (the token), Dashboard (balances and transfers),
Claim or Earn (when the spec has an airdrop or rewards), Tokenomics, Holders, Docs or
FAQ. Owner area at /admin: mint to an address, pause, ownership.

Home: the token symbol as a generated mark, the name and one line of what it is for,
live stats from the contract (total supply, holders from the explorer, your balance when
connected), Connect wallet, how to get it (faucet on devnet, claim, buy or earn),
tokenomics as a donut and a table, roadmap, footer with the contract address.

Dashboard: balance, send tokens (address, amount, review, confirm), transfer history from
events and the explorer, add to MetaMask button (`wallet_watchAsset`). Claim: an
allowlist or a simple faucet-style claim per address when the spec asks, enforced in the
contract.

Contract: the Token pattern (ERC-20, capped, owner mint) extended as the spec needs
(claim once per address, pause), deployed once final.

Minimums for a first build: the contract deployed and imported, wallet connect, balance
and transfer working on the devnet, tokenomics page with the spec's numbers, admin
controls as wallet transactions.
