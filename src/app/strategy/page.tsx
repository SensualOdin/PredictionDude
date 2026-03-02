"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Brain,
  History,
  GitPullRequestDraft,
  ShieldCheck,
  Clock,
  DollarSign,
  BarChart3,
  Tag,
  Layers,
  Loader2,
  Check,
  X,
} from "lucide-react";
import { cn, formatCST } from "@/lib/utils";

interface Strategy {
  id: string;
  version: number;
  name: string | null;
  rules: Record<string, unknown>;
  parentId: string | null;
  changeReason: string | null;
  status: string;
  createdAt: string;
}

interface Analysis {
  id: string;
  proposedUpdate: string | null;
  marketTitle: string | null;
  betOutcome: string | null;
  createdAt: string;
}

function formatRuleValue(key: string, value: unknown): string {
  if (key === "categories") {
    const cats = value as Record<string, unknown>;
    if (cats.blocked && Array.isArray(cats.blocked) && cats.blocked.length > 0) {
      return `All except ${(cats.blocked as string[]).join(", ")}`;
    }
    if (cats.allowed && Array.isArray(cats.allowed)) {
      return (cats.allowed as string[]).join(", ");
    }
    return "All";
  }
  if (typeof value === "object" && value !== null) {
    return JSON.stringify(value);
  }
  return String(value);
}

const ruleIcons: Record<string, typeof Tag> = {
  categories: Tag,
  filters: BarChart3,
  position_sizing: Layers,
  notifications: Clock,
};

