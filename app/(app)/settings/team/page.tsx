import type { Metadata } from "next";

import { Badge } from "@/shared/components/Badge";
import { Card } from "@/shared/components/Card";
import { requireWorkspace } from "@/lib/auth/requireWorkspace";
import { listMembers } from "@/features/team/application/team.service";

import { InviteForm } from "./InviteForm";
import { RemoveButton } from "./RemoveButton";
import styles from "./page.module.scss";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const ctx = await requireWorkspace();
  const members = await listMembers();
  const canManage =
    ctx.workspace.role === "owner" || ctx.workspace.role === "admin";

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <h1 className={styles.title}>Team</h1>
        <p className={styles.sub}>
          Invite teammates to view and manage leads. Admins can invite others;
          owners can transfer ownership.
        </p>
      </header>

      {canManage && (
        <Card className={styles.card}>
          <h2 className={styles.cardTitle}>Invite member</h2>
          <InviteForm />
        </Card>
      )}

      <Card className={styles.card}>
        <h2 className={styles.cardTitle}>Members</h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Joined</th>
              {canManage && <th />}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.userId}>
                <td className={styles.email}>{m.email ?? m.userId}</td>
                <td>
                  <Badge tone={m.role === "owner" ? "accent" : "neutral"}>
                    {m.role}
                  </Badge>
                </td>
                <td className={styles.mono}>
                  {new Date(m.joinedAt).toLocaleDateString()}
                </td>
                {canManage && (
                  <td className={styles.actionCell}>
                    {m.userId !== ctx.userId && m.role !== "owner" && (
                      <RemoveButton userId={m.userId} />
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
