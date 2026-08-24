"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ChevronDown,
  ChevronUp,
  Search,
  Lock,
  X,
  GripVertical,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface ColumnDefinition {
  id: string;
  label: string;
  category: "recommended" | "performance" | "viewability" | "conversions" | "setup";
  description?: string;
  locked?: boolean;
}

export const ALL_AVAILABLE_COLUMNS: ColumnDefinition[] = [
  // Locked Base Columns
  { id: "campaign", label: "Campaign", category: "recommended", locked: true },
  { id: "budget", label: "Budget", category: "recommended", locked: true },
  { id: "status", label: "Status", category: "recommended", locked: true },

  // Recommended columns
  { id: "optimization_score", label: "Optimization score", category: "recommended" },
  { id: "bid_strategy_type", label: "Bid strategy type", category: "recommended" },
  { id: "clicks", label: "Clicks", category: "recommended" },
  { id: "conv_rate", label: "Conv. rate", category: "recommended" },
  { id: "conversions", label: "Conversions", category: "recommended" },
  { id: "avg_cpc", label: "Avg. CPC", category: "recommended" },
  { id: "cost_conv", label: "Cost / conv.", category: "recommended" },

  // Performance columns
  { id: "cost", label: "Cost", category: "performance" },
  { id: "impr", label: "Impr.", category: "performance" },
  { id: "ctr", label: "CTR", category: "performance" },
  { id: "interactions", label: "Interactions", category: "performance" },
  { id: "interaction_rate", label: "Interaction rate", category: "performance" },
  { id: "engagements", label: "Engagements", category: "performance" },
  { id: "engagement_rate", label: "Engagement rate", category: "performance" },
  { id: "invalid_clicks", label: "Invalid clicks", category: "performance" },
  { id: "invalid_click_rate", label: "Invalid click rate", category: "performance" },
  { id: "invalid_interactions", label: "Invalid interactions", category: "performance" },
  { id: "invalid_interaction_rate", label: "Invalid interaction rate", category: "performance" },
  { id: "general_invalid_clicks", label: "General invalid clicks", category: "performance" },
  { id: "avg_cost", label: "Avg. cost", category: "performance" },
  { id: "general_invalid_click_rate", label: "General invalid click rate", category: "performance" },
  { id: "avg_cpe", label: "Avg. CPE", category: "performance" },
  { id: "avg_target_cpa", label: "Avg. target CPA", category: "performance" },
  { id: "avg_target_roas", label: "Avg. target ROAS", category: "performance" },
  { id: "avg_target_cost_in_app", label: "Avg. target cost per in-app action", category: "performance" },
  { id: "trueview_view_rate", label: "TrueView view rate: In-stream, In-feed, Shorts", category: "performance" },
  { id: "impr_abs_top", label: "Impr. (Abs. Top) %", category: "performance" },
  { id: "impr_top", label: "Impr. (Top) %", category: "performance" },
  { id: "unique_search_clicks", label: "Unique search categories with clicks", category: "performance" },
  { id: "unique_search_conv", label: "Unique search categories with conversions", category: "performance" },
  { id: "unique_search_impr", label: "Unique search categories with impressions", category: "performance" },

  // Viewability columns
  { id: "viewable_impr", label: "Viewable impr.", category: "viewability" },
  { id: "non_viewable_impr", label: "Non-viewable impr.", category: "viewability" },
  { id: "measurable_impr", label: "Measurable impr.", category: "viewability" },
  { id: "non_measurable_impr", label: "Non-measurable impr.", category: "viewability" },
  { id: "measurable_cost", label: "Measurable cost", category: "viewability" },
  { id: "measurable_rate", label: "Measurable rate", category: "viewability" },
  { id: "avg_viewable_cpm", label: "Avg. viewable CPM", category: "viewability" },
  { id: "viewable_ctr", label: "Viewable CTR", category: "viewability" },
  { id: "viewable_impr_distrib", label: "Viewable impr. distrib.", category: "viewability" },
  { id: "non_viewable_impr_distrib", label: "Non-viewable impr. distrib.", category: "viewability" },
  { id: "non_measurable_impr_distrib", label: "Non-measurable impr. distrib.", category: "viewability" },
  { id: "viewable_click_rate", label: "Viewable click rate", category: "viewability" },

  // Conversions columns
  { id: "conv_value", label: "Conv. value", category: "conversions" },
  { id: "results", label: "Results", category: "conversions" },
  { id: "results_value", label: "Results value", category: "conversions" },
  { id: "purchase", label: "Purchase", category: "conversions" },
  { id: "signup", label: "Signup", category: "conversions" },
  { id: "submit_lead_form", label: "Submit lead form", category: "conversions" },

  // Setup columns
  { id: "num_eligible_ads", label: "Number of eligible ads", category: "setup" },
  { id: "num_disapproved_ads", label: "Number of disapproved ads", category: "setup" },
  { id: "num_eligible_keywords", label: "Number of eligible keywords", category: "setup" },
  { id: "num_disapproved_keywords", label: "Number of disapproved keywords", category: "setup" },
  { id: "num_eligible_ad_groups", label: "Number of eligible ad groups", category: "setup" },
  { id: "num_eligible_rsa", label: "Number of eligible responsive search ads", category: "setup" },
  { id: "ad_strength_details", label: "Ad strength details", category: "setup" },
  { id: "num_sitelinks_legacy", label: "Number of eligible sitelinks (legacy)", category: "setup" },
  { id: "num_sitelinks_upgraded", label: "Number of eligible sitelinks (upgraded)", category: "setup" },
  { id: "num_images_legacy", label: "Number of eligible images (legacy)", category: "setup" },
  { id: "num_images_upgraded", label: "Number of eligible images (upgraded)", category: "setup" },
];

