# Recipe: nft-drop (a collectible drop on Ark Constellation: mint page, gallery, holders)

On-chain (web3 skill). Pages: Home (the drop), Mint, Gallery, My collection, About the
artist, FAQ. Owner area at /admin: contract controls (price, pause, withdraw, ownership).

Home: a full-bleed hero with the artwork (generated, in the collection's style), the
collection name in display type, supply and price, a mint progress bar (minted of supply,
live from the contract), a countdown when the drop has a start, Connect wallet and Mint;
a preview grid of pieces; about the artist; roadmap or utility; FAQ; footer with the
contract address and explorer link.

Mint: the connected wallet's balance, quantity stepper with the total in KASH, Mint
button (simulate first, then send, pending and confirmed with the explorer link), the
minted piece revealed with its token id; faucet link when the balance is low.

Gallery: all minted tokens from events and metadata; My collection: the wallet's tokens
with transfer. Metadata: token URIs point at JSON in public/metadata (generated with the
images) or an external base URI from the spec.

Contract: the Collectible pattern (ERC-721, mint price, max supply, withdraw), deployed
with deploy_contract once final.

Minimums for a first build: the contract deployed and imported, the mint flow working on
the devnet, at least 12 artworks with metadata, the gallery reading from the chain, the
admin controls as wallet transactions.
