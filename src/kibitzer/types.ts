import type { AnalysisInfo } from './uci-parser.js';

export type { AnalysisInfo };

export interface KibitzerTransport {
  readonly ready: boolean;
  create(): void;
  teardown(): void;
  startAnalysis(fen: string): void;
  stopAnalysis(): void;
  onAnalysis(callback: (info: AnalysisInfo) => void): void;
  name(): string;
}

export type LocalKibitzerConfig = {
  id: string;
  type: 'local';
  priority: number;
  enginePath?: string;
  threads?: number;
  hash?: number;
};

export type SshKibitzerConfig = {
  id: string;
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
