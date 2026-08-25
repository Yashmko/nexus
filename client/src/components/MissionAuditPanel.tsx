import { ChangeEvent, useState } from "react";
import { BellRing, FileText, History, Paperclip, Upload } from "lucide-react";
import { trpc } from "@/lib/trpc";

type MissionAuditPanelProps = {
  missionId: number;
  canManage: boolean;
};

function formatTime(value: Date | string) {
  return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The attachment could not be read."));
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.split(",")[1] ?? "");
    };
    reader.readAsDataURL(file);
  });
}

export default function MissionAuditPanel({ missionId, canManage }: MissionAuditPanelProps) {
  const utils = trpc.useUtils();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const activityQuery = trpc.missions.activity.useQuery({ missionId }, { retry: false });
  const attachmentsQuery = trpc.missions.attachments.useQuery({ missionId }, { retry: false });
  const notificationsQuery = trpc.missions.notifications.useQuery({ missionId }, { retry: false });
  const refresh = async () => {
    await Promise.all([
      utils.missions.activity.invalidate({ missionId }),
      utils.missions.attachments.invalidate({ missionId }),
      utils.missions.notifications.invalidate({ missionId }),
      utils.missions.list.invalidate(),
    ]);
  };
  const attachMutation = trpc.missions.attachEvidence.useMutation({
    onSuccess: async () => {
      setSelectedFile(null);
      setNotice("Evidence attachment stored in the mission ledger.");
      await refresh();
    },
    onError: (error) => setNotice(error.message),
  });

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (file && file.size > 5 * 1024 * 1024) {
      setNotice("Evidence attachments are limited to 5 MB.");
      event.target.value = "";
      return;
    }
    setSelectedFile(file);
  };
  const uploadEvidence = async () => {
    if (!selectedFile) return;
    try {
      const contentBase64 = await fileToBase64(selectedFile);
      attachMutation.mutate({ missionId, fileName: selectedFile.name, mimeType: selectedFile.type || "application/octet-stream", contentBase64 });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The attachment could not be prepared.");
    }
  };

  return <section className="mission-audit-panel">
    <header><div><span className="eyebrow">Forensic record</span><h3><History size={15} /> Activity &amp; evidence</h3></div><span>{activityQuery.data?.length ?? 0} ledger events</span></header>
    {notice && <p className="audit-notice">{notice}</p>}
    <div className="audit-grid">
      <section className="activity-ledger"><strong>Mission activity</strong>{activityQuery.isLoading ? <p>Loading activity ledger…</p> : activityQuery.data?.length ? activityQuery.data.slice(0, 6).map((event) => <article key={event.id}><time>{formatTime(event.createdAt)}</time><div><b>{event.action.replaceAll("_", " ")}</b><p>{event.summary}</p><small>{event.actorName ?? event.actorEmail ?? "NEXUS system"}</small></div></article>) : <p>No recorded mission activity yet.</p>}</section>
      <section className="attachment-ledger"><strong><Paperclip size={13} /> Evidence attachments</strong>{attachmentsQuery.data?.length ? <div className="attachment-list">{attachmentsQuery.data.map((attachment) => <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer"><FileText size={14} /><span><b>{attachment.fileName}</b><small>{Math.ceil(attachment.sizeBytes / 1024)} KB · {attachment.uploaderName ?? attachment.uploaderEmail ?? "Operator"}</small></span></a>)}</div> : <p>No stored evidence attachments.</p>}{canManage && <div className="attachment-upload"><input aria-label="Evidence attachment" type="file" onChange={handleFileChange} /><button onClick={uploadEvidence} disabled={!selectedFile || attachMutation.isPending}><Upload size={13} /> {attachMutation.isPending ? "Uploading…" : "Store evidence"}</button>{selectedFile && <small>{selectedFile.name}</small>}</div>}</section>
      <section className="notification-ledger"><strong><BellRing size={13} /> Approval alerts</strong>{notificationsQuery.data?.length ? notificationsQuery.data.slice(0, 4).map((notification) => <article key={notification.id}><p><span>{notification.title}</span><em className={notification.status}>{notification.status}</em></p><small>{notification.content}</small><time>{formatTime(notification.createdAt)}</time></article>) : <p>Approval alerts appear here when requests enter the pending queue.</p>}</section>
    </div>
  </section>;
}