export const DEFAULT_SELECTED_COLUMN_IDS = [
  "campaign",
  "budget",
  "status",
  "cost",
  "clicks",
  "impr",
  "conversions",
  "avg_cpc",
  "avg_target_roas",
];

interface ColumnsCustomizerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedColumnIds: string[];
  onApply: (columnIds: string[]) => void;
}

export function ColumnsCustomizerDialog({
  open,
  onOpenChange,
  selectedColumnIds,
  onApply,
}: ColumnsCustomizerDialogProps) {
  const [currentSelected, setCurrentSelected] = useState<string[]>(selectedColumnIds);
  const [searchQuery, setSearchQuery] = useState("");
  const [showRecommended, setShowRecommended] = useState(true);
  const [saveSetName, setSaveSetName] = useState(false);

  // Accordion section states
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    recommended: true,
    performance: true,
    viewability: false,
    conversions: true,
    setup: false,
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleToggleColumn = (id: string) => {
    const col = ALL_AVAILABLE_COLUMNS.find((c) => c.id === id);
    if (col?.locked) return; // Cannot toggle locked columns

    if (currentSelected.includes(id)) {
      setCurrentSelected((prev) => prev.filter((item) => item !== id));
    } else {
      setCurrentSelected((prev) => [...prev, id]);
    }
  };

  const handleRemoveFromSelected = (id: string) => {
    const col = ALL_AVAILABLE_COLUMNS.find((c) => c.id === id);
    if (col?.locked) return;
    setCurrentSelected((prev) => prev.filter((item) => item !== id));
  };

  const handleResetToDefault = () => {
    setCurrentSelected(DEFAULT_SELECTED_COLUMN_IDS);
  };

  const handleApply = () => {
    onApply(currentSelected);
    onOpenChange(false);
  };

  const filterColumns = (category: string) => {
    return ALL_AVAILABLE_COLUMNS.filter((col) => {
      if (col.category !== category) return false;
      if (col.locked) return false; // Handled in right panel
      if (!searchQuery.trim()) return true;
      return col.label.toLowerCase().includes(searchQuery.trim().toLowerCase());
    });
  };

  const selectedColumnObjects = currentSelected
    .map((id) => ALL_AVAILABLE_COLUMNS.find((c) => c.id === id))
    .filter(Boolean) as ColumnDefinition[];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden border border-border bg-card shadow-2xl rounded-2xl sm:max-w-5xl">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border bg-muted/20">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-[17px] font-semibold text-foreground">
              Modify columns for campaigns
            </DialogTitle>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search metrics..."
                  className="h-8 pl-8 pr-3 text-[12.5px] rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground outline-none focus:border-primary w-48 transition-all"
                />
              </div>
              <button
                type="button"
                onClick={handleResetToDefault}
                className="flex items-center gap-1 text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer px-2 py-1 rounded"
              >
                <RotateCcw className="h-3 w-3" /> Reset
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* Main Content Area */}
        <div className="grid grid-cols-12 h-[560px] divide-x divide-border">
          {/* Left Column: Metric Categories Accordion */}
          <div className="col-span-8 overflow-y-auto p-6 space-y-6">
            {/* Recommended columns section */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => toggleSection("recommended")}
                className="flex items-center justify-between w-full text-left font-semibold text-[14px] text-foreground hover:text-primary transition-colors cursor-pointer"
              >
                <span>Recommended columns</span>
                {openSections.recommended ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              {openSections.recommended && (
                <div className="grid grid-cols-3 gap-2.5 pt-1">
                  {filterColumns("recommended").map((col) => {
                    const isChecked = currentSelected.includes(col.id);
                    return (
                      <label
                        key={col.id}
                        className={cn(
                          "flex items-center gap-2.5 p-2 rounded-lg border text-[12.5px] cursor-pointer transition-all",
                          isChecked
                            ? "border-primary/50 bg-primary/5 font-medium text-foreground"
                            : "border-border bg-card hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleColumn(col.id)}
                          className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20 accent-[#1F57F5]"
                        />
                        <span className="truncate">{col.label}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Performance section */}
            <div className="space-y-3 pt-2 border-t border-border/60">
              <button
                type="button"
                onClick={() => toggleSection("performance")}
                className="flex items-center justify-between w-full text-left font-semibold text-[14px] text-foreground hover:text-primary transition-colors cursor-pointer"
              >
                <span>Performance</span>
                {openSections.performance ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              {openSections.performance && (
                <div className="grid grid-cols-3 gap-2.5 pt-1">
                  {filterColumns("performance").map((col) => {
                    const isChecked = currentSelected.includes(col.id);
                    return (
                      <label
                        key={col.id}
                        className={cn(
                          "flex items-center gap-2.5 p-2 rounded-lg border text-[12.5px] cursor-pointer transition-all",
                          isChecked
                            ? "border-primary/50 bg-primary/5 font-medium text-foreground"
                            : "border-border bg-card hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleColumn(col.id)}
                          className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20 accent-[#1F57F5]"
                        />
                        <span className="truncate" title={col.label}>{col.label}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Conversions section */}
            <div className="space-y-3 pt-2 border-t border-border/60">
              <button
                type="button"
                onClick={() => toggleSection("conversions")}
                className="flex items-center justify-between w-full text-left font-semibold text-[14px] text-foreground hover:text-primary transition-colors cursor-pointer"
              >
                <span>Conversions & Results</span>
                {openSections.conversions ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              {openSections.conversions && (
                <div className="grid grid-cols-3 gap-2.5 pt-1">
                  {filterColumns("conversions").map((col) => {
                    const isChecked = currentSelected.includes(col.id);
                    return (
                      <label
                        key={col.id}
                        className={cn(
                          "flex items-center gap-2.5 p-2 rounded-lg border text-[12.5px] cursor-pointer transition-all",
                          isChecked
                            ? "border-primary/50 bg-primary/5 font-medium text-foreground"
                            : "border-border bg-card hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleColumn(col.id)}
                          className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20 accent-[#1F57F5]"
                        />
                        <span className="truncate" title={col.label}>{col.label}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Viewability section */}
            <div className="space-y-3 pt-2 border-t border-border/60">
              <button
                type="button"
                onClick={() => toggleSection("viewability")}
                className="flex items-center justify-between w-full text-left font-semibold text-[14px] text-foreground hover:text-primary transition-colors cursor-pointer"
              >
                <span>Viewability</span>
                {openSections.viewability ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              {openSections.viewability && (
                <div className="grid grid-cols-3 gap-2.5 pt-1">
                  {filterColumns("viewability").map((col) => {
                    const isChecked = currentSelected.includes(col.id);
                    return (
                      <label
                        key={col.id}
                        className={cn(
                          "flex items-center gap-2.5 p-2 rounded-lg border text-[12.5px] cursor-pointer transition-all",
                          isChecked
                            ? "border-primary/50 bg-primary/5 font-medium text-foreground"
                            : "border-border bg-card hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleColumn(col.id)}
                          className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20 accent-[#1F57F5]"
                        />
                        <span className="truncate" title={col.label}>{col.label}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Setup section */}
            <div className="space-y-3 pt-2 border-t border-border/60">
              <button
                type="button"
                onClick={() => toggleSection("setup")}
                className="flex items-center justify-between w-full text-left font-semibold text-[14px] text-foreground hover:text-primary transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span>Setup</span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-600 uppercase">
                    NEW
                  </span>
                </div>
                {openSections.setup ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              {openSections.setup && (
                <div className="grid grid-cols-3 gap-2.5 pt-1">
                  {filterColumns("setup").map((col) => {
                    const isChecked = currentSelected.includes(col.id);
                    return (
                      <label
                        key={col.id}
                        className={cn(
                          "flex items-center gap-2.5 p-2 rounded-lg border text-[12.5px] cursor-pointer transition-all",
                          isChecked
                            ? "border-primary/50 bg-primary/5 font-medium text-foreground"
                            : "border-border bg-card hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleColumn(col.id)}
                          className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20 accent-[#1F57F5]"
                        />
                        <span className="truncate" title={col.label}>{col.label}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: "Your columns" list with drag/lock */}
          <div className="col-span-4 flex flex-col h-full bg-muted/10 p-5">
            <div className="mb-3">
              <h4 className="text-[13.5px] font-semibold text-foreground">Your columns</h4>
              <p className="text-[11.5px] text-muted-foreground">
                Drag and drop to reorder columns in your table
              </p>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {selectedColumnObjects.map((col) => (
                <div
                  key={col.id}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 rounded-lg border text-[12.5px] select-none transition-all",
                    col.locked
                      ? "bg-muted/40 border-border text-muted-foreground"
                      : "bg-card border-border shadow-2xs hover:border-primary/40 text-foreground"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {col.locked ? (
                      <Lock className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
                    ) : (
                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground cursor-grab shrink-0" />
                    )}
                    <span className="truncate font-medium">{col.label}</span>
                  </div>

                  {!col.locked && (
                    <button
                      type="button"
                      onClick={() => handleRemoveFromSelected(col.id)}
                      className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                      aria-label={`Remove ${col.label}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Custom set name option */}
            <div className="pt-3 border-t border-border mt-3 space-y-2 text-[12px]">
              <label className="flex items-center gap-2 text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveSetName}
                  onChange={(e) => setSaveSetName(e.target.checked)}
                  className="rounded border-border accent-[#1F57F5]"
                />
                <span>Save your column set</span>
              </label>

              <div className="flex items-center justify-between text-muted-foreground pt-1">
                <span>Show recommended columns</span>
                <input
                  type="checkbox"
                  checked={showRecommended}
                  onChange={(e) => setShowRecommended(e.target.checked)}
                  className="rounded border-border accent-[#1F57F5]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/20">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="cursor-pointer"
          >
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleApply}
              className="bg-[#1F57F5] hover:bg-[#1F57F5]/90 text-white font-semibold px-6 cursor-pointer"
            >
              Apply
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
