"""On-chain apps on Ark Constellation.

One chain, chosen for the user: the Ark Constellation devnet (Cosmos SDK
with an EVM, chain id 9000, native KASH). Each on-chain project gets its
own deployer wallet, generated here and funded from the devnet faucet; the
deploy tool compiles Solidity in the sandbox with solc and deploys with
viem from that wallet; the address and ABI land in the app as TypeScript.
The user's own wallet (MetaMask) signs the user's transactions in the
browser; the deployer signs deployments and owner setup only.
"""
import json
import logging
import re
from dataclasses import dataclass

import httpx
from eth_account import Account

from app.core.config import settings
from app.services.models_gateway import http

log = logging.getLogger("vivid.builder.chain")

ARK = {
    "key": "ark-devnet",
    "name": "Ark Constellation Devnet",
    "chain_id": 9000,
    "chain_id_hex": "0x2328",
    "cosmos_chain_id": "arkdevnet_9000-1",
    "symbol": "KASH",
    "decimals": 18,
    "gas_denom": "esp",
    "rpc": "https://evm.34.60.137.196.sslip.io",
    "ws": "wss://evm-ws.34.60.137.196.sslip.io",
    "cosmos_rpc": "https://rpc.34.60.137.196.sslip.io",
    "lcd": "https://lcd.34.60.137.196.sslip.io",
    "explorer": "https://explorer.34.60.137.196.sslip.io",
    "explorer_api": "https://explorer-api.34.60.137.196.sslip.io",
    "faucet": "https://faucet.34.60.137.196.sslip.io",
    "solc": "0.8.36",                       # the newest the explorer can verify
    "solc_long": "v0.8.36+commit.8a079791",
    "evm_version": "paris",
}
CHAINS = {ARK["key"]: ARK}
_ADDRESS = re.compile(r"^0x[0-9a-fA-F]{40}$")
_NAME = re.compile(r"^[A-Z][A-Za-z0-9]{1,40}$")

#: Packages the sandbox needs for compiling and deploying (installed on
#: first use when the template lacks them).
PACKAGES = f"solc@{ARK['solc']} viem@2 @openzeppelin/contracts@5"
SCRIPT_PATH = "scripts/vivid-deploy.mjs"
KEY_FILE = "/tmp/.vivid-deployer"

#: Compiles one .sol with solc, deploys it with viem from the key file,
#: writes the artifact and a TypeScript binding, prints one JSON line.
DEPLOY_SCRIPT = r"""// Written by Vivid. Usage: node scripts/vivid-deploy.mjs <file.sol> <ContractName> '<json args>'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { createPublicClient, createWalletClient, http, defineChain, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
const require = createRequire(import.meta.url);
const solc = require("solc");
const [,, file, name, argsJson = "[]"] = process.argv;
const chain = defineChain({ id: Number(process.env.CHAIN_ID), name: process.env.CHAIN_NAME,
  nativeCurrency: { name: process.env.CHAIN_SYMBOL, symbol: process.env.CHAIN_SYMBOL, decimals: 18 },
  rpcUrls: { default: { http: [process.env.CHAIN_RPC] } } });
const source = readFileSync(file, "utf8");
const input = { language: "Solidity", sources: { [file]: { content: source } },
  settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: process.env.EVM_VERSION || "paris",
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } } };
function findImports(p) {
  for (const base of ["node_modules/", ""]) { const full = base + p; if (existsSync(full)) return { contents: readFileSync(full, "utf8") }; }
  return { error: "not found: " + p };
}
const out = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
const errors = (out.errors || []).filter(e => e.severity === "error");
if (errors.length) { console.log(JSON.stringify({ ok: false, errors: errors.map(e => e.formattedMessage) })); process.exit(0); }
const c = (out.contracts[file] || {})[name];
if (!c) { console.log(JSON.stringify({ ok: false, errors: [`no contract named ${name} in ${file}; found: ${Object.keys(out.contracts[file] || {}).join(", ")}`] })); process.exit(0); }
const key = readFileSync(process.env.KEY_FILE, "utf8").trim();
const account = privateKeyToAccount(key);
const pub = createPublicClient({ chain, transport: http() });
const wallet = createWalletClient({ account, chain, transport: http() });
const balance = await pub.getBalance({ address: account.address });
if (balance === 0n) { console.log(JSON.stringify({ ok: false, errors: [`deployer ${account.address} has no ${process.env.CHAIN_SYMBOL}; call chain_faucet first`] })); process.exit(0); }
let args; try { args = JSON.parse(argsJson); } catch { console.log(JSON.stringify({ ok: false, errors: ["constructor_args is not valid JSON"] })); process.exit(0); }
try {
  const hash = await wallet.deployContract({ abi: c.abi, bytecode: "0x" + c.evm.bytecode.object, args });
  const receipt = await pub.waitForTransactionReceipt({ hash, timeout: 120_000 });
  if (receipt.status !== "success") { console.log(JSON.stringify({ ok: false, errors: [`deployment reverted in tx ${hash}`] })); process.exit(0); }
  mkdirSync("src/lib/contracts", { recursive: true }); mkdirSync("contracts/artifacts", { recursive: true });
  writeFileSync(`contracts/artifacts/${name}.json`, JSON.stringify({ address: receipt.contractAddress, abi: c.abi, tx: hash, chainId: chain.id }, null, 2));
  writeFileSync(`src/lib/contracts/${name}.ts`, `// Deployed by Vivid on ${chain.name} (chain ${chain.id}). Regenerated on every deploy; do not edit.
export const ${name}Address = "${receipt.contractAddress}" as const;
export const ${name}Abi = ${JSON.stringify(c.abi, null, 2)} as const;
`);
  console.log(JSON.stringify({ ok: true, address: receipt.contractAddress, tx: hash, block: Number(receipt.blockNumber), gasUsed: Number(receipt.gasUsed), deployer: account.address, balance: formatEther(balance) }));
} catch (e) { console.log(JSON.stringify({ ok: false, errors: [String(e.shortMessage || e.message || e).slice(0, 400)] })); }
"""


