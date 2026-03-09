import type { AnalysisInfo } from './uci-parser.js';

export type { AnalysisInfo };

export interface KibitzerTransport {
  start(): void;
  stop(): void;
  analyze(fen: string): void;
  onAnalysis(callback: (info: AnalysisInfo) => void): void;
}
