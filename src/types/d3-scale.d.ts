// Minimal ambient declarations for d3-scale, used by @tanstack/charts scales.
// The package ships without its own types; only the factories we pass to
// @tanstack/charts are declared here.
declare module 'd3-scale' {
  interface D3ScaleLike<TValue = unknown> {
    copy(): D3ScaleLike<TValue>;
    range(values: Iterable<number>): D3ScaleLike<TValue>;
    rangeRound(values: Iterable<number>): D3ScaleLike<TValue>;
    domain(...domain: TValue[]): D3ScaleLike<TValue>;
    ticks?(count?: number): TValue[];
    (value: TValue): number;
  }
  export function scaleBand(): D3ScaleLike<string>;
  export function scaleLinear(): D3ScaleLike<number>;
}