export default function StrategyPage() {
  const queryClient = useQueryClient();

  const { data: strategiesData, isLoading: loadingStrategies } = useQuery({
    queryKey: ["strategies"],
    queryFn: () => fetch("/api/strategies").then((r) => r.json()),
  });

  const { data: analysesData } = useQuery({
    queryKey: ["analyses"],
    queryFn: () => fetch("/api/analyses?limit=10").then((r) => r.json()),
  });

  const applyProposal = useMutation({
    mutationFn: async ({ rules, changeReason }: { rules: Record<string, unknown>; changeReason: string }) => {
      const res = await fetch("/api/strategies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules, changeReason }),
      });
      if (!res.ok) throw new Error("Failed to create strategy");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strategies"] });
    },
  });

  const allStrategies: Strategy[] = strategiesData?.strategies ?? [];
  const activeStrategy = allStrategies.find((s) => s.status === "active");
  const archivedStrategies = allStrategies.filter((s) => s.status === "archived");

  // Get analyses with proposed updates (not "none")
  const allAnalyses: Analysis[] = analysesData?.analyses ?? [];
  const proposals = allAnalyses.filter(
    (a) => a.proposedUpdate && a.proposedUpdate !== "none" && a.proposedUpdate.trim() !== ""
  );

  const rules = (activeStrategy?.rules ?? {}) as Record<string, unknown>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
          Strategy Manager
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Configure and evolve your trading rules
        </p>
      </div>

      {/* Active Strategy */}
      <Card className="border-zinc-800/60 bg-zinc-900/50">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
                <Brain className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-white">
                  Active Strategy
                </CardTitle>
                <CardDescription className="text-xs text-zinc-500">
                  {activeStrategy
                    ? `${activeStrategy.name ?? "Unnamed"} · v${activeStrategy.version}`
                    : "No active strategy"}
                </CardDescription>
              </div>
            </div>
            {activeStrategy && (
              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20">
                <ShieldCheck className="mr-1 h-3 w-3" />
                Active
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-0">
          <Separator className="mb-4 bg-zinc-800/60" />

          {loadingStrategies ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
            </div>
          ) : Object.keys(rules).length === 0 ? (
            <p className="text-sm text-zinc-600 text-center py-8">No rules configured</p>
          ) : (
            <div className="space-y-1">
              {Object.entries(rules).map(([key, value]) => {
                const Icon = ruleIcons[key] ?? DollarSign;
                // For nested objects, show sub-keys
                if (typeof value === "object" && value !== null && !Array.isArray(value)) {
                  return Object.entries(value as Record<string, unknown>).map(([subKey, subVal]) => (
                    <div
                      key={`${key}.${subKey}`}
                      className="flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-zinc-800/30"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-4 w-4 text-zinc-600" />
                        <span className="text-sm text-zinc-400 capitalize">
                          {subKey.replace(/_/g, " ")}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-zinc-200">
                        {formatRuleValue(subKey, subVal)}
                      </span>
                    </div>
                  ));
                }
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-zinc-800/30"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4 text-zinc-600" />
                      <span className="text-sm text-zinc-400 capitalize">
                        {key.replace(/_/g, " ")}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-zinc-200">
                      {formatRuleValue(key, value)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {activeStrategy?.changeReason && (
            <div className="mt-4 rounded-lg bg-zinc-800/30 p-2 sm:p-3">
              <p className="text-xs text-zinc-500">Last change reason:</p>
              <p className="text-sm text-zinc-400 mt-0.5">{activeStrategy.changeReason}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Version History */}
        <Card className="border-zinc-800/60 bg-zinc-900/50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800/50">
                <History className="h-4 w-4 text-zinc-500" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold text-zinc-200">
                  Version History
                </CardTitle>
                <CardDescription className="text-xs text-zinc-600">
                  Strategy evolution log
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {archivedStrategies.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800/60">
                  <History className="h-5 w-5 text-zinc-700" />
                </div>
                <p className="mt-3 text-sm text-zinc-600">
                  No previous versions
                </p>
                <p className="mt-1 text-xs text-zinc-700">
                  Modifications will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {archivedStrategies.map((s) => (
                  <div key={s.id} className="rounded-lg bg-zinc-800/30 p-2 sm:p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-zinc-300">
                        {s.name ?? `v${s.version}`}
                      </span>
                      <Badge variant="outline" className="border-zinc-700 text-zinc-500 text-[10px]">
                        v{s.version}
                      </Badge>
                    </div>
                    {s.changeReason && (
                      <p className="text-xs text-zinc-500">{s.changeReason}</p>
                    )}
                    <p className="text-[10px] text-zinc-600">
                      {formatCST(s.createdAt, { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Proposed Changes */}
        <Card className="border-zinc-800/60 bg-zinc-900/50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800/50">
                <GitPullRequestDraft className="h-4 w-4 text-zinc-500" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-sm font-semibold text-zinc-200">
                  Proposed Changes
                </CardTitle>
                <CardDescription className="text-xs text-zinc-600">
                  AI-suggested strategy tweaks
                </CardDescription>
              </div>
              {proposals.length >= 2 && (
                <Button
                  size="sm"
                  onClick={() =>
                    applyProposal.mutate({
                      rules: { ...rules, _appliedLearnings: proposals.map((p) => p.proposedUpdate) },
                      changeReason: `Applied ${proposals.length} AI learnings: ${proposals.map((p) => p.proposedUpdate).join("; ")}`,
                    })
                  }
                  disabled={applyProposal.isPending}
                  className="bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/20 text-xs h-7 shrink-0"
                >
                  {applyProposal.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <>
                      <Check className="mr-1 h-3 w-3" />
                      Apply All ({proposals.length})
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {proposals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800/60">
                  <GitPullRequestDraft className="h-5 w-5 text-zinc-700" />
                </div>
                <p className="mt-3 text-sm text-zinc-600">
                  No proposed changes
                </p>
                <p className="mt-1 text-xs text-zinc-700">
                  The AI will suggest changes based on performance
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {proposals.map((a) => (
                  <div key={a.id} className="rounded-lg bg-zinc-800/30 p-2 sm:p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-zinc-300">{a.proposedUpdate}</p>
                      <Badge className={cn(
                        "text-[10px] shrink-0",
                        a.betOutcome === "hit"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-red-500/20 text-red-400"
                      )}>
                        {a.betOutcome === "hit" ? "From Win" : "From Loss"}
                      </Badge>
                    </div>
                    {a.marketTitle && (
                      <p className="text-xs text-zinc-600 truncate">{a.marketTitle}</p>
                    )}
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        onClick={() =>
                          applyProposal.mutate({
                            rules: { ...rules, _appliedLearning: a.proposedUpdate },
                            changeReason: `Applied AI learning: ${a.proposedUpdate}`,
                          })
                        }
                        disabled={applyProposal.isPending}
                        className="bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/20 text-xs h-7"
                      >
                        {applyProposal.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            <Check className="mr-1 h-3 w-3" />
                            Apply
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-zinc-500 hover:text-zinc-300 text-xs h-7"
                      >
                        <X className="mr-1 h-3 w-3" />
                        Dismiss
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
