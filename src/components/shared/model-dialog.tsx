"use client";

import { Info } from "lucide-react";
import { MODEL } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const STEPS = [
  {
    title: "1 · Expected goals",
    body: "Recency-weighted attack and defence ratings are fitted per competition with a Poisson model. Recent matches count more, and small samples are shrunk toward the league average.",
  },
  {
    title: "2 · Scoreline matrix",
    body: "Those expected goals generate a full 0–8 × 0–8 scoreline grid, adjusted with the Dixon-Coles low-score correction so 0-0 and 1-1 are not under-predicted.",
  },
  {
    title: "3 · Blend the signals",
    body: "The grid's P(GG) is blended in logit space with each side's recent both-teams-to-score rate and their head-to-head record. Each signal is weighted by how much data backs it.",
  },
  {
    title: "4 · Explain every pick",
    body: "Each input is neutralised one at a time. The resulting swing in P(GG) is the impact you see on the detail page — no black box, no external AI.",
  },
];

export function ModelDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <Info className="h-3.5 w-3.5" />
          How it works
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Transparent by construction</DialogTitle>
          <DialogDescription>
            Model {MODEL.version} · a Dixon-Coles Poisson engine with recency weighting and
            ablation-based explanations. No paid APIs, no AI models.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {STEPS.map((step) => (
            <div key={step.title} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
              <p className="text-xs font-medium text-foreground">{step.title}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{step.body}</p>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-amber-400/15 bg-amber-400/[0.05] p-3">
          <p className="text-[11px] leading-relaxed text-amber-200/80">
            Predictions are probabilistic, not certainties. High conviction still loses. This is a
            personal tracking tool, not betting advice.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
