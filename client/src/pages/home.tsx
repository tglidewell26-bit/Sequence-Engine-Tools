import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Copy, Check, Sparkles } from "lucide-react";
import type { SequenceSections, SelectedAssets } from "@shared/schema";

const MAX_CHARS = 50000;

const SECTION_ORDER: { key: string; label: string }[] = [
  { key: "email1", label: "Email 1" },
  { key: "email2", label: "Email 2" },
  { key: "linkedinConnection", label: "LinkedIn Connection" },
  { key: "linkedinMessage", label: "LinkedIn Message" },
  { key: "email3", label: "Email 3" },
  { key: "email4", label: "Email 4" },
];

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

interface GenerateResult {
  sections: SequenceSections;
  selectedAssets: SelectedAssets | null;
  sequenceId: number;
}

export default function Home() {
  const [rawInput, setRawInput] = useState("");
  const [sequenceName, setSequenceName] = useState("");
  const [availabilityWindow, setAvailabilityWindow] = useState("");
  const [timeRanges, setTimeRanges] = useState("");
  const [instrumentOverride, setInstrumentOverride] = useState("");
  const [result, setResult] = useState<GenerateResult | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

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
        availabilityWindow: availabilityWindow.trim() || undefined,
        timeRanges: timeRanges.trim() || undefined,
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

        <div className="space-y-2">
          <Label htmlFor="availability-window">Availability Window</Label>
          <Input
            id="availability-window"
            placeholder="e.g. the week of March 3rd, or March 3–7"
            value={availabilityWindow}
            onChange={(e) => setAvailabilityWindow(e.target.value)}
            data-testid="input-availability-window"
          />
          <p className="text-xs text-muted-foreground">When you're available to meet. Gets injected into your emails as-is.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="time-ranges">Time Ranges</Label>
          <Textarea
            id="time-ranges"
            placeholder={"e.g. 10am–4pm\nor: 10am–1pm, 2pm–3pm\nor one per line for multiple days"}
            value={timeRanges}
            onChange={(e) => setTimeRanges(e.target.value)}
            className="min-h-[60px] resize-none"
            data-testid="input-time-ranges"
          />
          <p className="text-xs text-muted-foreground">Type your available times however feels natural. Each line becomes a separate entry.</p>
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
          {SECTION_ORDER.map(({ key, label }) => {
            const section = result.sections[key];
            if (!section) return null;
            const isEmail1 = key === "email1";
            const hasAttachments = isEmail1 && result.selectedAssets &&
              (result.selectedAssets.documents.length > 0 || result.selectedAssets.image);

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

                {hasAttachments && result.selectedAssets && (
                  <div className="space-y-1" data-testid="section-attachments">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Attachments</Label>
                    <div className="bg-muted/50 rounded-md p-3 text-sm space-y-1">
                      {result.selectedAssets.image && (
                        <div className="flex items-center gap-2" data-testid="text-attached-image">
                          <span className="inline-block w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                          <span>Image: {result.selectedAssets.image}</span>
                        </div>
                      )}
                      {result.selectedAssets.documents.map((doc, i) => (
                        <div key={i} className="flex items-center gap-2" data-testid={`text-attached-doc-${i}`}>
                          <span className="inline-block w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                          <span>{doc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
    '<span class="inline-block bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded px-2 py-0.5 text-xs font-medium">Image: $1</span>'
  );

  html = html.replace(
    /\(https?:\/\/[^\s<)]+\)/g,
    '<span class="text-muted-foreground">$&</span>'
  );

  html = html.replace(
    /\*\*(.+?)\*\*/g,
    "<strong>$1</strong>"
  );

  return html;
}
