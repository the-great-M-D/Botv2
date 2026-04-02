import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useGetBotStatus, useRequestPairingCode, getGetBotStatusQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Terminal, Copy, Smartphone, Server, Clock, ShieldCheck, Loader2, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useBotEvents } from "@/context/bot-events-context";

const pairFormSchema = z.object({
  phoneNumber: z.string().min(8, "Phone number is too short").max(20, "Phone number is too long"),
});

export function Home() {
  const queryClient = useQueryClient();
  const { data: status, isLoading: isStatusLoading } = useGetBotStatus({ query: { refetchInterval: 5000 } });
  const pairCodeMutation = useRequestPairingCode();
  const { events, sseConnected } = useBotEvents();

  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastEventIdRef = useRef<string | null>(null);

  const form = useForm<z.infer<typeof pairFormSchema>>({
    resolver: zodResolver(pairFormSchema),
    defaultValues: { phoneNumber: "" },
  });

  // React to new events from the global SSE context
  useEffect(() => {
    if (events.length === 0) return;
    const last = events[events.length - 1];
    if (last.id === lastEventIdRef.current) return;
    lastEventIdRef.current = last.id;

    if (last.type === "pairing_code" && last.data?.code) {
      setPairingCode(last.data.code);
    } else if (last.type === "status") {
      queryClient.invalidateQueries({ queryKey: getGetBotStatusQueryKey() });
      if (last.data?.state === "connected") {
        setPairingCode(null);
        toast.success("Bot connected successfully!");
      }
    }
  }, [events, queryClient]);

  // Auto-scroll the terminal when new events arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  function onSubmit(values: z.infer<typeof pairFormSchema>) {
    pairCodeMutation.mutate(
      { data: { phoneNumber: values.phoneNumber } },
      {
        onSuccess: (res) => {
          setPairingCode(res.code);
          toast.success("Pairing code generated");
          queryClient.invalidateQueries({ queryKey: getGetBotStatusQueryKey() });
        },
        onError: (err) => {
          toast.error("Failed to generate pairing code");
          console.error(err);
        },
      }
    );
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const formatCode = (code: string) => {
    if (code.length === 8) return `${code.slice(0, 4)}-${code.slice(4)}`;
    return code;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-mono font-bold tracking-tight mb-2">Ops Console</h1>
          <p className="text-muted-foreground font-mono text-sm">Real-time WhatsApp connection management.</p>
        </div>

        <Badge
          variant="outline"
          className="font-mono text-sm px-3 py-1 flex items-center gap-2 border-border bg-card"
        >
          {isStatusLoading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <div className={`w-2 h-2 rounded-full ${
              status?.state === "connected" ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" :
              status?.state === "connecting" || status?.state === "awaiting_pairing" ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" :
              "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]"
            }`} />
          )}
          {status?.state ? status.state.replace("_", " ").toUpperCase() : "UNKNOWN"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Connection Panel */}
        <Card className="md:col-span-1 border-border bg-card shadow-sm">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="font-mono flex items-center gap-2 text-lg">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Device Pairing
            </CardTitle>
            <CardDescription className="font-mono text-xs">
              Connect bot via phone number
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {status?.state === "connected" ? (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex flex-col items-center justify-center text-center space-y-2">
                  <ShieldCheck className="w-8 h-8" />
                  <p className="font-mono font-medium">Device Connected</p>
                </div>

                <div className="space-y-3 font-mono text-sm">
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-muted-foreground flex items-center gap-2"><Smartphone className="w-4 h-4" /> Phone</span>
                    <span className="font-medium">{status.phoneNumber || "Unknown"}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-muted-foreground flex items-center gap-2"><Server className="w-4 h-4" /> Device</span>
                    <span className="font-medium">{status.deviceName || status.platform || "Unknown"}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-muted-foreground flex items-center gap-2"><Clock className="w-4 h-4" /> Connected At</span>
                    <span className="font-medium">{status.connectedAt ? new Date(status.connectedAt).toLocaleTimeString() : "-"}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="phoneNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Phone Number</FormLabel>
                          <FormControl>
                            <Input placeholder="15551234567" className="font-mono bg-background" {...field} disabled={pairCodeMutation.isPending} />
                          </FormControl>
                          <FormMessage className="font-mono text-xs" />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full font-mono font-bold" disabled={pairCodeMutation.isPending || !!pairingCode}>
                      {pairCodeMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      GET PAIRING CODE
                    </Button>
                  </form>
                </Form>

                {pairingCode && (
                  <div className="pt-4 border-t border-border animate-in fade-in slide-in-from-bottom-4">
                    <p className="text-xs font-mono text-muted-foreground uppercase text-center mb-3">Enter code on WhatsApp</p>
                    <div className="relative group">
                      <div className="absolute -inset-0.5 bg-primary/20 blur rounded-lg opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                      <div className="relative flex items-center justify-between bg-background border border-primary/50 rounded-lg p-4">
                        <span className="font-mono text-3xl font-black tracking-widest text-primary select-all">
                          {formatCode(pairingCode)}
                        </span>
                        <Button variant="ghost" size="icon" onClick={() => copyToClipboard(pairingCode)} className="text-muted-foreground hover:text-primary">
                          <Copy className="w-5 h-5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Live Event Stream */}
        <Card className="md:col-span-2 border-border bg-[#0a0a0a] shadow-inner overflow-hidden flex flex-col h-[500px]">
          <div className="h-12 border-b border-border/50 bg-black/40 flex items-center px-4 justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-muted-foreground" />
              <span className="font-mono text-xs font-semibold text-muted-foreground uppercase tracking-widest">Event Stream</span>
            </div>
            <div className="flex items-center gap-2">
              {sseConnected ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="font-mono text-[10px] text-emerald-500 uppercase tracking-widest">Live</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-rose-500" />
                  <span className="font-mono text-[10px] text-rose-500 uppercase tracking-widest">Reconnecting…</span>
                </>
              )}
            </div>
          </div>

          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs leading-relaxed"
          >
            {events.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground/50 italic">
                Waiting for events...
              </div>
            ) : (
              events.map((log) => (
                <div key={log.id} className="flex items-start gap-3 group animate-in fade-in slide-in-from-left-2">
                  <span className="text-muted-foreground/50 shrink-0 select-none">
                    [{new Date(log.timestamp).toLocaleTimeString()}]
                  </span>

                  {log.type === "message" && (
                    <div className="flex-1 text-zinc-300">
                      <span className={log.data.direction === "inbound" ? "text-blue-400" : "text-emerald-400"}>
                        {log.data.direction === "inbound" ? "RCV " : "SND "}
                      </span>
                      <span className="text-muted-foreground mr-2">{log.data.remoteJid?.split("@")[0]}</span>
                      {log.data.content}
                    </div>
                  )}

                  {log.type === "status" && (
                    <div className="flex-1 text-amber-400">
                      SYS  <span className="text-amber-400/70">Status changed to:</span> {log.data.state}
                    </div>
                  )}

                  {log.type === "connected" && (
                    <div className="flex-1 text-primary font-bold">
                      SYS  <span className="text-primary/70">SSE stream connected</span>
                    </div>
                  )}

                  {log.type === "pairing_code" && (
                    <div className="flex-1 text-purple-400">
                      SYS  <span className="text-purple-400/70">Pairing code generated:</span> {log.data.code}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
