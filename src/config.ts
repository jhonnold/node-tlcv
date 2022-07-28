type NodeTLCVConfig = {
  url: string;
  ports: Array<number>;
};

export const config: NodeTLCVConfig = {
  url: 'GrahamCCRL.dyndns.org',
  ports: [16063, 16064, 16065, 16066, 16091, 16092, 16093, 16094],
};
