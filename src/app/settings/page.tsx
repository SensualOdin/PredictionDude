"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  ToggleLeft,
  Bell,
  BellRing,
  Clock,
  Globe,
  Loader2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SettingsData {
  id: string;
  tradingMode: "paper" | "real";
  kalshiEnv: "demo" | "production";
  minConfidenceThreshold: number;
  scanIntervalHours: number;
  pushEnabled: boolean;
  pushSubscription: unknown;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const queryClient = useQueryClient();

  // ── Server state ──────────────────────────────────────────────────────
  const { data: settings, isLoading } = useQuery<SettingsData>({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error("Failed to fetch settings");
      return res.json();
    },
  });

  // ── Local state (mirrors server, updated optimistically) ──────────────
  const [tradingMode, setTradingMode] = useState<"paper" | "real">("paper");
  const [kalshiEnv, setKalshiEnv] = useState<"demo" | "production">("demo");
  const [confidence, setConfidence] = useState<number[]>([75]);
  const [scanInterval, setScanInterval] = useState<string>("4");
  const [pushEnabled, setPushEnabled] = useState(false);
  const [notifPermission, setNotifPermission] =
    useState<NotificationPermission>("default");

  // Sync local state when server data arrives
  useEffect(() => {
    if (settings) {
      setTradingMode(settings.tradingMode ?? "paper");
      setKalshiEnv(settings.kalshiEnv ?? "demo");
      setConfidence([settings.minConfidenceThreshold ?? 75]);
      setScanInterval(String(settings.scanIntervalHours ?? 4));
      setPushEnabled(settings.pushEnabled ?? false);
    }
  }, [settings]);

  // Check browser notification permission on mount
  useEffect(() => {
    if (typeof Notification !== "undefined") {
      setNotifPermission(Notification.permission);
    }
  }, []);

  // ── Save mutation ─────────────────────────────────────────────────────
  const saveSettings = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Settings saved");
    },
    onError: () => {
      toast.error("Failed to save settings");
    },
  });

  // ── Debounced save (for the slider) ───────────────────────────────────
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const debouncedSave = useCallback(
    (data: Record<string, unknown>) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        saveSettings.mutate(data);
      }, 500);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // ── Change handlers ───────────────────────────────────────────────────
  const handleTradingMode = (checked: boolean) => {
    const mode = checked ? "real" : "paper";
    setTradingMode(mode);
    saveSettings.mutate({ tradingMode: mode });
  };

  const handleEnvironment = (value: string) => {
    const env = value as "demo" | "production";
    setKalshiEnv(env);
    saveSettings.mutate({ kalshiEnv: env });
  };

  const handleConfidence = (value: number[]) => {
    setConfidence(value);
    debouncedSave({ minConfidenceThreshold: value[0] });
  };

  const handleScanInterval = (value: string) => {
    setScanInterval(value);
    saveSettings.mutate({ scanIntervalHours: parseInt(value, 10) });
  };

  const handlePushToggle = async (enabled: boolean) => {
    if (enabled) {
      const permission = await Notification.requestPermission();
      setNotifPermission(permission);
      if (permission !== "granted") {
        toast.error("Notification permission denied");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      });

      setPushEnabled(true);
      saveSettings.mutate({
        pushEnabled: true,
        pushSubscription: subscription.toJSON(),
      });
    } else {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
      }

      setPushEnabled(false);
      saveSettings.mutate({
        pushEnabled: false,
        pushSubscription: null,
      });
    }
  };

  // ── Loading state ─────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Settings
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Configure your trading environment and preferences
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ── Trading Mode ───────────────────────────────────────────── */}
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
                  checked={tradingMode === "real"}
                  onCheckedChange={handleTradingMode}
                />
                <div>
                  <p className="text-sm font-medium text-zinc-300">
                    {tradingMode === "paper" ? "Paper Trading" : "Real Trading"}
                  </p>
                  <p className="text-xs text-zinc-600">
                    {tradingMode === "paper"
                      ? "Simulated trades with no real money"
                      : "Live trading with real funds"}
                  </p>
                </div>
              </div>
              <Badge
                variant="outline"
                className={
                  tradingMode === "paper"
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                    : "border-red-500/30 bg-red-500/10 text-red-400"
                }
              >
                {tradingMode === "paper" ? "Paper" : "Real"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* ── Environment ────────────────────────────────────────────── */}
        <Card className="border-zinc-800/60 bg-zinc-900/50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800/50">
                <Globe className="h-4 w-4 text-zinc-400" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold text-zinc-200">
                  Environment
                </CardTitle>
                <CardDescription className="text-xs text-zinc-600">
                  Kalshi API environment target
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label className="text-sm text-zinc-400">API Environment</Label>
              <Select value={kalshiEnv} onValueChange={handleEnvironment}>
                <SelectTrigger className="border-zinc-800 bg-zinc-950/50 text-zinc-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-zinc-800 bg-zinc-900">
                  <SelectItem value="demo">Demo</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-zinc-600">
                {kalshiEnv === "demo"
                  ? "Using Kalshi demo environment (no real money)"
                  : "Using Kalshi production environment (real money)"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ── Notifications (Confidence Threshold) ───────────────────── */}
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
              <div className="mb-3 flex items-center justify-between">
                <Label className="text-sm text-zinc-400">
                  Min Confidence Threshold
                </Label>
                <span className="font-mono text-sm font-medium text-emerald-400">
                  {confidence[0]}%
                </span>
              </div>
              <Slider
                value={confidence}
                onValueChange={handleConfidence}
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

        {/* ── Push Notifications ──────────────────────────────────────── */}
        <Card className="border-zinc-800/60 bg-zinc-900/50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800/50">
                <BellRing className="h-4 w-4 text-zinc-400" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold text-zinc-200">
                  Push Notifications
                </CardTitle>
                <CardDescription className="text-xs text-zinc-600">
                  Receive alerts directly in your browser
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-zinc-800/60 bg-zinc-950/50 px-4 py-3">
              <div className="flex items-center gap-3">
                <Switch
                  checked={pushEnabled}
                  onCheckedChange={handlePushToggle}
                  disabled={notifPermission === "denied"}
                />
                <div>
                  <p className="text-sm font-medium text-zinc-300">
                    Enable Push Notifications
                  </p>
                  <p className="text-xs text-zinc-600">
                    Permission:{" "}
                    <span
                      className={
                        notifPermission === "granted"
                          ? "text-emerald-400"
                          : notifPermission === "denied"
                            ? "text-red-400"
                            : "text-zinc-500"
                      }
                    >
                      {notifPermission}
                    </span>
                  </p>
                </div>
              </div>
              <Badge
                variant="outline"
                className={
                  pushEnabled
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : "border-zinc-700/30 bg-zinc-800/10 text-zinc-500"
                }
              >
                {pushEnabled ? "On" : "Off"}
              </Badge>
            </div>
            {notifPermission === "denied" && (
              <p className="text-xs text-red-400">
                Notifications are blocked. Enable them in your browser settings.
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── Scan Schedule ──────────────────────────────────────────── */}
        <Card className="border-zinc-800/60 bg-zinc-900/50">
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
            <div className="space-y-2">
              <Label className="text-sm text-zinc-400">Scan Interval</Label>
              <Select value={scanInterval} onValueChange={handleScanInterval}>
                <SelectTrigger className="w-48 border-zinc-800 bg-zinc-950/50 text-zinc-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-zinc-800 bg-zinc-900">
                  <SelectItem value="1">Every 1 hour</SelectItem>
                  <SelectItem value="2">Every 2 hours</SelectItem>
                  <SelectItem value="4">Every 4 hours</SelectItem>
                  <SelectItem value="6">Every 6 hours</SelectItem>
                  <SelectItem value="12">Every 12 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
