export interface BarState {
  isfirst: boolean;
  islast: boolean;
  ishistory: boolean;
  isrealtime: boolean;
  isconfirmed: boolean;
  islastconfirmedhistory: boolean;
}

export function createBarstate(barIndex: number, lastIndex: number): BarState {
  return {
    isfirst: barIndex === 0,
    islast: barIndex === lastIndex,
    ishistory: true,
    isrealtime: false,
    isconfirmed: true,
    islastconfirmedhistory: barIndex === lastIndex,
  };
}

export function makeBarstateProxy(state: BarState): BarState {
  return state;
}
