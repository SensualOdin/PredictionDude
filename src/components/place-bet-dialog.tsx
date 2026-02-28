"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface PlaceBetDialogProps {
  marketTicker: string;
  marketTitle: string;
  currentYesPrice: number;
  recommendationId?: string;
  suggestedSide?: "yes" | "no";
  suggestedContracts?: number;
  trigger?: React.ReactNode;
}

export function PlaceBetDialog({
  marketTicker,
  marketTitle,
  currentYesPrice,
  recommendationId,
  suggestedSide,
  suggestedContracts,
  trigger,
}: PlaceBetDialogProps) {
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<"yes" | "no">(suggestedSide ?? "yes");
  const [contracts, setContracts] = useState(suggestedContracts ?? 10);
  const [mode, setMode] = useState<"paper" | "real">("paper");
  const queryClient = useQueryClient();

  const { data: settingsData } = useQuery({
    queryKey: ["settings"],
    queryFn: () => fetch("/api/settings").then((r) => r.json()),
  });

  useEffect(() => {
    if (settingsData?.tradingMode) {
      setMode(settingsData.tradingMode as "paper" | "real");
    }
  }, [settingsData?.tradingMode]);

  const entryPrice = side === "yes" ? currentYesPrice : 1 - currentYesPrice;
  const totalCost = entryPrice * contracts;
  const potentialProfit = (1 - entryPrice) * contracts;

  const placeBet = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/bets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketTicker,
          side,
          contracts,
          entryPrice,
          mode,
          recommendationId,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to place bet");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activeBets"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["bets"] });
      setOpen(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" className="bg-neon-cyan/15 hover:bg-neon-cyan/25 text-neon-cyan border border-neon-cyan/30 uppercase tracking-wider text-xs font-semibold flex-1 sm:flex-none">
            Place Bet
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="border-neon-cyan/20 bg-cyber-card text-[#e0e0f0] sm:max-w-md glow-cyan">
        <DialogHeader>
          <DialogTitle className="text-neon-cyan uppercase tracking-wider">Place Bet</DialogTitle>
          <DialogDescription className="text-[#7a7a9a] truncate">
            {marketTitle}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Side Toggle */}
          <div className="space-y-2">
            <Label className="text-[#7a7a9a] text-xs uppercase tracking-[0.15em]">Side</Label>
            <div className="flex gap-2">
              <button
                onClick={() => setSide("yes")}
                className={cn(
                  "flex-1 rounded-lg py-2.5 text-sm font-bold uppercase tracking-wider transition-all",
                  side === "yes"
                    ? "bg-neon-cyan/15 text-neon-cyan ring-1 ring-neon-cyan/40"
                    : "bg-[#1a1a4a]/60 text-[#5a5a7a] hover:bg-[#1a1a4a]"
                )}
              >
                YES
              </button>
              <button
                onClick={() => setSide("no")}
                className={cn(
                  "flex-1 rounded-lg py-2.5 text-sm font-bold uppercase tracking-wider transition-all",
                  side === "no"
                    ? "bg-neon-magenta/15 text-neon-magenta ring-1 ring-neon-magenta/40"
                    : "bg-[#1a1a4a]/60 text-[#5a5a7a] hover:bg-[#1a1a4a]"
                )}
              >
                NO
              </button>
            </div>
          </div>

          {/* Contracts */}
          <div className="space-y-2">
            <Label htmlFor="contracts" className="text-[#7a7a9a] text-xs uppercase tracking-[0.15em]">
              Contracts
            </Label>
            <Input
              id="contracts"
              type="number"
              min={1}
              value={contracts}
              onChange={(e) => setContracts(Math.max(1, Number(e.target.value)))}
              className="border-neon-cyan/20 bg-[#1a1a4a]/60 text-[#e0e0f0] focus:border-neon-cyan/40 focus:ring-neon-cyan/20"
            />
          </div>

          {/* Mode Toggle */}
          <div className="space-y-2">
            <Label className="text-[#7a7a9a] text-xs uppercase tracking-[0.15em]">Mode</Label>
            <div className="flex gap-2">
              <button
                onClick={() => setMode("paper")}
                className={cn(
                  "flex-1 rounded-lg py-2 text-sm font-semibold uppercase tracking-wider transition-all",
                  mode === "paper"
                    ? "bg-neon-purple/15 text-neon-purple ring-1 ring-neon-purple/40"
                    : "bg-[#1a1a4a]/60 text-[#5a5a7a] hover:bg-[#1a1a4a]"
                )}
              >
                Paper
              </button>
              <button
                onClick={() => setMode("real")}
                className={cn(
                  "flex-1 rounded-lg py-2 text-sm font-semibold uppercase tracking-wider transition-all",
                  mode === "real"
                    ? "bg-neon-yellow/15 text-neon-yellow ring-1 ring-neon-yellow/40"
                    : "bg-[#1a1a4a]/60 text-[#5a5a7a] hover:bg-[#1a1a4a]"
                )}
              >
                Real
              </button>
            </div>
          </div>

          {/* Cost Summary */}
          <div className="rounded-lg bg-[#1a1a4a]/40 border border-neon-cyan/10 p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[#7a7a9a] uppercase tracking-wider text-xs">Entry Price</span>
              <span className="text-[#c0c0d0]">${entryPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#7a7a9a] uppercase tracking-wider text-xs">Total Cost</span>
              <span className="text-[#e0e0f0] font-semibold">${totalCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#7a7a9a] uppercase tracking-wider text-xs">Potential Profit</span>
              <span className="text-neon-cyan">+${potentialProfit.toFixed(2)}</span>
            </div>
          </div>

          {mode === "real" && (
            <div className="rounded-lg bg-neon-yellow/5 border border-neon-yellow/20 p-3">
              <p className="text-xs text-neon-yellow">
                Real mode will place a live order on Kalshi using your API credentials.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            className="text-[#7a7a9a] hover:text-[#c0c0d0] hover:bg-[#1a1a4a]/60"
          >
            Cancel
          </Button>
          <Button
            onClick={() => placeBet.mutate()}
            disabled={placeBet.isPending}
            className={cn(
              "font-semibold uppercase tracking-wider",
              mode === "real"
                ? "bg-neon-yellow/15 hover:bg-neon-yellow/25 text-neon-yellow border border-neon-yellow/30"
                : "btn-neon-cyan"
            )}
          >
            {placeBet.isPending
              ? "Placing..."
              : `Place ${mode === "real" ? "Real" : "Paper"} Bet`}
          </Button>
        </DialogFooter>

        {placeBet.isError && (
          <p className="text-xs text-neon-magenta text-center">
            {placeBet.error.message}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
