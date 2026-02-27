"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  ToggleLeft,
  Key,
  Brain,
  Bell,
  Clock,
} from "lucide-react";

export default function SettingsPage() {
  const [paperMode, setPaperMode] = useState(true);
  const [confidence, setConfidence] = useState([75]);
  const [scanSchedule, setScanSchedule] = useState("1h");
  const [environment, setEnvironment] = useState("demo");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Settings
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Configure your trading environment and API connections
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Trading Mode */}
        <Card className="border-zinc-800/60 bg-zinc-900/50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800/50">
                <ToggleLeft className="h-4 w-4 text-zinc-400" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold text-zinc-200">
                  Trading Mode
                </CardTitle>
                <CardDescription className="text-xs text-zinc-600">
                  Switch between paper and real trading
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-lg border border-zinc-800/60 bg-zinc-950/50 px-4 py-3">
              <div className="flex items-center gap-3">
                <Switch
                  checked={!paperMode}
                  onCheckedChange={(checked) => setPaperMode(!checked)}
                />
                <div>
                  <p className="text-sm font-medium text-zinc-300">
                    {paperMode ? "Paper Trading" : "Real Trading"}
                  </p>
                  <p className="text-xs text-zinc-600">
                    {paperMode
                      ? "Simulated trades with no real money"
                      : "Live trading with real funds"}
                  </p>
                </div>
              </div>
              <Badge
                variant="outline"
                className={
                  paperMode
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                    : "border-red-500/30 bg-red-500/10 text-red-400"
                }
              >
                {paperMode ? "Paper" : "Real"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="border-zinc-800/60 bg-zinc-900/50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800/50">
                <Bell className="h-4 w-4 text-zinc-400" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold text-zinc-200">
                  Notifications
                </CardTitle>
                <CardDescription className="text-xs text-zinc-600">
                  Alert thresholds and preferences
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm text-zinc-400">
                  Min Confidence Threshold
                </Label>
                <span className="text-sm font-mono font-medium text-emerald-400">
                  {confidence[0]}%
                </span>
              </div>
              <Slider
                value={confidence}
                onValueChange={setConfidence}
                max={100}
                min={50}
                step={5}
                className="[&_[data-slot=slider-thumb]]:bg-emerald-500 [&_[data-slot=slider-range]]:bg-emerald-500/50 [&_[data-slot=slider-track]]:bg-zinc-800"
              />
              <p className="mt-2 text-xs text-zinc-600">
                Only receive alerts for picks above this confidence level
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Kalshi API */}
        <Card className="border-zinc-800/60 bg-zinc-900/50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800/50">
                <Key className="h-4 w-4 text-zinc-400" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold text-zinc-200">
                  Kalshi API
                </CardTitle>
                <CardDescription className="text-xs text-zinc-600">
                  Connect to your Kalshi account
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="kalshi-key" className="text-sm text-zinc-400">
                API Key ID
              </Label>
              <Input
                id="kalshi-key"
                type="password"
                placeholder="Enter your Kalshi API key"
                className="border-zinc-800 bg-zinc-950/50 text-zinc-300 placeholder:text-zinc-700 focus-visible:border-emerald-500/50 focus-visible:ring-emerald-500/20"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="kalshi-private-key" className="text-sm text-zinc-400">
                Private Key
              </Label>
              <Textarea
                id="kalshi-private-key"
                placeholder="Paste your private key (PEM format)"
                rows={4}
                className="border-zinc-800 bg-zinc-950/50 text-zinc-300 font-mono text-xs placeholder:text-zinc-700 focus-visible:border-emerald-500/50 focus-visible:ring-emerald-500/20 resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-zinc-400">Environment</Label>
              <Select value={environment} onValueChange={setEnvironment}>
                <SelectTrigger className="border-zinc-800 bg-zinc-950/50 text-zinc-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-zinc-800 bg-zinc-900">
                  <SelectItem value="demo">Demo</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Claude AI */}
        <Card className="border-zinc-800/60 bg-zinc-900/50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800/50">
                <Brain className="h-4 w-4 text-zinc-400" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold text-zinc-200">
                  Claude AI
                </CardTitle>
                <CardDescription className="text-xs text-zinc-600">
                  Connect the AI analysis engine
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="claude-key" className="text-sm text-zinc-400">
                API Key
              </Label>
              <Input
                id="claude-key"
                type="password"
                placeholder="sk-ant-..."
                className="border-zinc-800 bg-zinc-950/50 text-zinc-300 placeholder:text-zinc-700 focus-visible:border-emerald-500/50 focus-visible:ring-emerald-500/20"
              />
              <p className="text-xs text-zinc-600">
                Your Anthropic API key for market analysis
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Scan Schedule */}
        <Card className="border-zinc-800/60 bg-zinc-900/50 lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800/50">
                <Clock className="h-4 w-4 text-zinc-400" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold text-zinc-200">
                  Scan Schedule
                </CardTitle>
                <CardDescription className="text-xs text-zinc-600">
                  How often the AI scans for new opportunities
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <Label className="text-sm text-zinc-400">Scan Interval</Label>
                <Select value={scanSchedule} onValueChange={setScanSchedule}>
                  <SelectTrigger className="w-48 border-zinc-800 bg-zinc-950/50 text-zinc-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-800 bg-zinc-900">
                    <SelectItem value="1h">Every 1 hour</SelectItem>
                    <SelectItem value="2h">Every 2 hours</SelectItem>
                    <SelectItem value="4h">Every 4 hours</SelectItem>
                    <SelectItem value="6h">Every 6 hours</SelectItem>
                    <SelectItem value="12h">Every 12 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-lg border border-zinc-800/60 bg-zinc-950/50 px-4 py-3">
                <p className="text-xs text-zinc-600">Next scan</p>
                <p className="text-sm font-medium text-zinc-400">
                  Not scheduled
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
