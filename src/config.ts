type NodeTLCVConfig = {
  url: string;
  ports: Array<number>;
};

export const config: NodeTLCVConfig = {
  url: 'GrahamCCRL.dyndns.org',
  ports: [16001, 16002, 16053, 16063, 16065, 16066, 16083, 16084, 16091, 16092, 16093],
};
