// Strategy backtesting engine for Pine Script v6

export interface ClosedTrade {
  id: string;
  entryId: string;
  direction: 'long' | 'short';
  entryPrice: number;
  exitPrice: number;
  qty: number;
  profit: number;
  entryBar: number;
  exitBar: number;
  entryTime: number;
  exitTime: number;
}

export interface OpenTrade {
  direction: 'long' | 'short';
  qty: number;
  avgPrice: number;
  entryBar: number;
  entryTime: number;
  entryId: string;
}

export interface StrategyResult {
  trades: ClosedTrade[];
  equityCurve: { time: number; equity: number }[];
  netProfit: number;
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  maxRunup: number;
  initialCapital: number;
  grossProfit: number;
  grossLoss: number;
  equity: number;
  openPnl: number;
  /** The position still open at the last bar, if any. */
  position: OpenTrade | null;
}

interface PendingOrder {
  id: string;
  direction: 'long' | 'short';
  qty: number;
  type: 'market' | 'limit' | 'stop';
  limitPrice?: number;
  stopPrice?: number;
  isEntry: boolean;
  fromEntry?: string;
  profitTicks?: number;
  lossTicks?: number;
}

interface OpenPosition {
  direction: 'long' | 'short';
  qty: number;
  avgPrice: number;
  entryBar: number;
  entryTime: number;
  entryId: string;
}

export interface StrategyEngine {
  entry(id: string, direction: string, qty?: number, limit?: number, stop?: number): void;
  close(id?: string, qty?: number): void;
  exit(id: string, fromEntry?: string, qty?: number, qtyPercent?: number, profit?: number, limit?: number, loss?: number, stop?: number): void;
  order(id: string, direction: string, qty: number, limit?: number, stop?: number): void;
  cancel(id: string): void;
  cancelAll(): void;
  closeAll(): void;
  convertToAccount(value: number): number;
  convertToSymbol(value: number): number;
  defaultEntryQty(value?: number): number;
  /** One field of a closed trade, for `strategy.closedtrades.<field>(n)`. */
  closedTrade(field: string, index: number): unknown;

  // Properties
  position_size: number;
  position_avg_price: number;
  position_entry_name: string;
  equity: number;
  closedtrades: number;
  opentrades: number;
  netprofit: number;
  netprofit_percent: number;
  grossprofit: number;
  grossprofit_percent: number;
  grossloss: number;
  grossloss_percent: number;
  wintrades: number;
  losstrades: number;
  eventrades: number;
  avg_trade: number;
  avg_winning_trade: number;
  avg_losing_trade: number;
  avg_trade_percent: number;
  avg_winning_trade_percent: number;
  avg_losing_trade_percent: number;
  openprofit: number;
  openprofit_percent: number;
  max_drawdown: number;
  max_drawdown_percent: number;
  max_runup: number;
  max_runup_percent: number;
  max_contracts_held_all: number;
  max_contracts_held_long: number;
  max_contracts_held_short: number;
  account_currency: string;
  initial_capital: number;
  margin_liquidation_price: number;

  // Constants
  long: string;
  short: string;
  fixed: string;
  cash: string;
  percent_of_equity: string;
  risk: {
    allow_entry_in(value: string): void;
    max_cons_loss_days(count: number, alertMessage?: string): void;
    max_drawdown(value: number, type: string, alertMessage?: string): void;
    max_intraday_filled_orders(count: number, alertMessage?: string): void;
    max_intraday_loss(value: number, type: string, alertMessage?: string): void;
    max_position_size(contracts: number): void;
  };

  // Internal - called by engine each bar
  processBar(barIndex: number, open: number, high: number, low: number, close: number, time: number): void;
  getResult(): StrategyResult;
}

