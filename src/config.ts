type NodeTLCVConfig = {
  url: string;
  ports: Array<number>;
};

export const config: NodeTLCVConfig = {
  url: 'GrahamCCRL.dyndns.org',
  ports: [16061, 16062, 16063, 16065, 16068, 16091, 16092, 16093, 16094],
};
