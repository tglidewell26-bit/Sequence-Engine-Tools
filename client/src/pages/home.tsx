import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Copy, Check, Plus, Trash2, Sparkles } from "lucide-react";
import type { SequenceSections, SelectedAssets } from "@shared/schema";

const MAX_CHARS = 50000;

const SECTION_LABELS: Record<string, string> = {
  email1: "Email 1",
  email2: "Email 2",
  linkedinConnection: "LinkedIn Connection",
  linkedinMessage: "LinkedIn Message",
  email3: "Email 3",
  email4: "Email 4",
};

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: `${label} copied to clipboard` });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={handleCopy}
      data-testid={`button-copy-${label.toLowerCase().replace(/\s/g, "-")}`}
    >
      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
    </Button>
  );
}

interface TimeSlot {
  id: string;
  date: string;
  time: string;
}

interface GenerateResult {
  sections: SequenceSections;
  selectedAssets: SelectedAssets | null;
  sequenceId: number;
}

export default function Home() {
  const [rawInput, setRawInput] = useState("");
  const [sequenceName, setSequenceName] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([
    { id: "1", date: "", time: "" },
  ]);
  const [instrumentOverride, setInstrumentOverride] = useState("");
  const [result, setResult] = useState<GenerateResult | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  const addTimeSlot = () => {
    setTimeSlots([...timeSlots, { id: Date.now().toString(), date: "", time: "" }]);
  };

  const removeTimeSlot = (id: string) => {
    if (timeSlots.length > 1) {
      setTimeSlots(timeSlots.filter((s) => s.id !== id));
    }
  };

  const updateTimeSlot = (id: string, field: "date" | "time", value: string) => {
    setTimeSlots(timeSlots.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.max(200, textareaRef.current.scrollHeight)}px`;
    }
  }, [rawInput]);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/sequences/generate", {
        rawInput,
        name: sequenceName || "Untitled Sequence",
        dateRange: dateFrom && dateTo ? `${dateFrom} to ${dateTo}` : undefined,
        timeSlots: timeSlots.filter((s) => s.date && s.time).map((s) => `${s.date} — ${s.time}`),
        instrumentOverride: instrumentOverride || undefined,
      });
      return res.json() as Promise<GenerateResult>;
    },
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/sequences"] });
      toast({ title: "Sequence generated successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    },
  });

  const charCount = rawInput.length;
  const charPercent = (charCount / MAX_CHARS) * 100;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-page-title">Create Sequence</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Paste your full 6-part outreach sequence below. The engine will parse, format, inject links, insert assets, and produce copy-ready output.
        </p>
      </div>

      <Card className="p-5 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="sequence-name">Sequence Name</Label>
          <Input
            id="sequence-name"
            placeholder="e.g. Q1 GeoMx Oncology Outreach"
            value={sequenceName}
            onChange={(e) => setSequenceName(e.target.value)}
            data-testid="input-sequence-name"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Label htmlFor="raw-input">Sequence Content</Label>
            <span
              className={`text-xs tabular-nums ${charPercent > 90 ? "text-destructive" : "text-muted-foreground"}`}
              data-testid="text-char-count"
            >
              {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
            </span>
          </div>
          <textarea
            ref={textareaRef}
            id="raw-input"
            className="flex w-full rounded-md border border-input bg-background text-foreground text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none min-h-[200px] p-3"
            placeholder={`Paste your full sequence here...\n\nEmail 1\nSubject: ...\nBody: ...\n\nEmail 2\nSubject: ...\nBody: ...\n\nLinkedIn Connection\n...\n\nLinkedIn Message\n...\n\nEmail 3\nSubject: ...\nBody: ...\n\nEmail 4\nSubject: ...\nBody: ...`}
            value={rawInput}
            onChange={(e) => {
              if (e.target.value.length <= MAX_CHARS) setRawInput(e.target.value);
            }}
            maxLength={MAX_CHARS}
            data-testid="input-raw-sequence"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Date From</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              data-testid="input-date-from"
            />
          </div>
          <div className="space-y-2">
            <Label>Date To</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              data-testid="input-date-to"
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Label>Time Slots</Label>
            <Button size="sm" variant="outline" onClick={addTimeSlot} data-testid="button-add-timeslot">
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Slot
            </Button>
          </div>
          <div className="space-y-2">
            {timeSlots.map((slot) => (
              <div key={slot.id} className="flex items-center gap-2 flex-wrap">
                <Input
                  type="date"
                  className="flex-1 min-w-[140px]"
                  value={slot.date}
                  onChange={(e) => updateTimeSlot(slot.id, "date", e.target.value)}
                  data-testid={`input-slot-date-${slot.id}`}
                />
                <Input
                  type="time"
                  className="flex-1 min-w-[120px]"
                  value={slot.time}
                  onChange={(e) => updateTimeSlot(slot.id, "time", e.target.value)}
                  data-testid={`input-slot-time-${slot.id}`}
                />
                {timeSlots.length > 1 && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeTimeSlot(slot.id)}
                    data-testid={`button-remove-slot-${slot.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Instrument Override (optional)</Label>
          <Select value={instrumentOverride} onValueChange={setInstrumentOverride}>
            <SelectTrigger data-testid="select-instrument-override">
              <SelectValue placeholder="Auto-detect from content" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto-detect</SelectItem>
              <SelectItem value="GeoMx">GeoMx</SelectItem>
              <SelectItem value="CosMx">CosMx</SelectItem>
              <SelectItem value="CellScape">CellScape</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          className="w-full"
          onClick={() => generateMutation.mutate()}
          disabled={!rawInput.trim() || generateMutation.isPending}
          data-testid="button-generate"
        >
          {generateMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" /> Generate Sequence
            </>
          )}
        </Button>
      </Card>

      {result && (
        <div className="space-y-4" data-testid="section-output">
          <h2 className="text-lg font-semibold">Generated Output</h2>
          {Object.entries(SECTION_LABELS).map(([key, label]) => {
            const section = result.sections[key];
            if (!section) return null;
            return (
              <Card key={key} className="p-5 space-y-4" data-testid={`card-section-${key}`}>
                <h3 className="font-semibold text-base">{label}</h3>

                {section.subject && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider">Subject</Label>
                      <CopyButton text={section.subject} label={`${label} Subject`} />
                    </div>
                    <div
                      className="bg-muted/50 rounded-md p-3 text-sm font-medium"
                      data-testid={`text-subject-${key}`}
                    >
                      {section.subject}
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Body</Label>
                    <CopyButton text={section.body} label={`${label} Body`} />
                  </div>
                  <div
                    className="bg-muted/50 rounded-md p-3 text-sm whitespace-pre-wrap leading-relaxed"
                    data-testid={`text-body-${key}`}
                    dangerouslySetInnerHTML={{ __html: formatBodyHtml(section.body) }}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatBodyHtml(body: string): string {
  let html = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  html = html.replace(
    /\[Insert Image: (.+?)\]/g,
    '<span class="inline-block bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded px-2 py-0.5 text-xs font-medium">📎 Image: $1</span>'
  );

  html = html.replace(
    /https?:\/\/[^\s<]+/g,
    '<span class="text-primary underline">$&</span>'
  );

  html = html.replace(
    /\*\*(.+?)\*\*/g,
    "<strong>$1</strong>"
  );

  return html;
}
