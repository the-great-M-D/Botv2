import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetBotStatusQueryKey,
  getListMessagesQueryKey,
  getGetMessageStatsQueryKey,
  getListContactsQueryKey,
} from "@workspace/api-client-react";

export interface BotEvent {
  id: string;
  timestamp: string;
  type: "connected" | "status" | "message" | "pairing_code";
  data: any;
}

interface BotEventsContextValue {
  events: BotEvent[];
  sseConnected: boolean;
}

const BotEventsContext = createContext<BotEventsContextValue>({
  events: [],
  sseConnected: false,
});

export function BotEventsProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [events, setEvents] = useState<BotEvent[]>([]);
  const [sseConnected, setSseConnected] = useState(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    function addEvent(type: BotEvent["type"], data: any) {
      setEvents((prev) =>
        [
          ...prev,
          { id: crypto.randomUUID(), timestamp: new Date().toISOString(), type, data },
        ].slice(-100)
      );
    }

    function connect() {
      const es = new EventSource("/api/bot/events");
      esRef.current = es;

      // "connected" — server confirms the SSE stream is open
      es.addEventListener("connected", (e) => {
        setSseConnected(true);
        try { addEvent("connected", JSON.parse(e.data)); } catch {}
      });

      // "status" — bot connection state changed (disconnected / connecting / connected)
      es.addEventListener("status", (e) => {
        try {
          const data = JSON.parse(e.data);
          addEvent("status", data);
          queryClient.invalidateQueries({ queryKey: getGetBotStatusQueryKey() });
        } catch {}
      });

      // "message" — new WhatsApp message received or sent
      es.addEventListener("message", (e) => {
        try {
          const data = JSON.parse(e.data);
          addEvent("message", data);
          // Refresh all data that changes when messages arrive
          queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetMessageStatsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListContactsQueryKey() });
        } catch {}
      });

      // "pairing_code" — a new pairing code was generated
      es.addEventListener("pairing_code", (e) => {
        try { addEvent("pairing_code", JSON.parse(e.data)); } catch {}
      });

      es.onerror = () => {
        setSseConnected(false);
        es.close();
        esRef.current = null;
        // Reconnect after 5 s
        retryTimer.current = setTimeout(connect, 5000);
      };
    }

    connect();

    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
      esRef.current?.close();
    };
  }, [queryClient]);

  return (
    <BotEventsContext.Provider value={{ events, sseConnected }}>
      {children}
    </BotEventsContext.Provider>
  );
}

export function useBotEvents() {
  return useContext(BotEventsContext);
}
