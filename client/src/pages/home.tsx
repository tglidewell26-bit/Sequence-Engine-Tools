import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Copy, Check, Sparkles, Pencil, Save, BookmarkPlus, BookmarkCheck, ChevronDown, ChevronUp, FileText, Calendar as CalendarIcon, Plus, X } from "lucide-react";
import type { SequenceSections, SelectedAssets } from "@shared/schema";
import type { DateRange } from "react-day-picker";
import { addDays, format, isSameDay } from "date-fns";

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
  selectedAssetsEmail2: SelectedAssets | null;
  name: string;
  instrument: string;
  rawInput: string;
  researchBrief?: string;
}

type Meridiem = "AM" | "PM";

interface TimeValue {
  hour: string;
  minute: string;
  meridiem: Meridiem;
}

interface TimeRange {
  id: string;
  start: TimeValue;
  end: TimeValue;
}

const HOURS = Array.from({ length: 12 }, (_, index) => String(index + 1));
const MINUTES = ["00", "15", "30", "45"];

const defaultTimeValue = (): TimeValue => ({ hour: "9", minute: "00", meridiem: "AM" });

const defaultTimeRange = (): TimeRange => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  start: defaultTimeValue(),
  end: { hour: "5", minute: "00", meridiem: "PM" },
});

function getDatesInRange(range?: DateRange): Date[] {
  if (!range?.from) return [];
  if (!range.to) return [range.from];

  const dates: Date[] = [];
  let current = range.from;
  while (current <= range.to) {
    dates.push(current);
    current = addDays(current, 1);
  }
  return dates;
}

const formatTimeValue = ({ hour, minute, meridiem }: TimeValue): string => `${hour}:${minute} ${meridiem}`;

