import { createPublicClient, http, getAddress } from 'viem';
import { redis, send, readBody, createSession, ensureUser, method } from '../_lib.js';

// Robinhood Chain mainnet. Used to check smart wallet (EIP-1271) signatures.
export const robinhood = {
  id: 4663,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.mainnet.chain.robinhood.com'] } },
};

const chain = createPublicClient({ chain: robinhood, transport: http() });

// Sign in with a wallet: the message holds a server nonce, the signature proves
// the address. Nothing is sent on chain and no gas is spent.
export default async function handler(req, res) {
  if (!method(req, res, 'POST')) return;
  let body;
  try {
    body = await readBody(req);
  } catch {
    return send(res, 400, { error: 'bad body' });
  }
  const { message, signature } = body;
  if (typeof message !== 'string' || message.length > 1000 || typeof signature !== 'string') {
    return send(res, 400, { error: 'bad request' });
  }
  const addrMatch = message.match(/\n(0x[0-9a-fA-F]{40})\n/);
  const nonceMatch = message.match(/\nNonce: ([A-Za-z0-9]{8,32})\n?/);
  if (!addrMatch || !nonceMatch || !message.startsWith('The Last Seat')) {
    return send(res, 400, { error: 'bad message' });
  }
  // nonce is single use
  const used = await redis().del(`nonce:${nonceMatch[1]}`);
  if (!used) return send(res, 401, { error: 'nonce expired, try again' });

  const address = getAddress(addrMatch[1]);
  let ok = false;
  try {
    ok = await chain.verifyMessage({ address, message, signature });
  } catch {
    ok = false;
  }
  if (!ok) return send(res, 401, { error: 'signature does not match' });

  const userId = `wallet:${address.toLowerCase()}`;
  const short = `${address.slice(0, 6)}..${address.slice(-4)}`;
  const user = await ensureUser(userId, { name: short, kind: 'wallet', label: short });
  const session = await createSession(userId);
  send(res, 200, { session, user: { id: userId, name: user.name, char: user.char || null, label: user.label } });
}
