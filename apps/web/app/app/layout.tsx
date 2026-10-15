import "./workspace.css";
import type { ReactNode } from "react";
import { AccountProvider } from "../../components/AccountProvider";
import { AccountHistory } from "../../components/AccountHistory";
export const metadata = { title: "Workspace — Hypothron AI" };
export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <AccountProvider>
      {children}
      <AccountHistory />
    </AccountProvider>
  );
}
