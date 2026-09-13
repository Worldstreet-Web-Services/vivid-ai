# Web3 patterns to copy

## src/lib/chain.ts
```ts
import { createPublicClient, defineChain, http } from "viem";
const env = import.meta.env;
export const ark = defineChain({
  id: Number(env.VITE_CHAIN_ID ?? 9000),
  name: env.VITE_CHAIN_NAME ?? "Ark Constellation Devnet",
  nativeCurrency: { name: env.VITE_CHAIN_SYMBOL ?? "KASH", symbol: env.VITE_CHAIN_SYMBOL ?? "KASH", decimals: 18 },
  rpcUrls: { default: { http: [env.VITE_CHAIN_RPC], webSocket: [env.VITE_CHAIN_WS] } },
  blockExplorers: { default: { name: "Explorer", url: env.VITE_CHAIN_EXPLORER } },
});
export const publicClient = createPublicClient({ chain: ark, transport: http() });
export const explorer = {
  tx: (hash: string) => `${ark.blockExplorers!.default.url}/tx/${hash}`,
  address: (a: string) => `${ark.blockExplorers!.default.url}/address/${a}`,
};
export const FAUCET_URL = env.VITE_CHAIN_FAUCET as string;
export const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
```

## src/lib/wallet.tsx
```tsx
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { createWalletClient, custom, formatEther, type Address, type WalletClient } from "viem";
import { ark, publicClient } from "./chain";

type Wallet = { address?: Address; balance: bigint; installed: boolean; connecting: boolean;
  walletClient?: WalletClient; connect: () => Promise<void>; disconnect: () => void; refresh: () => Promise<void> };
const Ctx = createContext<Wallet | null>(null);
const eth = () => (window as any).ethereum as any | undefined;

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<Address>();
  const [balance, setBalance] = useState(0n);
  const [connecting, setConnecting] = useState(false);
  const installed = typeof window !== "undefined" && !!eth();

  const refresh = useCallback(async () => {
    if (address) setBalance(await publicClient.getBalance({ address }));
  }, [address]);

  const ensureChain = async () => {
    const p = eth(); const hex = "0x" + ark.id.toString(16);
    try { await p.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] }); }
    catch (e: any) {
      if (e?.code !== 4902) throw e;
      await p.request({ method: "wallet_addEthereumChain", params: [{ chainId: hex, chainName: ark.name,
        nativeCurrency: ark.nativeCurrency, rpcUrls: ark.rpcUrls.default.http, blockExplorerUrls: [ark.blockExplorers!.default.url] }] });
    }
  };

  const connect = async () => {
    const p = eth(); if (!p) return;
    setConnecting(true);
    try {
      const [acct] = await p.request({ method: "eth_requestAccounts" });
      await ensureChain();
      setAddress(acct as Address);
    } finally { setConnecting(false); }
  };
  const disconnect = () => { setAddress(undefined); setBalance(0n); };

  useEffect(() => {
    const p = eth(); if (!p) return;
    const onAccounts = (a: string[]) => setAddress(a[0] as Address | undefined);
    const onChain = () => refresh();
    p.on?.("accountsChanged", onAccounts); p.on?.("chainChanged", onChain);
    return () => { p.removeListener?.("accountsChanged", onAccounts); p.removeListener?.("chainChanged", onChain); };
  }, [refresh]);
  useEffect(() => { refresh(); const t = setInterval(refresh, 8000); return () => clearInterval(t); }, [refresh]);

  const walletClient = address && eth() ? createWalletClient({ account: address, chain: ark, transport: custom(eth()) }) : undefined;
  return <Ctx.Provider value={{ address, balance, installed, connecting, walletClient, connect, disconnect, refresh }}>{children}</Ctx.Provider>;
}
export function useWallet() { const v = useContext(Ctx); if (!v) throw new Error("useWallet outside WalletProvider"); return v; }
export const kash = (wei: bigint) => Number(formatEther(wei)).toLocaleString("en-NG", { maximumFractionDigits: 4 });
```

