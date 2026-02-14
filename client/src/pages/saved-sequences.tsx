import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Eye, Pencil, RotateCcw, Trash2, Copy, Check, FileText, Calendar } from "lucide-react";
import type { Sequence, SequenceSections } from "@shared/schema";
import { format } from "date-fns";

const SECTION_ORDER: { key: string; label: string }[] = [
  { key: "email1", label: "Email 1" },
  { key: "email2", label: "Email 2" },
  { key: "linkedinConnection", label: "LinkedIn Connection" },
  { key: "linkedinMessage", label: "LinkedIn Message" },
  { key: "email3", label: "Email 3" },
  { key: "email4", label: "Email 4" },
];

function CopyBtn({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        toast({ title: `${label} copied` });
        setTimeout(() => setCopied(false), 2000);
      }}
      data-testid={`button-copy-${label.toLowerCase().replace(/\s/g, "-")}`}
    >
      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
    </Button>
  );
}

interface ViewDialogProps {
  sequence: Sequence;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function ViewDialog({ sequence, open, onOpenChange }: ViewDialogProps) {
  const sections = sequence.sections as SequenceSections;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{sequence.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {SECTION_ORDER.map(({ key, label }) => {
            const section = sections[key];
            if (!section) return null;
            return (
              <div key={key} className="space-y-2">
                <h3 className="font-semibold text-sm">{label}</h3>
                {section.subject && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">Subject</span>
                      <CopyBtn text={section.subject} label={`${label} Subject`} />
                    </div>
                    <div className="bg-muted/50 rounded-md p-3 text-sm font-medium">
                      {section.subject}
                    </div>
                  </div>
                )}
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Body</span>
                    <CopyBtn text={section.body} label={`${label} Body`} />
                  </div>
                  <div className="bg-muted/50 rounded-md p-3 text-sm whitespace-pre-wrap leading-relaxed">
                    {section.body}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface EditDialogProps {
  sequence: Sequence;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function EditDialog({ sequence, open, onOpenChange }: EditDialogProps) {
  const [editSections, setEditSections] = useState<SequenceSections>(
    sequence.sections as SequenceSections
  );
  const { toast } = useToast();

  const updateMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/sequences/${sequence.id}`, {
        sections: editSections,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sequences"] });
      onOpenChange(false);
      toast({ title: "Sequence updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  const updateField = (sectionKey: string, field: "subject" | "body", value: string) => {
    setEditSections((prev) => ({
      ...prev,
      [sectionKey]: { ...prev[sectionKey], [field]: value },
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit: {sequence.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 mt-2">
          {SECTION_ORDER.map(({ key, label }) => {
            const section = editSections[key];
            if (!section) return null;
            return (
              <div key={key} className="space-y-2">
                <h3 className="font-semibold text-sm">{label}</h3>
                {section.subject !== undefined && (
                  <div className="space-y-1">
                    <Label className="text-xs">Subject</Label>
                    <Input
                      value={section.subject}
                      onChange={(e) => updateField(key, "subject", e.target.value)}
                      data-testid={`input-edit-subject-${key}`}
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-xs">Body</Label>
                  <textarea
                    className="flex w-full rounded-md border border-input bg-background text-foreground text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[100px] p-3 resize-y"
                    value={section.body}
                    onChange={(e) => updateField(key, "body", e.target.value)}
                    data-testid={`input-edit-body-${key}`}
                  />
                </div>
              </div>
            );
          })}
          <Button
            className="w-full"
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
            data-testid="button-save-edit"
          >
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface SavedSequencesProps {
  onRerun?: (rawInput: string) => void;
}

export default function SavedSequences({ onRerun }: SavedSequencesProps) {
  const [viewSeq, setViewSeq] = useState<Sequence | null>(null);
  const [editSeq, setEditSeq] = useState<Sequence | null>(null);
  const { toast } = useToast();

  const { data: sequences, isLoading } = useQuery<Sequence[]>({
    queryKey: ["/api/sequences"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/sequences/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sequences"] });
      toast({ title: "Sequence deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-saved-title">Saved Sequences</h1>
        <p className="text-sm text-muted-foreground mt-1">
          View, edit, or rerun your previously generated outreach sequences.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : !sequences || sequences.length === 0 ? (
        <Card className="p-12">
          <div className="text-center text-muted-foreground" data-testid="text-empty-sequences">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No saved sequences yet.</p>
            <p className="text-xs mt-1">Generate a sequence from the Home tab to get started.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {sequences.map((seq) => (
            <Card
              key={seq.id}
              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              data-testid={`card-sequence-${seq.id}`}
            >
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm truncate">{seq.name}</h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    {format(new Date(seq.createdAt), "MMM d, yyyy")}
                  </div>
                  {seq.instrument && (
                    <Badge variant="outline" className="text-xs">
                      {seq.instrument}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setViewSeq(seq)}
                  data-testid={`button-view-${seq.id}`}
                >
                  <Eye className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setEditSeq(seq)}
                  data-testid={`button-edit-${seq.id}`}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                {onRerun && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onRerun(seq.rawInput)}
                    data-testid={`button-rerun-${seq.id}`}
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      data-testid={`button-delete-${seq.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete sequence?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete "{seq.name}". This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteMutation.mutate(seq.id)}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </Card>
          ))}
        </div>
      )}

      {viewSeq && (
        <ViewDialog sequence={viewSeq} open={!!viewSeq} onOpenChange={(v) => !v && setViewSeq(null)} />
      )}
      {editSeq && (
        <EditDialog sequence={editSeq} open={!!editSeq} onOpenChange={(v) => !v && setEditSeq(null)} />
      )}
    </div>
  );
}
