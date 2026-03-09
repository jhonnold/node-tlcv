import type { AnalysisInfo } from './uci-parser.js';

export type { AnalysisInfo };

export interface KibitzerTransport {
  start(): void;
  stop(): void;
  analyze(fen: string): void;
  onAnalysis(callback: (info: AnalysisInfo) => void): void;
  name(): string;
}

export type LocalKibitzerConfig = {
  type: 'local';
  priority: number;
  enginePath?: string;
  threads?: number;
  hash?: number;
};

export type SshKibitzerConfig = {
  type: 'ssh';
  priority: number;
  host: string;
  port?: number;
  username: string;
  privateKeyPath: string;
  enginePath: string;
  threads?: number;
  hash?: number;
};

export type KibitzerConfig = LocalKibitzerConfig | SshKibitzerConfig;