## src/lib/tx.ts (one hook for every write)
```ts
import { useState } from "react";
import { toast } from "sonner";
import type { Abi } from "viem";
import { explorer, publicClient } from "./chain";
import { useWallet } from "./wallet";

export function useTx() {
  const { walletClient, address, refresh } = useWallet();
  const [pending, setPending] = useState(false);
  async function send(params: { address: `0x${string}`; abi: Abi; functionName: string; args?: readonly unknown[]; value?: bigint }, label = "Transaction") {
    if (!walletClient || !address) { toast("Connect your wallet first"); return null; }
    setPending(true);
    try {
      const { request } = await publicClient.simulateContract({ ...params, account: address } as any);
      const hash = await walletClient.writeContract(request as any);
      toast(`${label} sent. Waiting for confirmation…`, { action: { label: "View", onClick: () => window.open(explorer.tx(hash)) } });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("The transaction reverted");
      toast.success(`${label} confirmed`, { action: { label: "View", onClick: () => window.open(explorer.tx(hash)) } });
      await refresh();
      return hash;
    } catch (e: any) {
      const m = String(e?.shortMessage || e?.message || e);
      toast.error(/rejected|denied/i.test(m) ? "You rejected the transaction" : m.split("\n")[0].slice(0, 140));
      return null;
    } finally { setPending(false); }
  }
  return { send, pending };
}
```
Usage: `const { send, pending } = useTx(); await send({ address: MarketplaceAddress, abi: MarketplaceAbi, functionName: "buy", args: [id], value: price }, "Purchase")`.

## Reading and live events
```ts
const listings = await publicClient.readContract({ address: MarketplaceAddress, abi: MarketplaceAbi, functionName: "getListings" });
const unwatch = publicClient.watchContractEvent({ address: MarketplaceAddress, abi: MarketplaceAbi, eventName: "Sold", onLogs: (logs) => refetch() });
```
Back-fill history: `publicClient.getLogs({ address, event: parseAbiItem("event Sold(uint256 indexed id, address buyer, uint256 price)"), fromBlock: BigInt(artifact.block) })`.

## Header connect button
Signed out: "Connect wallet" (primary). Connected: a pill with the short address and balance
("0x12ab…9f3e · 9.98 KASH") opening a dropdown with Copy address, View on explorer, Get test
KASH (faucet), Disconnect. Below the faucet threshold, a small amber dot on the pill.

## Contracts

### Token.sol (ERC-20, capped)
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
contract Token is ERC20, Ownable {
    uint256 public immutable cap;
    constructor(string memory name_, string memory symbol_, uint256 cap_, address owner_) ERC20(name_, symbol_) Ownable(owner_) { cap = cap_; }
    function mint(address to, uint256 amount) external onlyOwner { require(totalSupply() + amount <= cap, "cap"); _mint(to, amount); }
}
```
Args: `["Chop Points", "CHOP", "1000000000000000000000000", "<deployer>"]`.

### Collectible.sol (ERC-721 with a mint price)
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
contract Collectible is ERC721URIStorage, Ownable {
    uint256 public nextId = 1; uint256 public price; uint256 public maxSupply;
    event Minted(address indexed to, uint256 indexed id, string uri);
    constructor(string memory name_, string memory symbol_, uint256 price_, uint256 maxSupply_, address owner_) ERC721(name_, symbol_) Ownable(owner_) { price = price_; maxSupply = maxSupply_; }
    function mint(string calldata uri) external payable returns (uint256 id) {
        require(msg.value >= price, "pay the mint price"); require(nextId <= maxSupply, "sold out");
        id = nextId++; _safeMint(msg.sender, id); _setTokenURI(id, uri); emit Minted(msg.sender, id, uri);
    }
    function setPrice(uint256 p) external onlyOwner { price = p; }
    function withdraw() external onlyOwner { (bool ok,) = owner().call{value: address(this).balance}(""); require(ok, "withdraw failed"); }
}
```

