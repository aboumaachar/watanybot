export {};

declare global {
  interface Window {
    electronAPI: {
      gatewayFetch: (
        method: string,
        path: string,
        body?: string
      ) => Promise<{ status: number; data: any }>;
      getVersion: () => Promise<string>;
      getGatewayUrl: () => Promise<string>;
      selectFolder: () => Promise<string | null>;
    };
  }
}