export function createStrategyEngine(
  initialCapital?: number,
  pointValue: number = 1,
  accountCurrency: string = 'USD',
): StrategyEngine {
  const capital = initialCapital ?? 100000;

  let currentEquity = capital;
  let position: OpenPosition | null = null;
  const pendingOrders: PendingOrder[] = [];
  const closedTrades: ClosedTrade[] = [];
  const equityCurve: { time: number; equity: number }[] = [];

  let grossProfit = 0;
  let grossLoss = 0;
  let winCount = 0;
  let lossCount = 0;
  let evenCount = 0;
  let maxContractsAll = 0;
  let maxContractsLong = 0;
  let maxContractsShort = 0;

  // Running high/low water marks for the Pine drawdown and runup getters.
  let drawdownPeak = capital;
  let drawdownTrough = capital;
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;
  let runupTrough = capital;
  let runupPeak = capital;
  let maxRunup = 0;
  let maxRunupPercent = 0;

  // Current bar data (set by processBar before user code runs)
  let barIndex = 0;
  let barOpen = 0;
  let barHigh = 0;
  let barLow = 0;
  let barClose = 0;
  let barTime = 0;

  // Orders queued during user script execution (applied at NEXT bar)
  let queuedOrders: PendingOrder[] = [];

  function fillOrder(order: PendingOrder, fillPrice: number): void {
    if (order.isEntry) {
      // Close any opposite position first
      if (position && position.direction !== order.direction) {
        closePosition(fillPrice, order.id);
      }

      // Open new position or add to existing
      if (!position) {
        position = {
          direction: order.direction,
          qty: order.qty,
          avgPrice: fillPrice,
          entryBar: barIndex,
          entryTime: barTime,
          entryId: order.id,
        };
      } else if (position.direction === order.direction) {
        // Pyramiding: average in
        const totalQty = position.qty + order.qty;
        position.avgPrice = (position.avgPrice * position.qty + fillPrice * order.qty) / totalQty;
        position.qty = totalQty;
      }
      updateMaxContracts();
    } else {
      // Exit / close order. qty 0 means the whole position.
      if (position) {
        const qtyToClose = order.qty > 0 ? Math.min(order.qty, position.qty) : position.qty;
        closePositionPartial(fillPrice, qtyToClose, order.id);
        // A bracket's stop and limit ride together; the first fill cancels the
        // sibling so it cannot close a later position that reuses the entry id.
        if (order.fromEntry !== undefined) {
          for (let index = pendingOrders.length - 1; index >= 0; index -= 1) {
            const other = pendingOrders[index]!;
            if (!other.isEntry && other.fromEntry === order.fromEntry) pendingOrders.splice(index, 1);
          }
        }
      }
    }
  }

  function closePosition(exitPrice: number, exitId: string): void {
    if (!position) return;
    closePositionPartial(exitPrice, position.qty, exitId);
  }

  function closePositionPartial(exitPrice: number, qty: number, exitId: string): void {
    if (!position) return;

    const qtyToClose = Math.min(qty, position.qty);
    let profit: number;
    if (position.direction === 'long') {
      profit = (exitPrice - position.avgPrice) * qtyToClose;
    } else {
      profit = (position.avgPrice - exitPrice) * qtyToClose;
    }

    closedTrades.push({
      id: exitId,
      entryId: position.entryId,
      direction: position.direction,
      entryPrice: position.avgPrice,
      exitPrice,
      qty: qtyToClose,
      profit,
      entryBar: position.entryBar,
      exitBar: barIndex,
      entryTime: position.entryTime,
      exitTime: barTime,
    });

    if (profit > 0) {
      grossProfit += profit;
      winCount += 1;
    } else if (profit < 0) {
      grossLoss += Math.abs(profit);
      lossCount += 1;
    } else {
      evenCount += 1;
    }

    currentEquity += profit;

    if (qtyToClose >= position.qty) {
      position = null;
    } else {
      position.qty -= qtyToClose;
    }
  }

  function tryFillPending(): void {
    // Process pending orders against current bar's OHLC
    const remaining: PendingOrder[] = [];

    for (const order of pendingOrders) {
      let filled = false;

      // An exit waits for the position it belongs to. A bracket queued before
      // its entry fills must not close an unrelated position.
      if (!order.isEntry) {
        if (!position) {
          if (order.fromEntry !== undefined) remaining.push(order);
          continue;
        }
        if (order.fromEntry !== undefined && position.entryId !== order.fromEntry) continue;
      }

      // An exit trades against the position, whatever direction it was queued with.
      const direction = order.isEntry
        ? order.direction
        : position!.direction === 'long'
          ? 'short'
          : 'long';

      if (order.type === 'market') {
        // Market orders fill at this bar's open
        fillOrder(order, barOpen);
        filled = true;
      } else if (order.type === 'limit') {
        // A limit already through the open is marketable: it fills at the
        // open, never at a price the bar never traded. Otherwise it fills at
        // the limit once the bar reaches it.
        const limitPrice = order.limitPrice!;
        if (direction === 'long' && barLow <= limitPrice) {
          fillOrder(order, Math.min(limitPrice, barOpen));
          filled = true;
        } else if (direction === 'short' && barHigh >= limitPrice) {
          fillOrder(order, Math.max(limitPrice, barOpen));
          filled = true;
        }
      } else if (order.type === 'stop') {
        // Stops gap through: fill at the open when it is already past the stop.
        const stopPrice = order.stopPrice!;
        if (direction === 'long' && barHigh >= stopPrice) {
          fillOrder(order, Math.max(stopPrice, barOpen));
          filled = true;
        } else if (direction === 'short' && barLow <= stopPrice) {
          fillOrder(order, Math.min(stopPrice, barOpen));
          filled = true;
        }
      }

      if (!filled) {
        remaining.push(order);
      }
    }

    pendingOrders.length = 0;
    pendingOrders.push(...remaining);
  }

  function getUnrealizedPnL(): number {
    if (!position) return 0;
    if (position.direction === 'long') {
      return (barClose - position.avgPrice) * position.qty;
    } else {
      return (position.avgPrice - barClose) * position.qty;
    }
  }

  function tradeCostBasis(trade: ClosedTrade): number {
    return Math.abs(trade.qty) * trade.entryPrice * pointValue;
  }

  function tradePercent(trade: ClosedTrade): number {
    const basis = tradeCostBasis(trade);
    return basis !== 0 ? (trade.profit / basis) * 100 : 0;
  }

  function averagePercent(predicate: (trade: ClosedTrade) => boolean): number {
    const selected = closedTrades.filter(predicate);
    if (selected.length === 0) return Number.NaN;
    let sum = 0;
    let count = 0;
    for (const trade of selected) {
      const basis = tradeCostBasis(trade);
      if (basis === 0) continue;
      sum += tradePercent(trade);
      count += 1;
    }
    return count > 0 ? sum / count : Number.NaN;
  }

  /** Update the high/low water marks the Pine drawdown/runup getters report. */
  function updateEquityStats(): void {
    const equity = currentEquity + getUnrealizedPnL();

    if (equity > drawdownPeak) {
      drawdownPeak = equity;
      drawdownTrough = equity;
    }
    if (equity < drawdownTrough) {
      drawdownTrough = equity;
      const drawdown = drawdownPeak - drawdownTrough;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        maxDrawdownPercent = drawdownPeak !== 0 ? (drawdown / Math.abs(drawdownPeak)) * 100 : 0;
      }
    }

    if (equity < runupTrough) {
      runupTrough = equity;
      runupPeak = equity;
    }
    if (equity > runupPeak) {
      runupPeak = equity;
      const runup = runupPeak - runupTrough;
      if (runup > maxRunup) {
        maxRunup = runup;
        maxRunupPercent = runupTrough !== 0 ? (runup / Math.abs(runupTrough)) * 100 : 0;
      }
    }
  }

  function updateMaxContracts(): void {
    const size = position ? (position.direction === 'long' ? position.qty : -position.qty) : 0;
    const absolute = Math.abs(size);
    if (absolute > maxContractsAll) maxContractsAll = absolute;
    if (size > 0) maxContractsLong = Math.max(maxContractsLong, size);
    else if (size < 0) maxContractsShort = Math.max(maxContractsShort, -size);
  }

  const engine: StrategyEngine = {
    entry(id: string, direction: string, qty?: number, limit?: number, stop?: number): void {
      const dir = direction === 'long' ? 'long' : 'short';
      const orderQty = qty ?? 1;

      let orderType: 'market' | 'limit' | 'stop' = 'market';
      if (limit !== undefined) orderType = 'limit';
      else if (stop !== undefined) orderType = 'stop';

      // Remove any existing entry order with same id
      const idx = queuedOrders.findIndex(o => o.id === id && o.isEntry);
      if (idx >= 0) queuedOrders.splice(idx, 1);

      queuedOrders.push({
        id,
        direction: dir,
        qty: orderQty,
        type: orderType,
        limitPrice: limit,
        stopPrice: stop,
        isEntry: true,
      });
    },

    close(id?: string, qty?: number): void {
      if (!position) return;

      // If id is specified, only close if position was entered with that id
      if (id && position.entryId !== id) return;

      queuedOrders.push({
        id: id ?? '__close__',
        direction: position.direction === 'long' ? 'short' : 'long',
        qty: qty ?? position.qty,
        type: 'market',
        isEntry: false,
      });
    },

    exit(id: string, fromEntry?: string, qty?: number, qtyPercent?: number, profit?: number, limit?: number, loss?: number, stop?: number): void {
      if (position && fromEntry && position.entryId !== fromEntry) return;
      if (!position && fromEntry === undefined) return;

      // Calculate limit/stop from profit/loss ticks relative to entry. Before the
      // entry fills only absolute prices make sense; profit/loss wait for it.
      let exitLimit = limit;
      let exitStop = stop;
      if (position && profit !== undefined && exitLimit === undefined) {
        if (position.direction === 'long') {
          exitLimit = position.avgPrice + profit;
        } else {
          exitLimit = position.avgPrice - profit;
        }
      }
      if (position && loss !== undefined && exitStop === undefined) {
        if (position.direction === 'long') {
          exitStop = position.avgPrice - loss;
        } else {
          exitStop = position.avgPrice + loss;
        }
      }

      // qty 0 = the whole position, resolved when the order fills. An exit
      // queued before its entry must not close an unrelated position.
      const resolvedQty = qtyPercent !== undefined
        ? Math.max(1, Math.floor((position?.qty ?? 0) * qtyPercent / 100))
        : (qty ?? 0);
      const direction = position
        ? position.direction === 'long'
          ? 'short'
          : 'long'
        : 'short';

      // Create limit exit if specified
      if (exitLimit !== undefined) {
        queuedOrders.push({
          id,
          direction,
          qty: resolvedQty,
          type: 'limit',
          limitPrice: exitLimit,
          isEntry: false,
          fromEntry,
        });
      }

      // Create stop exit if specified
      if (exitStop !== undefined) {
        queuedOrders.push({
          id,
          direction,
          qty: resolvedQty,
          type: 'stop',
          stopPrice: exitStop,
          isEntry: false,
          fromEntry,
        });
      }

      // If neither limit nor stop, market exit
      if (exitLimit === undefined && exitStop === undefined) {
        queuedOrders.push({
          id,
          direction,
          qty: resolvedQty,
          type: 'market',
          isEntry: false,
          fromEntry,
        });
      }
    },

    order(id: string, direction: string, qty: number, limit?: number, stop?: number): void {
      const dir = direction === 'long' ? 'long' : 'short';
      let orderType: 'market' | 'limit' | 'stop' = 'market';
      if (limit !== undefined) orderType = 'limit';
      else if (stop !== undefined) orderType = 'stop';

      queuedOrders.push({
        id,
        direction: dir,
        qty,
        type: orderType,
        limitPrice: limit,
        stopPrice: stop,
        isEntry: true,
      });
    },

    cancel(id: string): void {
      // Remove pending orders with this id
      for (let i = pendingOrders.length - 1; i >= 0; i--) {
        if (pendingOrders[i].id === id) {
          pendingOrders.splice(i, 1);
        }
      }
      for (let i = queuedOrders.length - 1; i >= 0; i--) {
        if (queuedOrders[i].id === id) {
          queuedOrders.splice(i, 1);
        }
      }
    },

    cancelAll(): void {
      pendingOrders.length = 0;
      queuedOrders.length = 0;
    },

    closeAll(): void {
      if (!position) return;
      queuedOrders.push({
        id: '__close_all__',
        direction: position.direction === 'long' ? 'short' : 'long',
        qty: position.qty,
        type: 'market',
        isEntry: false,
      });
    },

    convertToAccount(value: number): number {
      return value;
    },

    convertToSymbol(value: number): number {
      return value;
    },

    defaultEntryQty(value?: number): number {
      return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 1;
    },

    closedTrade(field: string, index: number): unknown {
      const trade = closedTrades[index];
      if (!trade) return Number.NaN;
      switch (field) {
        case 'profit': return trade.profit;
        case 'profit_percent': {
          const basis = Math.abs(trade.qty) * trade.entryPrice * pointValue;
          return basis !== 0 ? (trade.profit / basis) * 100 : 0;
        }
        case 'commission': return 0;
        case 'size': return trade.qty;
        case 'entry_price': return trade.entryPrice;
        case 'exit_price': return trade.exitPrice;
        case 'entry_bar_index': return trade.entryBar;
        case 'exit_bar_index': return trade.exitBar;
        case 'entry_time': return trade.entryTime;
        case 'exit_time': return trade.exitTime;
        case 'entry_id': return trade.entryId;
        case 'exit_id': return trade.id;
        default: return Number.NaN;
      }
    },

    // Properties
    get position_size(): number {
      if (!position) return 0;
      return position.direction === 'long' ? position.qty : -position.qty;
    },

    get position_avg_price(): number {
      return position?.avgPrice ?? 0;
    },

    get equity(): number {
      return currentEquity + getUnrealizedPnL();
    },

    get closedtrades(): number {
      return closedTrades.length;
    },

    get opentrades(): number {
      return position ? 1 : 0;
    },

    get netprofit(): number {
      return currentEquity - capital;
    },

    get grossprofit(): number {
      return grossProfit;
    },

    get grossloss(): number {
      return grossLoss;
    },

    get netprofit_percent(): number {
      return capital !== 0 ? ((currentEquity - capital) / Math.abs(capital)) * 100 : 0;
    },

    get grossprofit_percent(): number {
      return capital !== 0 ? (grossProfit / Math.abs(capital)) * 100 : 0;
    },

    get grossloss_percent(): number {
      return capital !== 0 ? (grossLoss / Math.abs(capital)) * 100 : 0;
    },

    get wintrades(): number {
      return winCount;
    },

    get losstrades(): number {
      return lossCount;
    },

    get eventrades(): number {
      return evenCount;
    },

    get avg_trade(): number {
      return closedTrades.length > 0 ? (currentEquity - capital) / closedTrades.length : Number.NaN;
    },

    get avg_winning_trade(): number {
      return winCount > 0 ? grossProfit / winCount : Number.NaN;
    },

    get avg_losing_trade(): number {
      return lossCount > 0 ? grossLoss / lossCount : Number.NaN;
    },

    get avg_trade_percent(): number {
      return averagePercent(() => true);
    },

    get avg_winning_trade_percent(): number {
      return averagePercent((trade) => trade.profit > 0);
    },

    get avg_losing_trade_percent(): number {
      return averagePercent((trade) => trade.profit < 0);
    },

    get openprofit(): number {
      return getUnrealizedPnL();
    },

    get openprofit_percent(): number {
      const realized = currentEquity;
      return realized !== 0 ? (getUnrealizedPnL() / Math.abs(realized)) * 100 : 0;
    },

    get max_drawdown(): number {
      return maxDrawdown;
    },

    get max_drawdown_percent(): number {
      return maxDrawdownPercent;
    },

    get max_runup(): number {
      return maxRunup;
    },

    get max_runup_percent(): number {
      return maxRunupPercent;
    },

    get max_contracts_held_all(): number {
      return maxContractsAll;
    },

    get max_contracts_held_long(): number {
      return maxContractsLong;
    },

    get max_contracts_held_short(): number {
      return maxContractsShort;
    },

    get account_currency(): string {
      return accountCurrency;
    },

    get initial_capital(): number {
      return capital;
    },

    get margin_liquidation_price(): number {
      return Number.NaN;
    },

    get position_entry_name(): string {
      return position?.entryId ?? '';
    },

    // Constants
    long: 'long',
    short: 'short',
    fixed: 'fixed',
    cash: 'cash',
    percent_of_equity: 'percent_of_equity',
    risk: {
      allow_entry_in(_value: string): void {
        // Risk rules are not modelled by the engine yet; keep the call valid.
      },
      max_cons_loss_days(_count: number, _alertMessage?: string): void {},
      max_drawdown(_value: number, _type: string, _alertMessage?: string): void {},
      max_intraday_filled_orders(_count: number, _alertMessage?: string): void {},
      max_intraday_loss(_value: number, _type: string, _alertMessage?: string): void {},
      max_position_size(_contracts: number): void {},
    },

    processBar(idx: number, open: number, high: number, low: number, close: number, time: number): void {
      barIndex = idx;
      barOpen = open;
      barHigh = high;
      barLow = low;
      barClose = close;
      barTime = time;

      // Move queued orders from previous bar into pending
      // (Market orders from previous bar fill at this bar's open)
      if (queuedOrders.length > 0) {
        pendingOrders.push(...queuedOrders);
        queuedOrders = [];
      }

      // Try to fill pending orders
      tryFillPending();
      updateMaxContracts();
      updateEquityStats();

      // Record equity curve point
      equityCurve.push({
        time: barTime,
        equity: currentEquity + getUnrealizedPnL(),
      });
    },

    getResult(): StrategyResult {
      const totalTrades = closedTrades.length;
      const wins = closedTrades.filter(t => t.profit > 0).length;
      const winRate = totalTrades > 0 ? wins / totalTrades : 0;

      const totalProfit = closedTrades.filter(t => t.profit > 0).reduce((s, t) => s + t.profit, 0);
      const totalLoss = closedTrades.filter(t => t.profit < 0).reduce((s, t) => s + Math.abs(t.profit), 0);
      const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : (totalProfit > 0 ? Infinity : 0);

      const openPnl = getUnrealizedPnL();
      return {
        trades: closedTrades,
        equityCurve,
        netProfit: currentEquity - capital + openPnl,
        totalTrades,
        winRate,
        profitFactor,
        maxDrawdown,
        maxRunup,
        initialCapital: capital,
        grossProfit,
        grossLoss,
        equity: currentEquity + openPnl,
        openPnl,
        position: position
          ? {
              direction: position.direction,
              qty: position.qty,
              avgPrice: position.avgPrice,
              entryBar: position.entryBar,
              entryTime: position.entryTime,
              entryId: position.entryId,
            }
          : null,
      };
    },
  };

  return engine;
}
