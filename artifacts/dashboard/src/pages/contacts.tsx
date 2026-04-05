import { useListContacts } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, MessageSquare, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

function getInitials(name: string | null | undefined, phone: string): string {
  if (name) {
    return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  }
  return phone.slice(-2);
}

function getAvatarColor(jid: string): string {
  const colors = [
    "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
    "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    "bg-blue-500/20 text-blue-400 border-blue-500/30",
    "bg-purple-500/20 text-purple-400 border-purple-500/30",
    "bg-amber-500/20 text-amber-400 border-amber-500/30",
    "bg-rose-500/20 text-rose-400 border-rose-500/30",
  ];
  const hash = jid.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

export function Contacts() {
  const { data: contacts = [], isLoading } = useListContacts({ query: { refetchInterval: 15000 } });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-mono font-bold tracking-tight mb-2">Contacts</h1>
          <p className="text-muted-foreground font-mono text-sm">All contacts the bot has interacted with.</p>
        </div>
        <div className="font-mono text-sm text-muted-foreground">
          {contacts.length} contact{contacts.length !== 1 ? "s" : ""}
        </div>
      </div>

      <Card className="border-border bg-card">
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="font-mono text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            All Contacts
          </CardTitle>
        </CardHeader>
        <ScrollArea className="h-[500px]">
          <div className="p-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground font-mono text-sm">
                Loading contacts...
              </div>
            ) : contacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-center space-y-3">
                <Users className="w-12 h-12 text-muted-foreground/20" />
                <p className="font-mono text-sm text-muted-foreground">No contacts yet.</p>
                <p className="font-mono text-xs text-muted-foreground/60">
                  Contacts appear automatically when the bot receives messages.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {contacts?.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center gap-4 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors group"
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-full border flex items-center justify-center font-mono text-sm font-bold shrink-0",
                      getAvatarColor(contact.jid)
                    )}>
                      {getInitials(contact.name, contact.phoneNumber)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-sm truncate">
                          {contact.name || contact.phoneNumber}
                        </span>
                        {contact.name && (
                          <span className="font-mono text-xs text-muted-foreground truncate">
                            {contact.phoneNumber}
                          </span>
                        )}
                      </div>
                      <p className="font-mono text-xs text-muted-foreground truncate">{contact.jid}</p>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <MessageSquare className="w-3 h-3" />
                          <span className="font-mono text-xs">{contact.messageCount}</span>
                        </div>
                      </div>
                      {contact.lastMessageAt && (
                        <div className="text-right hidden sm:block">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            <span className="font-mono text-xs">
                              {new Date(contact.lastMessageAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </Card>
    </div>
  );
}
