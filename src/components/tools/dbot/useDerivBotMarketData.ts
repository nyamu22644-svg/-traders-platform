import React from 'react';

export interface DerivBotSymbol {
  symbol: string;
  name: string;
  market: string;
  submarket: string;
  pipSize: number;
  exchangeOpen: boolean;
  isTradingSuspended: boolean;
}

export interface DerivBotTick {
  epoch: number;
  quote: number;
}

type ConnectionState = 'connecting' | 'open' | 'closed' | 'error';

const PUBLIC_WS_URL = 'wss://api.derivws.com/trading/v1/options/ws/public';
const DEFAULT_SYMBOL = '1HZ100V';
const MAX_TICKS = 40;

interface ActiveSymbolsResponse {
  msg_type?: string;
  active_symbols?: Array<{
    underlying_symbol?: string;
    underlying_symbol_name?: string;
    market?: string;
    submarket?: string;
    pip_size?: number;
    exchange_is_open?: 0 | 1;
    is_trading_suspended?: boolean;
  }>;
}

interface TickResponse {
  msg_type?: string;
  tick?: {
    epoch?: number;
    quote?: number;
    symbol?: string;
    id?: string;
  };
  subscription?: {
    id?: string;
  };
}

interface TimeResponse {
  msg_type?: string;
  time?: number;
}

export function useDerivBotMarketData() {
  const [connectionState, setConnectionState] = React.useState<ConnectionState>('connecting');
  const [lastError, setLastError] = React.useState<string | null>(null);
  const [symbols, setSymbols] = React.useState<DerivBotSymbol[]>([]);
  const [selectedSymbol, setSelectedSymbol] = React.useState(DEFAULT_SYMBOL);
  const [ticks, setTicks] = React.useState<DerivBotTick[]>([]);
  const [serverTime, setServerTime] = React.useState<Date | null>(null);

  const wsRef = React.useRef<WebSocket | null>(null);
  const activeTickSubscriptionIdRef = React.useRef<string | null>(null);
  const serverTimeOffsetMsRef = React.useRef<number | null>(null);
  const selectedSymbolRef = React.useRef(DEFAULT_SYMBOL);

  React.useEffect(() => {
    selectedSymbolRef.current = selectedSymbol;
  }, [selectedSymbol]);

  React.useEffect(() => {
    let isMounted = true;
    const ws = new WebSocket(PUBLIC_WS_URL);
    wsRef.current = ws;

    const tickTimerId = window.setInterval(() => {
      if (serverTimeOffsetMsRef.current === null || !isMounted) return;
      setServerTime(new Date(Date.now() + serverTimeOffsetMsRef.current));
    }, 1000);

    ws.onopen = () => {
      if (!isMounted) return;

      setConnectionState('open');
      setLastError(null);
      ws.send(JSON.stringify({ active_symbols: 'brief' }));
      ws.send(JSON.stringify({ time: 1 }));
      ws.send(JSON.stringify({ ticks: DEFAULT_SYMBOL, subscribe: 1, req_id: 1 }));
    };

    ws.onmessage = event => {
      if (!isMounted) return;

      const payload = JSON.parse(event.data) as ActiveSymbolsResponse | TickResponse | TimeResponse;

      if ((payload as { error?: { message?: string } }).error?.message) {
        setLastError((payload as { error?: { message?: string } }).error?.message || 'Deriv market feed error.');
        setConnectionState('error');
        return;
      }

      if (payload.msg_type === 'active_symbols' && 'active_symbols' in payload && Array.isArray(payload.active_symbols)) {
        const { active_symbols } = payload as ActiveSymbolsResponse;
        const nextSymbols = active_symbols
          .map(symbol => {
            const underlyingSymbol = String(symbol.underlying_symbol || '').trim();
            if (!underlyingSymbol) return null;

            return {
              symbol: underlyingSymbol,
              name: String(symbol.underlying_symbol_name || underlyingSymbol).trim() || underlyingSymbol,
              market: String(symbol.market || '').trim(),
              submarket: String(symbol.submarket || '').trim(),
              pipSize: typeof symbol.pip_size === 'number' ? symbol.pip_size : 0.001,
              exchangeOpen: Boolean(symbol.exchange_is_open),
              isTradingSuspended: Boolean(symbol.is_trading_suspended),
            } satisfies DerivBotSymbol;
          })
          .filter((symbol): symbol is DerivBotSymbol => Boolean(symbol));

        setSymbols(nextSymbols);
        return;
      }

      if (payload.msg_type === 'time' && 'time' in payload && typeof payload.time === 'number') {
        const { time } = payload as TimeResponse;
        if (typeof time !== 'number') return;

        serverTimeOffsetMsRef.current = time * 1000 - Date.now();
        setServerTime(new Date(time * 1000));
        return;
      }

      if (payload.msg_type === 'tick' && 'tick' in payload && payload.tick) {
        const { tick, subscription } = payload as TickResponse;
        if (!tick) return;

        const symbol = String(tick.symbol || selectedSymbolRef.current).trim();
        const quote = typeof tick.quote === 'number' ? tick.quote : null;
        const epoch = typeof tick.epoch === 'number' ? tick.epoch : null;

        if (!quote || !epoch || symbol !== selectedSymbolRef.current) return;

        if (subscription?.id) {
          activeTickSubscriptionIdRef.current = subscription.id;
        }

        setTicks(previous => {
          const next = [...previous, { epoch, quote }];
          return next.slice(-MAX_TICKS);
        });
      }
    };

    ws.onerror = () => {
      if (!isMounted) return;
      setConnectionState('error');
      setLastError('Unable to connect to Deriv public market data.');
    };

    ws.onclose = () => {
      if (!isMounted) return;
      setConnectionState('closed');
    };

    return () => {
      isMounted = false;
      window.clearInterval(tickTimerId);
      ws.close();
      wsRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    if (activeTickSubscriptionIdRef.current) {
      ws.send(JSON.stringify({ forget: activeTickSubscriptionIdRef.current }));
      activeTickSubscriptionIdRef.current = null;
    }

    setTicks([]);
    ws.send(JSON.stringify({ ticks: selectedSymbol, subscribe: 1, req_id: 1 }));
  }, [selectedSymbol]);

  const latestTick = ticks[ticks.length - 1] || null;

  return {
    connectionState,
    lastError,
    latestTick,
    selectedSymbol,
    serverTime,
    setSelectedSymbol,
    symbols,
    ticks,
  };
}