### Marketplace.sol (list, buy into escrow, release or refund)
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
contract Marketplace is ReentrancyGuard, Ownable {
    enum Status { Listed, Paid, Released, Refunded, Cancelled }
    struct Listing { uint256 id; address seller; address buyer; uint256 price; string ref; Status status; uint256 paidAt; }
    uint256 public nextId = 1; uint256 public feeBps; mapping(uint256 => Listing) public listings;
    event Listed(uint256 indexed id, address indexed seller, uint256 price, string ref);
    event Paid(uint256 indexed id, address indexed buyer);
    event Released(uint256 indexed id, uint256 sellerAmount, uint256 fee);
    event Refunded(uint256 indexed id);
    event Cancelled(uint256 indexed id);
    constructor(uint256 feeBps_, address owner_) Ownable(owner_) { require(feeBps_ <= 1000, "fee"); feeBps = feeBps_; }
    function list(uint256 price, string calldata ref) external returns (uint256 id) {
        require(price > 0, "price"); id = nextId++;
        listings[id] = Listing(id, msg.sender, address(0), price, ref, Status.Listed, 0); emit Listed(id, msg.sender, price, ref);
    }
    function buy(uint256 id) external payable nonReentrant {
        Listing storage l = listings[id]; require(l.status == Status.Listed, "not for sale"); require(msg.value == l.price, "wrong amount");
        l.buyer = msg.sender; l.status = Status.Paid; l.paidAt = block.timestamp; emit Paid(id, msg.sender);
    }
    function release(uint256 id) external nonReentrant {           // buyer confirms delivery
        Listing storage l = listings[id]; require(l.status == Status.Paid, "not paid"); require(msg.sender == l.buyer || msg.sender == owner(), "not buyer");
        l.status = Status.Released; uint256 fee = l.price * feeBps / 10000;
        (bool a,) = l.seller.call{value: l.price - fee}(""); require(a, "pay seller"); if (fee > 0) { (bool b,) = owner().call{value: fee}(""); require(b, "pay fee"); }
        emit Released(id, l.price - fee, fee);
    }
    function refund(uint256 id) external nonReentrant {            // seller or owner refunds the buyer
        Listing storage l = listings[id]; require(l.status == Status.Paid, "not paid"); require(msg.sender == l.seller || msg.sender == owner(), "not seller");
        l.status = Status.Refunded; (bool ok,) = l.buyer.call{value: l.price}(""); require(ok, "refund"); emit Refunded(id);
    }
    function cancel(uint256 id) external { Listing storage l = listings[id]; require(l.status == Status.Listed && msg.sender == l.seller, "cannot cancel"); l.status = Status.Cancelled; emit Cancelled(id); }
    function getListings() external view returns (Listing[] memory out) { out = new Listing[](nextId - 1); for (uint256 i = 1; i < nextId; i++) out[i - 1] = listings[i]; }
}
```
`ref` is the off-chain order or product id, so the app joins on-chain state to its own data.

### Ballot.sol (one vote per address, deadline)
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract Ballot {
    string[] public options; mapping(uint256 => uint256) public votes; mapping(address => bool) public voted; uint256 public immutable closesAt;
    event Voted(address indexed voter, uint256 indexed option);
    constructor(string[] memory options_, uint256 closesAt_) { options = options_; closesAt = closesAt_; }
    function vote(uint256 option) external { require(block.timestamp < closesAt, "closed"); require(!voted[msg.sender], "already voted"); require(option < options.length, "option"); voted[msg.sender] = true; votes[option] += 1; emit Voted(msg.sender, option); }
    function results() external view returns (string[] memory names, uint256[] memory counts) { names = options; counts = new uint256[](options.length); for (uint256 i; i < options.length; i++) counts[i] = votes[i]; }
}
```

### Registry.sol (attestations by hash)
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract Registry {
    struct Record { address by; uint256 at; string note; }
    mapping(bytes32 => Record) public records;
    event Registered(bytes32 indexed hash, address indexed by, string note);
    function register(bytes32 hash, string calldata note) external { require(records[hash].at == 0, "exists"); records[hash] = Record(msg.sender, block.timestamp, note); emit Registered(hash, msg.sender, note); }
    function verify(bytes32 hash) external view returns (bool, address, uint256) { Record memory r = records[hash]; return (r.at != 0, r.by, r.at); }
}
```
Hash a file or document in the browser with `crypto.subtle.digest("SHA-256", bytes)` and pass it as `0x…`.
