import {
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from "@microsoft/signalr";

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(
    /\/$/,
    "",
  ) ?? "http://localhost:5436";

const SESSION_KEY = "bike_tracking_auth_session";

export type RealtimeConnectionState =
  | "connected"
  | "reconnecting"
  | "disconnected";

export interface ImportProgressRealtimeNotification {
  riderId: number;
  importJobId: number;
  status: string;
  percentComplete: number;
  etaMinutesRounded?: number | null;
  processedRows: number;
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  failedRows: number;
  emittedAtUtc: string;
}

export interface ImportProgressRealtimeHandlers {
  onProgress: (notification: ImportProgressRealtimeNotification) => void;
  onConnectionStateChanged: (state: RealtimeConnectionState) => void;
}

export interface ImportProgressRealtimeSubscription {
  stop: () => Promise<void>;
}

function getUserIdHeader(): string | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as { userId?: number };
    if (typeof parsed.userId === "number" && parsed.userId > 0) {
      return parsed.userId.toString();
    }
  } catch {
    // Ignore malformed auth session values.
  }

  return null;
}

export async function subscribeToImportProgress(
  importJobId: number,
  handlers: ImportProgressRealtimeHandlers,
): Promise<ImportProgressRealtimeSubscription> {
  const userId = getUserIdHeader();
  const tokenQuery = encodeURIComponent(userId ?? "");

  const connection = new HubConnectionBuilder()
    .withUrl(
      `${API_BASE_URL}/hubs/import-progress?access_token=${tokenQuery}`,
      {
        headers: userId ? { "X-User-Id": userId } : {},
        accessTokenFactory: () => userId ?? "",
      },
    )
    .withAutomaticReconnect()
    .configureLogging(LogLevel.Warning)
    .build();

  connection.on(
    "import.progress",
    (payload: ImportProgressRealtimeNotification) => {
      handlers.onProgress(payload);
    },
  );

  connection.onreconnecting(() => {
    handlers.onConnectionStateChanged("reconnecting");
  });

  connection.onreconnected(async () => {
    handlers.onConnectionStateChanged("connected");
    await connection.invoke("SubscribeToImportJob", importJobId);
  });

  connection.onclose(() => {
    handlers.onConnectionStateChanged("disconnected");
  });

  await connection.start();
  handlers.onConnectionStateChanged("connected");
  await connection.invoke("SubscribeToImportJob", importJobId);

  return {
    stop: async () => {
      if (
        connection.state === HubConnectionState.Connected ||
        connection.state === HubConnectionState.Reconnecting
      ) {
        try {
          await connection.invoke("UnsubscribeFromImportJob", importJobId);
        } catch {
          // Unsubscribe can fail during shutdown/reconnect races.
        }
      }

      if (connection.state !== HubConnectionState.Disconnected) {
        await connection.stop();
      }
    },
  };
}