@dataclass
class Chain:
    """What a turn's chain tools need: which chain, and the project's
    deployer. Built by the route, never by the model."""
    key: str
    deployer_key: str
    deployer_address: str

    @property
    def spec(self) -> dict:
        return CHAINS[self.key]


def is_address(value: str) -> bool:
    return bool(_ADDRESS.match(value or ""))


def valid_name(value: str) -> bool:
    return bool(_NAME.match(value or ""))


def generate_deployer() -> tuple[str, str]:
    """A fresh private key and its address."""
    acct = Account.create()
    key = acct.key.hex()
    return (key if key.startswith("0x") else "0x" + key), acct.address


def env_for(spec: dict, deployer_address: str | None) -> dict[str, str]:
    """The app's .env for the chain: public values only."""
    env = {
        "VITE_CHAIN": spec["key"], "VITE_CHAIN_ID": str(spec["chain_id"]),
        "VITE_CHAIN_NAME": spec["name"], "VITE_CHAIN_SYMBOL": spec["symbol"],
        "VITE_CHAIN_RPC": spec["rpc"], "VITE_CHAIN_WS": spec["ws"],
        "VITE_CHAIN_EXPLORER": spec["explorer"], "VITE_CHAIN_FAUCET": spec["faucet"],
    }
    if deployer_address:
        env["VITE_DEPLOYER_ADDRESS"] = deployer_address
    return env


def explorer_link(spec: dict, kind: str, value: str) -> str:
    return f"{spec['explorer']}/{kind}/{value}"


async def fund(spec: dict, address: str) -> dict:
    """Ask the devnet faucet for tokens. Returns {amount, tx} or raises
    ValueError with the faucet's reason."""
    try:
        r = await http.client().post(f"{spec['faucet']}/faucet", json={"address": address},
                                     timeout=settings.SUPABASE_API_TIMEOUT)
    except httpx.HTTPError as e:
        raise ValueError(f"could not reach the faucet: {e.__class__.__name__}")
    try:
        body = r.json()
    except ValueError:
        body = {}
    if r.status_code >= 400 or "error" in body:
        raise ValueError(str(body.get("error") or f"faucet answered {r.status_code}")[:200])
    return {"amount": body.get("amount_kash"), "tx": body.get("tx_hash")}


async def verify(spec: dict, address: str, name: str, source: str) -> str | None:
    """Best-effort source verification on the explorer. Returns a note
    for the model or None when the explorer would not take it."""
    try:
        r = await http.client().post(
            f"{spec['explorer_api']}/api/v2/smart-contracts/{address}/verification/via/flattened-code",
            json={"compiler_version": spec["solc_long"], "license_type": "mit", "source_code": source,
                  "is_optimization_enabled": True, "optimization_runs": 200, "contract_name": name,
                  "evm_version": spec["evm_version"], "autodetect_constructor_args": True},
            timeout=settings.SUPABASE_API_TIMEOUT)
    except httpx.HTTPError:
        return None
    if r.status_code < 300:
        return "Source verification submitted to the explorer."
    return None


def deploy_command(spec: dict, file: str, name: str, args_json: str) -> str:
    """The shell line that runs the deploy script with the chain's values;
    the key is read from KEY_FILE, never from the command line."""
    env = (f"CHAIN_ID={spec['chain_id']} CHAIN_NAME={json.dumps(spec['name'])} "
           f"CHAIN_SYMBOL={spec['symbol']} CHAIN_RPC={spec['rpc']} "
           f"EVM_VERSION={spec['evm_version']} KEY_FILE={KEY_FILE}")
    return f"{env} node {SCRIPT_PATH} {file} {name} {json.dumps(args_json)}"
