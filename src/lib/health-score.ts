import { db } from "@/lib/db";

export interface HealthScoreResult {
  score: number;              // 0-100
  totalSessions: number;
  resolvedCount: number;
  escalatedCount: number;
  avgTurns: number;           // Average conversation turns to resolution
  escalationRate: number;     // 0-1
  topIssues: { cause: string; count: number; percentage: number }[];
  recentTrend: "improving" | "stable" | "declining";
}

export async function computeHealthScore(productId: string): Promise<HealthScoreResult> {
  // 1. Fetch all non-active sessions for this product
  const sessions = await db.diagnosticSession.findMany({
    where: { productId, status: { not: "active" } }
  });

  const totalSessions = sessions.length;
  if (totalSessions === 0) {
    return {
      score: -1,
      totalSessions: 0,
      resolvedCount: 0,
      escalatedCount: 0,
      avgTurns: 0,
      escalationRate: 0,
      topIssues: [],
      recentTrend: "stable"
    };
  }

  // 2. Count statuses
  const resolvedCount = sessions.filter(s => s.status === "completed" || s.status === "resolved").length;
  const escalatedCount = sessions.filter(s => s.status === "escalated").length;
  const escalationRate = escalatedCount / totalSessions;

  // 3. Extract confirmed root causes from diagnosticState
  const causeFrequency: Record<string, number> = {};
  let totalTurns = 0;

  for (const sess of sessions) {
    let state: any = {};
    try {
      state = JSON.parse(sess.diagnosticState || "{}");
    } catch {}
    
    let messages: any[] = [];
    try {
      messages = JSON.parse(sess.messages || "[]");
    } catch {}
    
    totalTurns += Math.max(1, Math.floor(messages.length / 2)); // Each turn = user + assistant

    if (state.possibleCauses && Array.isArray(state.possibleCauses)) {
      for (const cause of state.possibleCauses) {
        if (cause.status === "confirmed") {
          causeFrequency[cause.label] = (causeFrequency[cause.label] || 0) + 1;
        }
      }
    }
  }

  const avgTurns = totalTurns / totalSessions;

  // 4. Build top issues
  const topIssues = Object.entries(causeFrequency)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([cause, count]) => ({
      cause,
      count,
      percentage: Math.round((count / totalSessions) * 100)
    }));

  // 5. Compute score
  // Score starts at 100, drops by:
  // - up to 40 points based on escalation rate (escalationRate * 40)
  // - up to 20 points based on average dialogue length (min(avgTurns, 10) * 2)
  // - up to 20 points if a single issue dominates support (repeatIssueRate * 20)
  const repeatIssueRate = topIssues.length > 0 ? topIssues[0].percentage / 100 : 0;
  const score = Math.max(0, Math.min(100, Math.round(
    100 - (escalationRate * 40) - (Math.min(avgTurns, 10) * 2) - (repeatIssueRate * 20)
  )));

  // 6. Determine Trend (compare last 5 sessions vs prior ones)
  let recentTrend: "improving" | "stable" | "declining" = "stable";
  if (sessions.length >= 8) {
    const sorted = [...sessions].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    const recent = sorted.slice(0, 4);
    const older = sorted.slice(4);
    
    const recentEscRate = recent.filter(s => s.status === "escalated").length / 4;
    const olderEscRate = older.filter(s => s.status === "escalated").length / older.length;
    
    if (recentEscRate < olderEscRate - 0.1) {
      recentTrend = "improving";
    } else if (recentEscRate > olderEscRate + 0.1) {
      recentTrend = "declining";
    }
  }

  return {
    score,
    totalSessions,
    resolvedCount,
    escalatedCount,
    avgTurns: Math.round(avgTurns * 10) / 10,
    escalationRate,
    topIssues,
    recentTrend
  };
}
