import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useListMessages,
  useGetMessageStats,
  useSendMessage,
  getListMessagesQueryKey,
  getGetMessageStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ArrowDownLeft, ArrowUpRight, Bot, Send, MessageSquare, Users, TrendingUp, Clock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const sendSchema = z.object({
  to: z.string().min(8, "Phone number required"),
  content: z.string().min(1, "Message cannot be empty"),
});

export function Messages() {
  const queryClient = useQueryClient();
  const [direction, setDirection] = useState<"all" | "inbound" | "outbound">("all");

  const { data: messages = [], isLoading } = useListMessages(
    { direction, limit: 100 },
    { query: { refetchInterval: 5000 } }
  );
  const { data: stats } = useGetMessageStats({ query: { refetchInterval: 10000 } });
  const sendMutation = useSendMessage();

  const form = useForm<z.infer<typeof sendSchema>>({
    resolver: zodResolver(sendSchema),
    defaultValues: { to: "", content: "" },
  });

  function onSend(values: z.infer<typeof sendSchema>) {
    sendMutation.mutate(
      { data: { to: values.to, content: values.content } },
      {
        onSuccess: () => {
          toast.success("Message sent");
          form.reset();
          queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetMessageStatsQueryKey() });
        },
        onError: () => toast.error("Failed to send message — is the bot connected?"),
      }
    );
  }

  const statCards = [
    { label: "Total", value: stats?.total ?? 0, icon: MessageSquare, color: "text-primary" },
    { label: "Inbound", value: stats?.inbound ?? 0, icon: ArrowDownLeft, color: "text-blue-400" },
    { label: "Outbound", value: stats?.outbound ?? 0, icon: ArrowUpRight, color: "text-emerald-400" },
    { label: "Auto-Replies", value: stats?.autoReplies ?? 0, icon: Bot, color: "text-purple-400" },
    { label: "Today", value: stats?.today ?? 0, icon: Clock, color: "text-amber-400" },
    { label: "Contacts", value: stats?.uniqueContacts ?? 0, icon: Users, color: "text-rose-400" },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-mono font-bold tracking-tight mb-1">Messages</h1>
        <p className="text-muted-foreground font-mono text-sm">Message history and outbound sender.</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="border-border bg-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={cn("w-3.5 h-3.5", s.color)} />
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{s.label}</span>
                </div>
                <p className="text-2xl font-mono font-bold">{s.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Message list */}
        <Card className="lg:col-span-2 border-border bg-card flex flex-col h-[420px] md:h-[560px]">
          <CardHeader className="border-b border-border pb-4 flex-row items-center justify-between shrink-0">
            <CardTitle className="font-mono text-base">History</CardTitle>
            <Select value={direction} onValueChange={(v) => setDirection(v as typeof direction)}>
              <SelectTrigger className="w-32 h-8 text-xs font-mono bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="inbound">Inbound</SelectItem>
                <SelectItem value="outbound">Outbound</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-2">
              {isLoading ? (
                <div className="flex items-center justify-center h-40 text-muted-foreground font-mono text-sm">
                  Loading messages...
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-center space-y-2">
                  <MessageSquare className="w-10 h-10 opacity-20" />
                  <p className="font-mono text-sm">No messages yet.</p>
                  <p className="font-mono text-xs opacity-60">Messages will appear here once the bot receives or sends them.</p>
                </div>
              ) : (
                messages?.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                      msg.direction === "inbound"
                        ? "border-blue-500/20 bg-blue-500/5"
                        : "border-emerald-500/20 bg-emerald-500/5"
                    )}
                  >
                    <div className="mt-0.5 shrink-0">
                      {msg.direction === "inbound" ? (
                        <ArrowDownLeft className="w-4 h-4 text-blue-400" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-mono text-xs font-medium">
                          {msg.contactName || msg.remoteJid?.split("@")[0] || "Unknown"}
                        </span>
                        {msg.isAutoReply && (
                          <Badge variant="outline" className="text-[10px] font-mono h-4 px-1.5 border-purple-500/40 text-purple-400">
                            auto
                          </Badge>
                        )}
                        <span className="text-[10px] font-mono text-muted-foreground ml-auto">
                          {new Date(msg.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="font-mono text-sm text-foreground/90 break-words">{msg.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </Card>

        {/* Send panel */}
        <Card className="border-border bg-card">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="font-mono text-base flex items-center gap-2">
              <Send className="w-4 h-4 text-primary" />
              Send Message
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSend)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="to"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-xs uppercase text-muted-foreground">To (Phone Number)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="27730337759"
                          className="font-mono bg-background border-border"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="font-mono text-xs" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Message</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Type your message..."
                          className="font-mono bg-background border-border resize-none min-h-[120px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="font-mono text-xs" />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full font-mono font-bold"
                  disabled={sendMutation.isPending}
                >
                  <Send className="w-4 h-4 mr-2" />
                  {sendMutation.isPending ? "Sending..." : "SEND"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
