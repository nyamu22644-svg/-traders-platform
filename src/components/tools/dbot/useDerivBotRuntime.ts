import React from 'react';

export interface DerivBotProposalRequest {
  symbol: string;
  currency: string;
  amount: number;
  duration: number;
  durationUnit: string;
  contractType: string;
}

export interface DerivBotRuntimeTransaction {
  id: string;
  action: string;
  amount: number | null;
  profit: number | null;
  currency: string;
  symbol: string;
  timestamp: number;
}

export interface DerivBotRuntimeBalance {
  amount: number | null;
  currency: string;
}

export interface DerivBotRuntimePosition {
  id: string;
  symbol: string;
  contractType: string;
  buyPrice: number | null;
  payout: number | null;
}

interface UseDerivBotRuntimeOptions {
  accessToken?: string;
  accountId?: string;
}

type PendingResolver = {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
};

const WS_CLOSING_STATES = new Set<number>([WebSocket.CLOSING, WebSocket.CLOSED]);

function normalizeRuntimeError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error === 'string' && error.trim()) return error.trim();
  return fallback;
}

export function useDerivBotRuntime(options: UseDerivBotRuntimeOptions) {
  const { accessToken, accountId } = options;

  const wsRef = React.useRef<WebSocket | null>(null);
  const wsAccountIdRef = React.useRef<string | null>(null);
  const requestIdRef = React.useRef(1);
  const pendingRef = React.useRef(new Map<number, PendingResolver>());
  const transactionSubscribedRef = React.useRef(false);
  const balanceSubscribedRef = React.useRef(false);
  const portfolioSubscribedRef = React.useRef(false);

  const [connectionState, setConnectionState] = React.useState<'idle' | 'connecting' | 'open' | 'error'>('idle');
  const [isRunning, setIsRunning] = React.useState(false);
  const [runtimeError, setRuntimeError] = React.useState<string | null>(null);
  const [lastProposal, setLastProposal] = React.useState<any | null>(null);
  const [activeContract, setActiveContract] = React.useState<any | null>(null);
  const [transactions, setTransactions] = React.useState<DerivBotRuntimeTransaction[]>([]);
  const [balance, setBalance] = React.useState<DerivBotRuntimeBalance | null>(null);
  const [portfolio, setPortfolio] = React.useState<DerivBotRuntimePosition[]>([]);

  const disposeSocket = React.useCallback(() => {
    const ws = wsRef.current;
    if (ws && !WS_CLOSING_STATES.has(ws.readyState)) {
      ws.close();
    }
    wsRef.current = null;
    wsAccountIdRef.current = null;
    transactionSubscribedRef.current = false;
    balanceSubscribedRef.current = false;
    portfolioSubscribedRef.current = false;
    pendingRef.current.forEach(({ reject }) => reject(new Error('Runtime connection closed.')));
    pendingRef.current.clear();
  }, []);

  React.useEffect(() => () => disposeSocket(), [disposeSocket]);

  const ensureSocket = React.useCallback(async () => {
    if (!accessToken) throw new Error('Deriv access token is missing.');
    if (!accountId) throw new Error('Deriv account ID is missing.');

    if (
      wsRef.current &&
      wsRef.current.readyState === WebSocket.OPEN &&
      wsAccountIdRef.current === accountId
    ) {
      return wsRef.current;
    }

    disposeSocket();
    setConnectionState('connecting');
    setRuntimeError(null);

    const response = await fetch('/api/deriv/options-websocket-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken, accountId }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(String(payload?.error || 'Failed to create Deriv runtime connection.'));
    }

    const url = String(payload?.url || '').trim();
    if (!url) {
      throw new Error('Deriv runtime connection did not return a WebSocket URL.');
    }

    const ws = await new Promise<WebSocket>((resolve, reject) => {
      const socket = new WebSocket(url);

      socket.addEventListener('open', () => resolve(socket), { once: true });
      socket.addEventListener('error', () => reject(new Error('Failed to open Deriv runtime WebSocket.')), { once: true });
    });

    wsRef.current = ws;
    wsAccountIdRef.current = accountId;
    setConnectionState('open');

    ws.addEventListener('message', event => {
      const payload = JSON.parse(String(event.data || '{}'));
      const requestId = typeof payload?.req_id === 'number' ? payload.req_id : null;

      if (payload?.error) {
        const message = String(payload.error?.message || 'Deriv runtime request failed.');
        if (requestId !== null) {
          const pending = pendingRef.current.get(requestId);
          if (pending) {
            pendingRef.current.delete(requestId);
            pending.reject(new Error(message));
          }
        } else {
          setRuntimeError(message);
          setConnectionState('error');
        }
        return;
      }

      if (requestId !== null) {
        const pending = pendingRef.current.get(requestId);
        if (pending) {
          pendingRef.current.delete(requestId);
          pending.resolve(payload);
        }
      }

      const messageType = String(payload?.msg_type || '').trim();
      if (messageType === 'proposal') {
        setLastProposal(payload?.proposal || null);
      }

      if (messageType === 'proposal_open_contract') {
        setActiveContract(payload?.proposal_open_contract || null);
      }

      if (messageType === 'transaction') {
        const transaction = payload?.transaction;
        if (transaction) {
          setTransactions(current => [
            {
              id: String(transaction.transaction_id || transaction.id || Date.now()),
              action: String(transaction.action_type || transaction.action || 'transaction'),
              amount: typeof transaction.amount === 'number' ? transaction.amount : null,
              profit: typeof transaction.profit === 'number' ? transaction.profit : null,
              currency: String(transaction.currency || ''),
              symbol: String(transaction.symbol || ''),
              timestamp: Number(transaction.transaction_time || Date.now()),
            },
            ...current,
          ].slice(0, 25));
        }
      }

      if (messageType === 'balance') {
        const balancePayload = payload?.balance || {};
        setBalance({
          amount: typeof balancePayload.balance === 'number' ? balancePayload.balance : null,
          currency: String(balancePayload.currency || ''),
        });
      }

      if (messageType === 'portfolio') {
        const contracts = Array.isArray(payload?.portfolio?.contracts) ? payload.portfolio.contracts : [];
        setPortfolio(
          contracts.map((contract: any) => ({
            id: String(contract.contract_id || contract.id || ''),
            symbol: String(contract.underlying || contract.symbol || ''),
            contractType: String(contract.contract_type || ''),
            buyPrice: typeof contract.buy_price === 'number' ? contract.buy_price : null,
            payout: typeof contract.payout === 'number' ? contract.payout : null,
          }))
        );
      }
    });

    ws.addEventListener('close', () => {
      setConnectionState('idle');
      setIsRunning(false);
      wsRef.current = null;
      wsAccountIdRef.current = null;
      transactionSubscribedRef.current = false;
      balanceSubscribedRef.current = false;
      portfolioSubscribedRef.current = false;
    });

    ws.addEventListener('error', () => {
      setConnectionState('error');
      setRuntimeError('Deriv runtime connection encountered an error.');
    });

    return ws;
  }, [accessToken, accountId, disposeSocket]);

  const sendRequest = React.useCallback(async (payload: Record<string, unknown>) => {
    const ws = await ensureSocket();
    const requestId = requestIdRef.current++;

    const promise = new Promise<any>((resolve, reject) => {
      pendingRef.current.set(requestId, { resolve, reject });
    });

    ws.send(JSON.stringify({ ...payload, req_id: requestId }));
    return promise;
  }, [ensureSocket]);

  const runOnce = React.useCallback(async (request: DerivBotProposalRequest) => {
    setRuntimeError(null);
    setIsRunning(true);

    try {
      if (!transactionSubscribedRef.current) {
        await sendRequest({ transaction: 1, subscribe: 1 });
        transactionSubscribedRef.current = true;
      }

      if (!balanceSubscribedRef.current) {
        await sendRequest({ balance: 1, subscribe: 1 });
        balanceSubscribedRef.current = true;
      }

      if (!portfolioSubscribedRef.current) {
        await sendRequest({ portfolio: 1 });
        portfolioSubscribedRef.current = true;
      }

      const proposalPayload = await sendRequest({
        proposal: 1,
        amount: request.amount,
        basis: 'stake',
        contract_type: request.contractType,
        currency: request.currency,
        duration: request.duration,
        duration_unit: request.durationUnit,
        underlying_symbol: request.symbol,
      });

      const proposalId = String(proposalPayload?.proposal?.id || '').trim();
      if (!proposalId) {
        throw new Error('Proposal response did not include an id.');
      }

      setLastProposal(proposalPayload.proposal || null);

      const buyPayload = await sendRequest({
        buy: proposalId,
        price: request.amount,
      });

      const contractId = String(
        buyPayload?.buy?.contract_id ||
        buyPayload?.buy?.transaction_id ||
        ''
      ).trim();

      if (contractId) {
        await sendRequest({
          proposal_open_contract: 1,
          contract_id: contractId,
          subscribe: 1,
        });
      }
    } catch (error) {
      setRuntimeError(normalizeRuntimeError(error, 'Failed to run the bot.'));
      throw error;
    } finally {
      setIsRunning(false);
    }
  }, [sendRequest]);

  const sellOpenContract = React.useCallback(async (contractId: string | number, price = 0) => {
    setRuntimeError(null);

    const numericContractId = Number(contractId);
    if (!Number.isFinite(numericContractId) || numericContractId <= 0) {
      throw new Error('Valid contract_id is required to sell the contract.');
    }

    const response = await sendRequest({
      sell: numericContractId,
      price: Math.max(0, price),
    });

    return response?.sell || null;
  }, [sendRequest]);

  return {
    connectionState,
    isRunning,
    runtimeError,
    lastProposal,
    activeContract,
    transactions,
    balance,
    portfolio,
    connect: ensureSocket,
    runOnce,
    sellOpenContract,
    disconnect: disposeSocket,
  };
}
