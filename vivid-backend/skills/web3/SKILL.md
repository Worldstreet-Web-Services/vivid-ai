---
name: web3
description: How to build a dApp on Ark Constellation in an app the builder makes: wallet connection, reads and writes with viem, contracts in Solidity deployed with deploy_contract, and the UX rules that keep on-chain apps usable. Applies when the project is on-chain.
---

# dApps on Ark Constellation

The chain is chosen: Ark Constellation devnet, an EVM chain (id 9000, native KASH, 18
decimals, about 3.5 s blocks, gas about 1 gwei). Visitors use MetaMask; Vivid deploys the
contracts from the project's own deployer and pays devnet gas. Everything else about the
app (pages, design, copy, cart, admin) follows the other skills; on-chain is one more layer,
not a different kind of app.

## What goes on chain, and what does not
- On chain: what must be trustless or transferable. Balances, ownership (tokens, NFTs,
  tickets), escrowed payments, votes, attestations, registries, the rules that move them.
- Off chain: everything else. Catalogue text, images, profiles, comments, search. Keep them
  in the browser or Supabase as the other skills say, and store on chain only ids, hashes
  and amounts. A shop's products are not on chain; the order's escrow is.
- One or two contracts, small and readable. A marketplace is one `Marketplace` contract,
  not five.

## Files (keep every project the same)
- `src/lib/chain.ts`: the `ark` chain definition for viem, built from `import.meta.env`,
  plus `publicClient` (http) and the explorer link helpers. Patterns file has it.
- `src/lib/wallet.tsx`: `WalletProvider` and `useWallet()` (address, balance, connect,
  disconnect, switch to the chain, `walletClient`); the header's Connect button uses it.
- `src/lib/contracts/<Name>.ts`: written by `deploy_contract` (address and ABI `as const`).
  Import from there; never paste an address anywhere else.
- `src/lib/tx.ts`: `useTx()` for write calls: pending, confirmed with explorer link, or the
  error in plain words, as a toast and in the button.
- `contracts/<Name>.sol`: the source, kept in the project so a redeploy is one call.

## Wallet
- Connect with `window.ethereum` (MetaMask and compatible wallets); no wallet library is
  needed. On connect, `wallet_switchEthereumChain` to `0x2328`; if the wallet does not know
  it, `wallet_addEthereumChain` with the chain params (patterns file), then switch.
- Show the short address (`0x1234…abcd`), the KASH balance formatted to 4 decimals, and a
  "Get test KASH" link to the faucet when the balance is below the cost of a transaction.
- No wallet installed: a card that explains what MetaMask is, links to it, and keeps the
  rest of the site usable read-only. Never a blank page.
- The connected account can change or disconnect at any time: listen to
  `accountsChanged` and `chainChanged` and update state; reload nothing.

## Reads and writes
- Reads with `publicClient.readContract({ address, abi, functionName, args })`; poll every
  block-ish (4 s) for values the page shows live, or subscribe to events over the WebSocket
  for feeds. Cache reads in state; show a skeleton on first load.
- Writes with `walletClient.writeContract(...)` after `publicClient.simulateContract(...)`;
  simulation turns most failures into a readable reason before the wallet opens. Then
  `waitForTransactionReceipt`. Show: "Confirm in your wallet", "Pending… view on explorer",
  then success; on failure the revert reason or "You rejected the transaction".
- Amounts: `parseEther` on the way in, `formatEther` on the way out, never floats in
  contract calls. Prices in KASH on screen; naira equivalents only if the spec asks.
- Events: `publicClient.watchContractEvent` for live lists (bids, sales, votes); back-fill
  history with `getLogs` from the deployment block, which the artifact records.

## Contracts (Solidity ^0.8.20)
- Small, explicit, events for every state change, `owner`-gated admin functions
  (OpenZeppelin `Ownable`), `ReentrancyGuard` on anything that sends value, checks before
  effects before interactions, no floats, amounts in wei, timestamps in seconds.
- Use OpenZeppelin for tokens: `ERC20`, `ERC721` with `ERC721URIStorage`, `Ownable`,
  `ReentrancyGuard`. Import as `@openzeppelin/contracts/...`.
- Patterns file has: `Token` (ERC-20 with a capped mint), `Collectible` (ERC-721 with
  metadata URIs and a mint price), `Marketplace` (list, buy into escrow, release or refund),
  `Ballot` (one vote per address, deadline), `Registry` (attestations by hash).
- Constructor arguments come from the spec (name, symbol, price in wei as a string,
  owner = the deployer, which then transfers ownership to the user's wallet from the
  admin page if the spec has an owner).
- Deploy once the contract is final. Then build the UI against `src/lib/contracts/<Name>.ts`.
  A redeploy changes the address and loses state; say so to the user before doing it.

## Admin and roles
- The owner area (/admin, as the roles rule says) shows the contract address with an
  explorer link, the deployer's balance, and the owner-only actions (pause, withdraw,
  set price, transfer ownership) as wallet transactions signed by the owner's wallet.
- The deployer is Vivid's wallet for deployments; the user's wallet becomes the owner via
  `transferOwnership` on first admin visit, offered as one button.

## Definition of done (check before you reply)
1. Wallet connects, switches to the chain, shows the address and balance, and the site
   still works read-only without a wallet.
2. Every contract in the spec is deployed, verified where the explorer allowed it, and
   imported from src/lib/contracts; the artifact's address matches the explorer.
3. The main flow (mint, buy, vote, register) runs end to end as a wallet transaction with
   pending and confirmed states and explorer links.
4. The admin page shows the contract and the owner actions.
5. No private key anywhere in src/ or .env; the final reply gives the contract address,
   the explorer link, and tells the user to install MetaMask and use the faucet.
