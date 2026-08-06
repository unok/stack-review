export interface WorkspaceCreateResult {
  workspaceId: string;
  tabId: string;
  paneId: string;
}

export interface TabCreateResult {
  tabId: string;
  paneId: string;
}

export interface ReviewLayerEnvironment {
  layerNumber: number;
  layerName: string;
  tabId: string;
  paneId: string;
  sessionId: string;
  descriptionTabId: string;
  descriptionPaneId: string;
  descriptionSessionId: string;
}

export interface ReviewEnvironment {
  workspaceId: string;
  controlTabId: string;
  controlPaneId: string;
  layers: ReviewLayerEnvironment[];
}

export interface SessionDiscoveryTimer {
  sleep: (delayMs: number) => Promise<void>;
}

export interface ReviewEnvironmentOptions {
  sessionDiscoveryIntervalMs?: number;
  sessionDiscoveryTimeoutMs?: number;
  timer?: SessionDiscoveryTimer;
}