export default function Home() {
  const [leadIntel, setLeadIntel] = useState("");
  const [sequenceName, setSequenceName] = useState("");
  const [availabilityBlock, setAvailabilityBlock] = useState("");
  const [availabilityRange, setAvailabilityRange] = useState<DateRange | undefined>();
  const [dailyAvailability, setDailyAvailability] = useState<Record<string, TimeRange[]>>({});
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [briefExpanded, setBriefExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.max(200, textareaRef.current.scrollHeight)}px`;
    }
  }, [leadIntel]);

  useEffect(() => {
    const selectedDates = getDatesInRange(availabilityRange);

    setDailyAvailability((previous) => {
      const next: Record<string, TimeRange[]> = {};
      for (const date of selectedDates) {
        const key = format(date, "yyyy-MM-dd");
        next[key] = previous[key] && previous[key].length > 0 ? previous[key] : [defaultTimeRange()];
      }
      return next;
    });

    if (!availabilityRange?.from) {
      setAvailabilityBlock("");
    }
  }, [availabilityRange]);

  useEffect(() => {
    if (!availabilityRange?.from) {
      setAvailabilityBlock("");
      return;
    }

    const selectedDates = getDatesInRange(availabilityRange);
    if (!selectedDates.length) {
      setAvailabilityBlock("");
      return;
    }

    const from = format(availabilityRange.from, "EEEE, MMMM d");
    const toDate = availabilityRange.to;
    const to = toDate ? format(toDate, "EEEE, MMMM d") : null;
    const headerLine = toDate && !isSameDay(availabilityRange.from, toDate)
      ? `I'll be in town on ${from} through ${to}.`
      : `I'll be in town on ${from}.`;

    const dayLines = selectedDates.map((date) => {
      const key = format(date, "yyyy-MM-dd");
      const ranges = dailyAvailability[key] ?? [];
      const formattedRanges = ranges
        .map((range) => `${formatTimeValue(range.start)}–${formatTimeValue(range.end)}`)
        .join("; ");
      return `${format(date, "EEEE, MMMM d")}: ${formattedRanges || "TBD"}`;
    });

    setAvailabilityBlock([headerLine, "", "Available times:", ...dayLines].join("\n"));
  }, [availabilityRange, dailyAvailability]);

  const selectedDates = getDatesInRange(availabilityRange);

  const updateTimeRange = (
    dateKey: string,
    rangeId: string,
    field: "start" | "end",
    timeField: keyof TimeValue,
    value: string,
  ) => {
    setDailyAvailability((previous) => ({
      ...previous,
      [dateKey]: (previous[dateKey] ?? []).map((range) => {
        if (range.id !== rangeId) return range;
        return {
          ...range,
          [field]: {
            ...range[field],
            [timeField]: value,
          },
        };
      }),
    }));
  };

  const addTimeRange = (dateKey: string) => {
    setDailyAvailability((previous) => ({
      ...previous,
      [dateKey]: [...(previous[dateKey] ?? []), defaultTimeRange()],
    }));
  };

  const removeTimeRange = (dateKey: string, rangeId: string) => {
    setDailyAvailability((previous) => {
      const existingRanges = previous[dateKey] ?? [];
      if (existingRanges.length <= 1) return previous;

      return {
        ...previous,
        [dateKey]: existingRanges.filter((range) => range.id !== rangeId),
      };
    });
  };

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/sequences/generate", {
        leadIntel,
        name: sequenceName || "Untitled Sequence",
        availabilityBlock: availabilityBlock.trim() || undefined,
      });
      return res.json() as Promise<GenerateResult>;
    },
    onSuccess: (data) => {
      setResult(data);
      setSavedId(null);
      setBriefExpanded(true);
      if (!sequenceName.trim()) {
        setSequenceName(data.name);
      }
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
        researchBrief: result.researchBrief,
        sections: result.sections,
        selectedAssets: result.selectedAssets,
        selectedAssetsEmail2: result.selectedAssetsEmail2,
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

  const charCount = leadIntel.length;
  const charPercent = (charCount / MAX_CHARS) * 100;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-page-title">Create Sequence</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Paste your lead data from Google Sheets. The engine will research the company, generate a tailored outreach sequence, inject links, insert assets, and produce copy-ready output.
        </p>
      </div>

      <Card className="p-5 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="sequence-name">Sequence Name</Label>
          <Input
            id="sequence-name"
            placeholder="Auto-generated from lead intel (e.g. Vir Biotechnology South San Francisco CosMx)"
            value={sequenceName}
            onChange={(e) => setSequenceName(e.target.value)}
            data-testid="input-sequence-name"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Label htmlFor="lead-intel">Lead Intel</Label>
            <span
              className={`text-xs tabular-nums ${charPercent > 90 ? "text-destructive" : "text-muted-foreground"}`}
              data-testid="text-char-count"
            >
              {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
            </span>
          </div>
          <textarea
            ref={textareaRef}
            id="lead-intel"
            className="flex w-full rounded-md border border-input bg-background text-foreground text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none min-h-[200px] p-3"
            placeholder="Paste your lead data row from Google Sheets here...&#10;&#10;This should include: company name, website, location, overview, deal info, instrument focus, fit notes, and any other intel from your tracking sheet."
            value={leadIntel}
            onChange={(e) => {
              if (e.target.value.length <= MAX_CHARS) setLeadIntel(e.target.value);
            }}
            maxLength={MAX_CHARS}
            data-testid="input-lead-intel"
          />
        </div>

        <div className="space-y-3">
          <Label>Availability</Label>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>I will be in town on</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="justify-start text-left font-normal"
                  data-testid="button-availability-date-range"
                >
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {availabilityRange?.from
                    ? availabilityRange.to
                      ? `${format(availabilityRange.from, "MMM d, yyyy")} - ${format(availabilityRange.to, "MMM d, yyyy")}`
                      : format(availabilityRange.from, "MMM d, yyyy")
                    : "Select date range"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={availabilityRange}
                  onSelect={setAvailabilityRange}
                  numberOfMonths={2}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {selectedDates.length > 0 && (
            <div className="space-y-3 rounded-md border p-3">
              {selectedDates.map((date) => {
                const dateKey = format(date, "yyyy-MM-dd");
                const timeRanges = dailyAvailability[dateKey] ?? [];

                return (
                  <div key={dateKey} className="space-y-2 rounded-md border p-3">
                    <p className="font-medium text-sm">{format(date, "EEEE, MMMM d")}</p>
                    {timeRanges.map((range, index) => (
                      <div key={range.id} className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto] items-end gap-3">
                        <TimeValueFields
                          label="Start time"
                          prefix={`start-${dateKey}-${index}`}
                          value={range.start}
                          onChange={(timeField, value) => updateTimeRange(dateKey, range.id, "start", timeField, value)}
                        />
                        <span className="text-muted-foreground text-sm md:pb-2">to</span>
                        <TimeValueFields
                          label="End time"
                          prefix={`end-${dateKey}-${index}`}
                          value={range.end}
                          onChange={(timeField, value) => updateTimeRange(dateKey, range.id, "end", timeField, value)}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeTimeRange(dateKey, range.id)}
                          disabled={timeRanges.length <= 1}
                          data-testid={`button-remove-time-range-${dateKey}-${index}`}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addTimeRange(dateKey)}
                      data-testid={`button-add-time-range-${dateKey}`}
                    >
                      <Plus className="w-4 h-4 mr-2" /> Add another time range
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          <Textarea
            id="availability-block"
            value={availabilityBlock}
            readOnly
            className="min-h-[120px] resize-none"
            data-testid="input-availability-block"
          />
          <p className="text-xs text-muted-foreground">This availability summary is auto-generated and injected into emails 1–3.</p>
        </div>

        <Button
          className="w-full"
          onClick={() => generateMutation.mutate()}
          disabled={!leadIntel.trim() || generateMutation.isPending}
          data-testid="button-generate"
        >
          {generateMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Researching & Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" /> Generate Sequence
            </>
          )}
        </Button>
      </Card>

      {result && result.researchBrief && (
        <Card className="p-5" data-testid="card-research-brief">
          <button
            className="w-full flex items-center justify-between gap-2 text-left"
            onClick={() => setBriefExpanded(!briefExpanded)}
            data-testid="button-toggle-research-brief"
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-base font-semibold">Research Brief</h2>
            </div>
            {briefExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {briefExpanded && (
            <div className="mt-4 bg-muted/50 rounded-md p-4 text-sm whitespace-pre-wrap leading-relaxed" data-testid="text-research-brief">
              {result.researchBrief}
            </div>
          )}
        </Card>
      )}

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
            const emailAssets = key === "email1" ? result.selectedAssets
              : key === "email2" ? result.selectedAssetsEmail2
              : null;
            const hasAttachments = !!emailAssets &&
              (emailAssets.documents.length > 0 || !!emailAssets.image);

            return (
              <SectionCard
                key={key}
                sectionKey={key}
                label={label}
                section={section}
                hasAttachments={hasAttachments}
                selectedAssets={emailAssets}
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

function TimeValueFields({
  label,
  prefix,
  value,
  onChange,
}: {
  label: string;
  prefix: string;
  value: TimeValue;
  onChange: (field: keyof TimeValue, value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={`${prefix}-hour`} className="text-xs text-muted-foreground">{label}</Label>
      <div className="grid grid-cols-3 gap-2">
        <Select value={value.hour} onValueChange={(selected) => onChange("hour", selected)}>
          <SelectTrigger id={`${prefix}-hour`} data-testid={`${prefix}-hour`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HOURS.map((hour) => (
              <SelectItem key={hour} value={hour}>{hour}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={value.minute} onValueChange={(selected) => onChange("minute", selected)}>
          <SelectTrigger data-testid={`${prefix}-minute`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MINUTES.map((minute) => (
              <SelectItem key={minute} value={minute}>{minute}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={value.meridiem} onValueChange={(selected) => onChange("meridiem", selected)}>
          <SelectTrigger data-testid={`${prefix}-meridiem`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AM">AM</SelectItem>
            <SelectItem value="PM">PM</SelectItem>
          </SelectContent>
        </Select>
      </div>
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
