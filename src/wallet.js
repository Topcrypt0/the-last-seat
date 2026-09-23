import { api } from './runs.js';

const RH = {
  chainId: '0x1237', // 4663
  chainName: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://rpc.mainnet.chain.robinhood.com'],
  blockExplorerUrls: ['https://robinhoodchain.blockscout.com'],
};

export function hasWallet() {
  return typeof window !== 'undefined' && !!window.ethereum;
}

function toHex(s) {
  return '0x' + Array.from(new TextEncoder().encode(s), (b) => b.toString(16).padStart(2, '0')).join('');
}

// Connect, move to Robinhood Chain if the wallet allows it, and sign one plain message.
// No transaction is ever requested.
export async function walletSignIn() {
  const eth = window.ethereum;
  if (!eth) throw new Error('No wallet found. Open this page in your wallet app browser.');
  const [address] = await eth.request({ method: 'eth_requestAccounts' });
  if (!address) throw new Error('No account shared.');
  try {
    await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: RH.chainId }] });
  } catch (e) {
    if (e && (e.code === 4902 || String(e.message).includes('Unrecognized'))) {
      try {
        await eth.request({ method: 'wallet_addEthereumChain', params: [RH] });
      } catch {}
    }
  }
  const { nonce } = await api('/api/auth/nonce', { method: 'POST' });
  const message = [
    'The Last Seat wants you to sign in with your Ethereum account:',
    address,
    '',
    'Sign in to record your score on the leaderboard. This is not a transaction and costs no gas.',
    '',
    `URI: ${location.origin}`,
    'Chain ID: 4663',
    `Nonce: ${nonce}`,
    `Issued At: ${new Date().toISOString()}`,
  ].join('\n');
  const signature = await eth.request({ method: 'personal_sign', params: [toHex(message), address] });
  return api('/api/auth/wallet', { method: 'POST', body: { message, signature } });
}
