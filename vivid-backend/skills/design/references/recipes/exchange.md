# Recipe: exchange (a token swap or simple order book on Ark Constellation)

On-chain (web3 skill). Pages: Home (swap), Pools or Markets, Pool, Add liquidity, My
positions, History. Owner area at /admin: fees, pause.

Home: the swap card centred (from token and amount, to token and estimated amount, rate,
fee, slippage setting, price impact, Connect or Swap), a token picker sheet with
balances, recent trades below, the chain stats strip.

Pools: a table of pairs with liquidity, volume and fee; Pool: reserves, your share, add
and remove liquidity with the two amounts and the ratio; History: your swaps with
explorer links.

Contract: a constant-product pool per pair (reserves, add, remove, swap with a fee, events
for every action), a factory or a fixed set of pairs from the spec; tokens from the Token
pattern for demo pairs. Simulate every swap before sending; show the minimum received.

Minimums for a first build: two demo tokens and one pool deployed and seeded with
liquidity by the deployer, swap and add-liquidity working on the devnet with correct
maths, history from events, the admin pause as a wallet transaction.
