"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Badge } from "@/components/ui/badge";
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
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
            Place Bet
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="border-zinc-800 bg-zinc-900 text-zinc-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Place Bet</DialogTitle>
          <DialogDescription className="text-zinc-400 truncate">
            {marketTitle}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Side Toggle */}
          <div className="space-y-2">
            <Label className="text-zinc-400 text-xs uppercase tracking-wider">Side</Label>
            <div className="flex gap-2">
              <button
                onClick={() => setSide("yes")}
                className={cn(
                  "flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all",
                  side === "yes"
                    ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40"
                    : "bg-zinc-800/60 text-zinc-500 hover:bg-zinc-800"
                )}
              >
                YES
              </button>
              <button
                onClick={() => setSide("no")}
                className={cn(
                  "flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all",
                  side === "no"
                    ? "bg-red-500/20 text-red-400 ring-1 ring-red-500/40"
                    : "bg-zinc-800/60 text-zinc-500 hover:bg-zinc-800"
                )}
              >
                NO
              </button>
            </div>
          </div>

          {/* Contracts */}
          <div className="space-y-2">
            <Label htmlFor="contracts" className="text-zinc-400 text-xs uppercase tracking-wider">
              Contracts
            </Label>
            <Input
              id="contracts"
              type="number"
              min={1}
              value={contracts}
              onChange={(e) => setContracts(Math.max(1, Number(e.target.value)))}
              className="border-zinc-700 bg-zinc-800/60 text-white"
            />
          </div>

          {/* Mode Toggle */}
          <div className="space-y-2">
            <Label className="text-zinc-400 text-xs uppercase tracking-wider">Mode</Label>
            <div className="flex gap-2">
              <button
                onClick={() => setMode("paper")}
                className={cn(
                  "flex-1 rounded-lg py-2 text-sm font-medium transition-all",
                  mode === "paper"
                    ? "bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/40"
                    : "bg-zinc-800/60 text-zinc-500 hover:bg-zinc-800"
                )}
              >
                Paper
              </button>
              <button
                onClick={() => setMode("real")}
                className={cn(
                  "flex-1 rounded-lg py-2 text-sm font-medium transition-all",
                  mode === "real"
                    ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40"
                    : "bg-zinc-800/60 text-zinc-500 hover:bg-zinc-800"
                )}
              >
                Real
              </button>
            </div>
          </div>

          {/* Cost Summary */}
          <div className="rounded-lg bg-zinc-800/40 p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Entry Price</span>
              <span className="text-zinc-300">${entryPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Total Cost</span>
              <span className="text-white font-semibold">${totalCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Potential Profit</span>
              <span className="text-emerald-400">+${potentialProfit.toFixed(2)}</span>
            </div>
          </div>

          {mode === "real" && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
              <p className="text-xs text-amber-400">
                Real mode will place a live order on Kalshi using your API credentials.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            className="text-zinc-400"
          >
            Cancel
          </Button>
          <Button
            onClick={() => placeBet.mutate()}
            disabled={placeBet.isPending}
            className={cn(
              "font-semibold",
              mode === "real"
                ? "bg-amber-600 hover:bg-amber-700 text-white"
                : "bg-emerald-600 hover:bg-emerald-700 text-white"
            )}
          >
            {placeBet.isPending
              ? "Placing..."
              : `Place ${mode === "real" ? "Real" : "Paper"} Bet`}
          </Button>
        </DialogFooter>

        {placeBet.isError && (
          <p className="text-xs text-red-400 text-center">
            {placeBet.error.message}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
