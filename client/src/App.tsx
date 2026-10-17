import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Workspace from "./pages/cafe/Workspace";
import { CustomerMenu, OrderConfirmation } from "./pages/cafe/Customer";

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster position="top-right" />
          <Switch>
            <Route path="/c/:slug">
              {params => <CustomerMenu slug={params.slug} />}
            </Route>
            <Route path="/order/:token">
              {params => <OrderConfirmation token={params.token} />}
            </Route>
            <Route>
              <Workspace />
            </Route>
          </Switch>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
