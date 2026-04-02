import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";
import { Home } from "@/pages/home";
import { Messages } from "@/pages/messages";
import { Contacts } from "@/pages/contacts";
import { AutoReplies } from "@/pages/auto-replies";
import { Settings } from "@/pages/settings";
import { BotEventsProvider } from "@/context/bot-events-context";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/">
        <Layout><Home /></Layout>
      </Route>
      <Route path="/messages">
        <Layout><Messages /></Layout>
      </Route>
      <Route path="/contacts">
        <Layout><Contacts /></Layout>
      </Route>
      <Route path="/auto-replies">
        <Layout><AutoReplies /></Layout>
      </Route>
      <Route path="/settings">
        <Layout><Settings /></Layout>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BotEventsProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </BotEventsProvider>
    </QueryClientProvider>
  );
}

export default App;
