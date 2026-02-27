"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ListX } from "lucide-react";

export default function BetsPage() {
  const [mode, setMode] = useState("paper");
  const [category, setCategory] = useState("all");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Bet Tracker
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Track and manage all your positions
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="active" className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="bg-zinc-900 border border-zinc-800/60">
            <TabsTrigger
              value="active"
              className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white"
            >
              Active
            </TabsTrigger>
            <TabsTrigger
              value="resolved"
              className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white"
            >
              Resolved
            </TabsTrigger>
            <TabsTrigger
              value="all"
              className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white"
            >
              All
            </TabsTrigger>
          </TabsList>

          {/* Filters */}
          <div className="flex items-center gap-3">
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger className="w-32 border-zinc-800 bg-zinc-900/50 text-zinc-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-zinc-800 bg-zinc-900">
                <SelectItem value="paper">Paper</SelectItem>
                <SelectItem value="real">Real</SelectItem>
              </SelectContent>
            </Select>

            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-36 border-zinc-800 bg-zinc-900/50 text-zinc-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-zinc-800 bg-zinc-900">
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="weather">Weather</SelectItem>
                <SelectItem value="economics">Economics</SelectItem>
                <SelectItem value="sports">Sports</SelectItem>
                <SelectItem value="politics">Politics</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value="active">
          <BetsTable />
        </TabsContent>
        <TabsContent value="resolved">
          <BetsTable />
        </TabsContent>
        <TabsContent value="all">
          <BetsTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BetsTable() {
  return (
    <Card className="border-zinc-800/60 bg-zinc-900/50 overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800/60 hover:bg-transparent">
              <TableHead className="text-zinc-500 text-xs uppercase tracking-wider font-medium">
                Market
              </TableHead>
              <TableHead className="text-zinc-500 text-xs uppercase tracking-wider font-medium">
                Side
              </TableHead>
              <TableHead className="text-zinc-500 text-xs uppercase tracking-wider font-medium">
                Entry
              </TableHead>
              <TableHead className="text-zinc-500 text-xs uppercase tracking-wider font-medium">
                Current / Result
              </TableHead>
              <TableHead className="text-zinc-500 text-xs uppercase tracking-wider font-medium">
                P&L
              </TableHead>
              <TableHead className="text-zinc-500 text-xs uppercase tracking-wider font-medium">
                Status
              </TableHead>
              <TableHead className="text-zinc-500 text-xs uppercase tracking-wider font-medium text-right">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="border-zinc-800/60 hover:bg-transparent">
              <TableCell
                colSpan={7}
                className="h-48"
              >
                <div className="flex flex-col items-center justify-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800/60">
                    <ListX className="h-6 w-6 text-zinc-600" />
                  </div>
                  <p className="mt-3 text-sm text-zinc-500">
                    No bets to display
                  </p>
                  <Badge
                    variant="outline"
                    className="mt-2 border-zinc-700 text-zinc-600 text-[10px]"
                  >
                    Place a bet to get started
                  </Badge>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
