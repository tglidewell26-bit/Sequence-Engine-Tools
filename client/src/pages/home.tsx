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
import { Loader2, Copy, Check, Sparkles, Pencil, Save, BookmarkPlus, BookmarkCheck } from "lucide-react";
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

function copyRichText(html: string, plainText: string): Promise<void> {
  const htmlContent = html.replace(/\n/g, "<br>");
  const blob = new Blob([htmlContent], { type: "text/html" });
  const textBlob = new Blob([plainText], { type: "text/plain" });
  const item = new ClipboardItem({
    "text/html": blob,
    "text/plain": textBlob,
  });
  return navigator.clipboard.write([item]);
}

function CopyButton({ text, label, isBody }: { text: string; label: string; isBody?: boolean }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    if (isBody) {
      const plainText = text.replace(/<a\s+href="[^"]*">([^<]*)<\/a>/g, "$1");
      await copyRichText(text, plainText);
    } else {
      await navigator.clipboard.writeText(text);
    }
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
  name: string;
  instrument: string;
  rawInput: string;
  availabilityWindow?: string;
  timeRanges?: string;
}

export default function Home() {
  const [rawInput, setRawInput] = useState("");
  const [sequenceName, setSequenceName] = useState("");
  const [availabilityWindow, setAvailabilityWindow] = useState("");
  const [timeRanges, setTimeRanges] = useState("");
  const [instrumentOverride, setInstrumentOverride] = useState("");
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);
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
      setSavedId(null);
      toast({ title: "Sequence generated — review output and click Save when ready" });
    },
    onError: (err: Error) => {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!result) throw new Error("No sequence to save");
      const res = await apiRequest("POST", "/api/sequences/save", {
        name: result.name,
        instrument: result.instrument,
        rawInput: result.rawInput,
        availabilityWindow: result.availabilityWindow,
        timeRanges: result.timeRanges,
        sections: result.sections,
        selectedAssets: result.selectedAssets,
      });
      return res.json() as Promise<{ id: number }>;
    },
    onSuccess: (data) => {
      setSavedId(data.id);
      queryClient.invalidateQueries({ queryKey: ["/api/sequences"] });
      toast({ title: "Sequence saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
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
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-lg font-semibold">Generated Output</h2>
            {savedId ? (
              <Button variant="outline" disabled data-testid="button-saved">
                <BookmarkCheck className="w-4 h-4 mr-2" /> Saved
              </Button>
            ) : (
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                data-testid="button-save-sequence"
              >
                {saveMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                ) : (
                  <><BookmarkPlus className="w-4 h-4 mr-2" /> Save Sequence</>
                )}
              </Button>
            )}
          </div>
          {SECTION_ORDER.map(({ key, label }) => {
            const section = result.sections[key];
            if (!section) return null;
            const isEmail1 = key === "email1";
            const hasAttachments = isEmail1 && result.selectedAssets &&
              (result.selectedAssets.documents.length > 0 || result.selectedAssets.image);

            return (
              <SectionCard
                key={key}
                sectionKey={key}
                label={label}
                section={section}
                hasAttachments={!!hasAttachments}
                selectedAssets={result.selectedAssets}
                onUpdate={(field, value) => {
                  setResult(prev => {
                    if (!prev) return prev;
                    return {
                      ...prev,
                      sections: {
                        ...prev.sections,
                        [key]: { ...prev.sections[key], [field]: value },
                      },
                    };
                  });
                }}
                sequenceId={savedId}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function SectionCard({
  sectionKey,
  label,
  section,
  hasAttachments,
  selectedAssets,
  onUpdate,
  sequenceId,
}: {
  sectionKey: string;
  label: string;
  section: { subject?: string; body: string };
  hasAttachments: boolean;
  selectedAssets: SelectedAssets | null;
  onUpdate: (field: "subject" | "body", value: string) => void;
  sequenceId: number | null;
}) {
  const [editingSubject, setEditingSubject] = useState(false);
  const [editingBody, setEditingBody] = useState(false);
  const [subjectDraft, setSubjectDraft] = useState("");
  const [bodyDraft, setBodyDraft] = useState("");
  const { toast } = useToast();
  const bodyEditRef = useRef<HTMLTextAreaElement>(null);

  const persistEdit = async (field: "subject" | "body", newVal: string) => {
    if (!sequenceId) return;
    try {
      const res = await apiRequest("GET", `/api/sequences/${sequenceId}`);
      const seq = await res.json();
      const sections = seq.sections;
      sections[sectionKey][field] = newVal;
      await apiRequest("PATCH", `/api/sequences/${sequenceId}`, { sections });
      queryClient.invalidateQueries({ queryKey: ["/api/sequences"] });
    } catch {}
  };

  const startEditSubject = () => {
    setSubjectDraft(section.subject || "");
    setEditingSubject(true);
  };

  const saveSubject = () => {
    onUpdate("subject", subjectDraft);
    persistEdit("subject", subjectDraft);
    setEditingSubject(false);
    toast({ title: `${label} subject updated` });
  };

  const startEditBody = () => {
    setBodyDraft(section.body.replace(/<a\s+href="[^"]*">([^<]*)<\/a>/g, "$1"));
    setEditingBody(true);
    setTimeout(() => {
      if (bodyEditRef.current) {
        bodyEditRef.current.style.height = "auto";
        bodyEditRef.current.style.height = `${bodyEditRef.current.scrollHeight}px`;
      }
    }, 0);
  };

  const saveBody = () => {
    onUpdate("body", bodyDraft);
    persistEdit("body", bodyDraft);
    setEditingBody(false);
    toast({ title: `${label} body updated` });
  };

  return (
    <Card className="p-5 space-y-4" data-testid={`card-section-${sectionKey}`}>
      <h3 className="font-semibold text-base">{label}</h3>

      {section.subject !== undefined && (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Subject</Label>
            <div className="flex items-center gap-1">
              {editingSubject ? (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={saveSubject}
                  data-testid={`button-save-subject-${sectionKey}`}
                >
                  <Save className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={startEditSubject}
                  data-testid={`button-edit-subject-${sectionKey}`}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
              )}
              <CopyButton text={section.subject || ""} label={`${label} Subject`} />
            </div>
          </div>
          {editingSubject ? (
            <Input
              value={subjectDraft}
              onChange={(e) => setSubjectDraft(e.target.value)}
              className="text-sm font-medium"
              data-testid={`input-edit-subject-${sectionKey}`}
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") saveSubject(); }}
            />
          ) : (
            <div
              className="bg-muted/50 rounded-md p-3 text-sm font-medium"
              data-testid={`text-subject-${sectionKey}`}
            >
              {section.subject}
            </div>
          )}
        </div>
      )}

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Body</Label>
          <div className="flex items-center gap-1">
            {editingBody ? (
              <Button
                size="icon"
                variant="ghost"
                onClick={saveBody}
                data-testid={`button-save-body-${sectionKey}`}
              >
                <Save className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                size="icon"
                variant="ghost"
                onClick={startEditBody}
                data-testid={`button-edit-body-${sectionKey}`}
              >
                <Pencil className="w-4 h-4" />
              </Button>
            )}
            <CopyButton text={section.body} label={`${label} Body`} isBody />
          </div>
        </div>
        {editingBody ? (
          <textarea
            ref={bodyEditRef}
            value={bodyDraft}
            onChange={(e) => {
              setBodyDraft(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            className="flex w-full rounded-md border border-input bg-background text-foreground text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none min-h-[120px] p-3 leading-relaxed"
            data-testid={`input-edit-body-${sectionKey}`}
          />
        ) : (
          <div
            className="bg-muted/50 rounded-md p-3 text-sm whitespace-pre-wrap leading-relaxed"
            data-testid={`text-body-${sectionKey}`}
            dangerouslySetInnerHTML={{ __html: formatBodyHtml(section.body) }}
          />
        )}
      </div>

      {hasAttachments && selectedAssets && (
        <div className="space-y-1" data-testid="section-attachments">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Attachments</Label>
          <div className="bg-muted/50 rounded-md p-3 text-sm space-y-1">
            {selectedAssets.image && (
              <div className="flex items-center gap-2" data-testid="text-attached-image">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                <span>Image: {selectedAssets.image}</span>
              </div>
            )}
            {selectedAssets.documents.map((doc, i) => (
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
}

const TRUSTED_LINK_DOMAINS = [
  "brukerspatialbiology.com",
  "nanostring.com",
];

function isTrustedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return TRUSTED_LINK_DOMAINS.some(d => parsed.hostname === d || parsed.hostname.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

function formatBodyHtml(body: string): string {
  const linkPlaceholders: string[] = [];
  let temp = body.replace(/<a\s+href="([^"]+)">([^<]+)<\/a>/g, (_match, url, text) => {
    if (!isTrustedUrl(url)) {
      return text;
    }
    const idx = linkPlaceholders.length;
    const safeUrl = url.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    const safeText = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    linkPlaceholders.push(`<a href="${safeUrl}" class="text-blue-600 dark:text-blue-400 underline" target="_blank" rel="noopener noreferrer">${safeText}</a>`);
    return `__LINK_PLACEHOLDER_${idx}__`;
  });

  const boldPlaceholders: string[] = [];
  temp = temp.replace(/<strong>([^<]+)<\/strong>/g, (_match, text) => {
    const idx = boldPlaceholders.length;
    boldPlaceholders.push(text);
    return `__BOLD_PLACEHOLDER_${idx}__`;
  });

  let html = temp
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  html = html.replace(
    /\[Insert Image: (.+?)\]/g,
    '<span class="inline-block bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded px-2 py-0.5 text-xs font-medium">Image: $1</span>'
  );

  html = html.replace(
    /\*\*(.+?)\*\*/g,
    "<strong>$1</strong>"
  );

  for (let i = 0; i < boldPlaceholders.length; i++) {
    const safeText = boldPlaceholders[i].replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    html = html.replace(`__BOLD_PLACEHOLDER_${i}__`, `<strong>${safeText}</strong>`);
  }

  for (let i = 0; i < linkPlaceholders.length; i++) {
    html = html.replace(`__LINK_PLACEHOLDER_${i}__`, linkPlaceholders[i]);
  }

  return html;
}
