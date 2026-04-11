import type { Metadata } from "next";

import { Badge } from "@/shared/components/Badge";
import { Card } from "@/shared/components/Card";
import { listIntegrations } from "@/features/integrations/application/integrations.service";

import { DisconnectButton } from "./DisconnectButton";
import styles from "./page.module.scss";

export const metadata: Metadata = { title: "Integrations" };

interface Props {
  readonly searchParams: Promise<{ connected?: string; error?: string }>;
}

const PROVIDERS = [
  {
    id: "google" as const,
    label: "Gmail",
    description:
      "Send auto-replies from a Gmail or Google Workspace inbox you own.",
    connectUrl: "/api/oauth/google/connect",
  },
  {
    id: "microsoft" as const,
    label: "Outlook",
    description:
      "Send auto-replies from Outlook / Microsoft 365 via the Graph API.",
    connectUrl: "/api/oauth/microsoft/connect",
  },
];

export default async function IntegrationsPage({ searchParams }: Props) {
  const { connected, error } = await searchParams;
  const integrations = await listIntegrations();

  const byProvider = new Map(integrations.map((i) => [i.provider, i]));

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <h1 className={styles.title}>Integrations</h1>
        <p className={styles.sub}>
          Connect an inbox to send branded auto-replies from your own domain.
          FormTrack never reads mail — only sends from the address you connect.
        </p>
      </header>

      {connected && (
        <div className={styles.flashOk}>
          Connected {connected}. You can now use this inbox for auto-replies.
        </div>
      )}
      {error && (
        <div className={styles.flashErr}>
          Connection failed: {error.replace(/_/g, " ")}
        </div>
      )}

      <div className={styles.grid}>
        {PROVIDERS.map((p) => {
          const existing = byProvider.get(p.id);
          const active = existing?.status === "active";
          return (
            <Card key={p.id} className={styles.card}>
              <div className={styles.cardHead}>
                <div>
                  <h2 className={styles.cardTitle}>{p.label}</h2>
                  <p className={styles.cardSub}>{p.description}</p>
                </div>
                {active ? (
                  <Badge tone="positive">Connected</Badge>
                ) : (
                  <Badge tone="neutral">Not connected</Badge>
                )}
              </div>

              {active && existing && (
                <dl className={styles.meta}>
                  <dt>Account</dt>
                  <dd>{existing.accountEmail ?? "Unknown account"}</dd>
                  <dt>Scopes</dt>
                  <dd className={styles.scopes}>
                    {existing.scopes.join(", ")}
                  </dd>
                </dl>
              )}

              <div className={styles.actions}>
                {active && existing ? (
                  <DisconnectButton id={existing.id} />
                ) : (
                  <a href={p.connectUrl} className={styles.connectBtn}>
                    Connect {p.label}
                  </a>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
