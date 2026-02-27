"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";

const strategyRules = [
  {
    label: "Categories",
    value: "All except Politics",
    icon: Tag,
  },
  {
    label: "Min Volume",
    value: "100",
    icon: BarChart3,
  },
  {
    label: "Min Time to Expiration",
    value: "24h",
    icon: Clock,
  },
  {
    label: "Price Range",
    value: "$0.15 \u2013 $0.85",
    icon: DollarSign,
  },
  {
    label: "Default Size",
    value: "10 contracts",
    icon: Layers,
  },
];

export default function StrategyPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Strategy Manager
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Configure and evolve your trading rules
        </p>
      </div>

      {/* Active Strategy */}
      <Card className="border-zinc-800/60 bg-zinc-900/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
                <Brain className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-white">
                  Active Strategy
                </CardTitle>
                <CardDescription className="text-xs text-zinc-500">
                  Version 1.0 &middot; Default configuration
                </CardDescription>
              </div>
            </div>
            <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20">
              <ShieldCheck className="mr-1 h-3 w-3" />
              Active
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-0">
          <Separator className="mb-4 bg-zinc-800/60" />

          <div className="space-y-1">
            {strategyRules.map((rule, index) => {
              const Icon = rule.icon;
              return (
                <div
                  key={rule.label}
                  className="flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-zinc-800/30"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-zinc-600" />
                    <span className="text-sm text-zinc-400">{rule.label}</span>
                  </div>
                  <span className="text-sm font-medium text-zinc-200">
                    {rule.value}
                  </span>
                </div>
              );
            })}
          </div>
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
          </CardContent>
        </Card>

        {/* Proposed Changes */}
        <Card className="border-zinc-800/60 bg-zinc-900/50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800/50">
                <GitPullRequestDraft className="h-4 w-4 text-zinc-500" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold text-zinc-200">
                  Proposed Changes
                </CardTitle>
                <CardDescription className="text-xs text-zinc-600">
                  AI-suggested strategy tweaks
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
