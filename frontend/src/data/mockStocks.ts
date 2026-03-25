/** Placeholder until a market API is wired in Python. */
export type MockStock = {
  symbol: string
  name: string
  close: number
  changePct: number
}

export const MOCK_TOP_STOCKS: MockStock[] = [
  { symbol: "NVDA", name: "NVIDIA Corp.", close: 140.22, changePct: 1.42  },
  { symbol: "MSFT", name: "Microsoft Corp.", close: 428.91, changePct: -0.31 },
  { symbol: "AAPL", name: "Apple Inc.", close: 243.28, changePct: 0.58 },
  { symbol: "AVGO", name: "Broadcom Inc.", close: 251.33, changePct: 0.95 },
  { symbol: "AMD", name: "Advanced Micro Devices", close: 167.44, changePct: -1.12 },
]
