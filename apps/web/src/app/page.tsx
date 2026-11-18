"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type DocumentItem = {
  name: string;
  type: string;
  size: string;
  status: string;
};

type SourceItem = {
  source_id: string;
  document_id: string;
  chunk_index: number;
  similarity: number;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  sources?: SourceItem[];
};

const navigation = [
  { label: "Overview", icon: "◫" },
  { label: "AI Assistant", icon: "✳" },
  { label: "Knowledge Base", icon: "▤" },
  { label: "Activity", icon: "◷" },
];

function formatSimilarity(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function shortId(value: string) {
  return value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}

export default function Home() {
  const [activePage, setActivePage] = useState("Overview");
  const [question, setQuestion] = useState("");
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [totalDocuments, setTotalDocuments] = useState(0);
  const [indexedChunks, setIndexedChunks] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const latestSources = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.role === "assistant" && message.sources?.length) {
        return message.sources;
      }
    }
    return [];
  }, [messages]);

  async function fetchStats() {
    try {
      const response = await fetch(`${API_URL}/api/v1/stats`);
      if (!response.ok) throw new Error("Statistics endpoint unavailable.");
      const data = await response.json();
      setTotalDocuments(Number(data.total_documents ?? 0));
      setIndexedChunks(Number(data.indexed_chunks ?? 0));
      setApiAvailable(true);
    } catch (err) {
      console.error("Dashboard stats error:", err);
      setApiAvailable(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    fetch(`${API_URL}/api/v1/stats`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Statistics endpoint unavailable.");
        }
        return response.json();
      })
      .then((data) => {
        if (cancelled) return;

        setTotalDocuments(Number(data.total_documents ?? 0));
        setIndexedChunks(Number(data.indexed_chunks ?? 0));
        setApiAvailable(true);
      })
      .catch((err) => {
        if (cancelled) return;

        console.error("Dashboard stats error:", err);
        setApiAvailable(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, asking]);

  function handleFileChange(file: File | undefined) {
    if (!file) return;
    setSelectedFile(file);
    setError("");
    setSuccess("");
  }

  async function handleUpload() {
    if (!selectedFile || uploading) return;

    const extension = selectedFile.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "docx", "txt"].includes(extension || "")) {
      setError("Only PDF, DOCX and TXT files are supported.");
      return;
    }
    if (selectedFile.size > 20 * 1024 * 1024) {
      setError("Maximum file size is 20 MB.");
      return;
    }

    setUploading(true);
    setError("");
    setSuccess("");

    const file = selectedFile;
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_URL}/api/v1/documents/upload`, {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.detail || "Document upload failed.");
      }

      const status =
        result.status === "already_exists" ? "Already indexed" : "Processed";

      setDocuments((current) => [
        {
          name: result.original_filename || file.name,
          type: (extension || "file").toUpperCase(),
          size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
          status,
        },
        ...current.filter((document) => document.name !== file.name),
      ]);

      setSuccess(
        result.status === "already_exists"
          ? "This document is already indexed."
          : `Successfully indexed ${file.name} (${result.total_chunks} chunks).`,
      );
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await fetchStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to upload document.");
    } finally {
      setUploading(false);
    }
  }

  async function handleAsk(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const userQuestion = question.trim();
    if (!userQuestion || asking) return;

    setAsking(true);
    setError("");
    setQuestion("");
    setActivePage("AI Assistant");
    setMessages((current) => [...current, { role: "user", content: userQuestion }]);

    try {
      const response = await fetch(`${API_URL}/api/v1/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: userQuestion, top_k: 5 }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || "AI request failed.");

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: result.answer || "No answer was returned.",
          sources: Array.isArray(result.sources) ? result.sources : [],
        },
      ]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to communicate with EnterpriseIQ.",
      );
    } finally {
      setAsking(false);
    }
  }

  function startNewChat() {
    setMessages([]);
    setError("");
    setQuestion("");
    setActivePage("AI Assistant");
  }

  return (
    <main className="workspace-shell">
      <aside className="workspace-sidebar">
        <a className="brand-lockup" href="#" onClick={(event) => event.preventDefault()}>
          <span className="brand-symbol">E<span>.</span></span>
          <span className="brand-copy">
            <strong>EnterpriseIQ</strong>
            <small>KNOWLEDGE INTELLIGENCE</small>
          </span>
        </a>

        <div className="sidebar-section-label">WORKSPACE</div>
        <nav className="sidebar-navigation" aria-label="Main navigation">
          {navigation.map((item) => (
            <button
              key={item.label}
              className={`sidebar-nav-item ${activePage === item.label ? "is-active" : ""}`}
              onClick={() => {
                setActivePage(item.label);
                setError("");
              }}
            >
              <span className="sidebar-nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.label === "Knowledge Base" && (
                <span className="nav-count">{totalDocuments}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-plan-card">
            <span className="plan-kicker">YOUR WORKSPACE</span>
            <strong>Knowledge index</strong>
            <div className="plan-metrics">
              <span>{totalDocuments} documents</span>
              <span>{indexedChunks} chunks</span>
            </div>
            <div className="plan-track"><span style={{ width: "100%" }} /></div>
            <small>Usage metrics from your API</small>
          </div>
          <div className="sidebar-profile">
            <div className="profile-avatar">A</div>
            <div className="profile-copy">
              <strong>Workspace Admin</strong>
              <small>Personal workspace</small>
            </div>
            <span className="profile-more">•••</span>
          </div>
        </div>
      </aside>

      <section className="workspace-main">
        <header className="workspace-topbar">
          <div className="topbar-breadcrumb">
            <span>Workspace</span><i>/</i><strong>{activePage}</strong>
          </div>
          <div className="topbar-actions">
            <span className={`connection-indicator ${apiAvailable === false ? "is-offline" : ""}`}>
              <span className="connection-dot" />
              {apiAvailable === null ? "CONNECTING" : apiAvailable ? "API CONNECTED" : "API UNAVAILABLE"}
            </span>
            <span className="topbar-avatar">A</span>
          </div>
        </header>

        <div className="workspace-content">
          <div className="page-heading">
            <div>
              <div className="page-eyebrow">ENTERPRISE KNOWLEDGE PLATFORM</div>
              <h1>
                {activePage === "Overview"
                  ? "Your knowledge, connected."
                  : activePage === "AI Assistant"
                    ? "AI Research Workspace"
                    : activePage === "Knowledge Base"
                      ? "Knowledge Sources"
                      : "Recent activity"}
              </h1>

              <p>
                {activePage === "Overview"
                  ? "A focused workspace for your documents, retrieval and AI-powered answers."
                  : activePage === "AI Assistant"
                    ? "Ask questions and inspect the evidence retrieved from your knowledge base."
                    : activePage === "Knowledge Base"
                      ? "Add and manage the documents indexed by your EnterpriseIQ pipeline."
                      : "Review documents uploaded during this browser session."}
              </p>
            </div>
            <button
              className="gold-button"
              onClick={() => {
                setActivePage("Knowledge Base");
                fileInputRef.current?.click();
              }}
            >
              <span>＋</span> Add source
            </button>
          </div>

          {error && <div className="notice notice-error" role="alert">{error}</div>}
          {success && <div className="notice notice-success" role="status">{success}</div>}

          {activePage === "Overview" && (
            <>
              <section className="metric-grid">
                <MetricCard label="Indexed documents" value={String(totalDocuments)} note="Reported by the API" icon="▤" />
                <MetricCard label="Knowledge chunks" value={String(indexedChunks)} note="Vector records in the index" icon="⌘" />
                <MetricCard label="Embedding dimension" value="768" note="Gemini embedding vectors" icon="◎" />
                <MetricCard label="Generation model" value="Gemini" note="Cloud-based inference" icon="✳" />
              </section>

              <div className="overview-grid">
                <section className="surface-card source-card">
                  <div className="card-heading">
                    <div>
                      <span className="section-kicker">KNOWLEDGE INGESTION</span>
                      <h2>Add to your knowledge base</h2>
                      <p>Upload a document to process and index its content.</p>
                    </div>
                    <span className="card-heading-icon">↥</span>
                  </div>

                  <label className="upload-zone">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.docx,.txt"
                      onChange={(event) => handleFileChange(event.target.files?.[0])}
                    />
                    <span className="upload-zone-icon">↑</span>
                    <strong>Choose a document to upload</strong>
                    <span>PDF, DOCX or TXT · Maximum 20 MB</span>
                    <small>Content is submitted to your configured ingestion API.</small>
                  </label>

                  {selectedFile && (
                    <div className="selected-file-row">
                      <span className="file-type-mark">{selectedFile.name.split(".").pop()?.toUpperCase()}</span>
                      <div className="selected-file-copy">
                        <strong>{selectedFile.name}</strong>
                        <small>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</small>
                      </div>
                      <button className="quiet-button" onClick={() => setSelectedFile(null)} aria-label="Remove selected file">×</button>
                    </div>
                  )}

                  <button className="gold-button upload-submit" disabled={!selectedFile || uploading} onClick={() => void handleUpload()}>
                    {uploading ? "Indexing document…" : "Upload and index"}
                    <span>↗</span>
                  </button>
                </section>

                <section className="surface-card assistant-card">
                  <div className="card-heading">
                    <div>
                      <span className="section-kicker">RETRIEVAL-AUGMENTED GENERATION</span>
                      <h2>Ask your knowledge base</h2>
                      <p>Get answers grounded in retrieved document passages.</p>
                    </div>
                    <span className="ai-mark">IQ</span>
                  </div>
                  <div className="assistant-welcome">
                    <div className="assistant-orbit"><span>✳</span></div>
                    <h3>What would you like to understand?</h3>
                    <p>Ask a question about the information stored in your indexed documents.</p>
                  </div>
                  <div className="prompt-suggestions">
                    <button onClick={() => setQuestion("Summarize the key points in my documents.")}>Summarize key points <span>↗</span></button>
                    <button onClick={() => setQuestion("What are the main topics covered in my knowledge base?")}>Explore main topics <span>↗</span></button>
                  </div>
                  <form className="composer" onSubmit={(event) => void handleAsk(event)}>
                    <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask EnterpriseIQ a question…" />
                    <button type="submit" disabled={!question.trim() || asking}>↑</button>
                  </form>
                </section>
              </div>

              <section className="surface-card recent-card">
                <div className="card-heading compact-heading">
                  <div>
                    <span className="section-kicker">SESSION VIEW</span>
                    <h2>Recent uploads</h2>
                    <p>Files uploaded during this browser session.</p>
                  </div>
                  <button className="text-link" onClick={() => setActivePage("Knowledge Base")}>View knowledge base ↗</button>
                </div>
                <DocumentTable documents={documents.slice(0, 5)} />
              </section>
            </>
          )}

          {activePage === "Knowledge Base" && (
            <section className="surface-card knowledge-page-card">
              <div className="card-heading">
                <div>
                  <span className="section-kicker">DOCUMENT INGESTION</span>
                  <h2>Knowledge sources</h2>
                  <p>Upload PDF, DOCX or TXT files to your indexed knowledge base.</p>
                </div>
                <span className="card-heading-icon">▤</span>
              </div>
              <label className="upload-zone upload-zone-compact">
                <input type="file" accept=".pdf,.docx,.txt" onChange={(event) => handleFileChange(event.target.files?.[0])} />
                <span className="upload-zone-icon">↑</span>
                <strong>Select a document</strong>
                <span>PDF, DOCX or TXT · Maximum 20 MB</span>
              </label>
              {selectedFile && (
                <div className="selected-file-row">
                  <span className="file-type-mark">{selectedFile.name.split(".").pop()?.toUpperCase()}</span>
                  <div className="selected-file-copy">
                    <strong>{selectedFile.name}</strong>
                    <small>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</small>
                  </div>
                  <button className="quiet-button" onClick={() => setSelectedFile(null)} aria-label="Remove selected file">×</button>
                </div>
              )}
              <button className="gold-button upload-submit narrow-submit" disabled={!selectedFile || uploading} onClick={() => void handleUpload()}>
                {uploading ? "Indexing document…" : "Upload and index"} <span>↗</span>
              </button>
              <div className="session-note">
                <span className="note-dot" />
                This table shows uploads from the current browser session. The API statistics above reflect the indexed totals.
              </div>
              <DocumentTable documents={documents} />
            </section>
          )}

          {activePage === "Activity" && (
            <section className="surface-card knowledge-page-card">
              <div className="card-heading">
                <div>
                  <span className="section-kicker">WORKSPACE HISTORY</span>
                  <h2>Recent activity</h2>
                  <p>Review documents uploaded during this browser session.</p>
                </div>
                <span className="card-heading-icon">◷</span>
              </div>

              <div className="session-note">
                <span className="note-dot" />
                Activity is currently limited to uploads recorded in this session.
                Historical events are not provided by the backend API.
              </div>

              <DocumentTable documents={documents} />
            </section>
          )}

          {activePage === "AI Assistant" && (
            <div className="research-layout">
              <section className="surface-card research-chat-card">
                <div className="research-toolbar">
                  <div>
                    <span className="section-kicker">ENTERPRISEIQ ASSISTANT</span>
                    <h2>Research conversation</h2>
                  </div>
                  <button className="text-link" onClick={startNewChat}>＋ New conversation</button>
                </div>
                <div className="conversation-stream">
                  {messages.length === 0 && (
                    <div className="empty-conversation">
                      <div className="assistant-orbit"><span>✳</span></div>
                      <h3>Start with a question</h3>
                      <p>Your response will appear here, together with the retrieved evidence when available.</p>
                      <div className="prompt-suggestions">
                        <button onClick={() => setQuestion("Summarize the key points in my documents.")}>Summarize key points <span>↗</span></button>
                        <button onClick={() => setQuestion("What are the main topics covered in my knowledge base?")}>Explore main topics <span>↗</span></button>
                      </div>
                    </div>
                  )}
                  {messages.map((message, index) => (
                    <article className={`message-row ${message.role === "user" ? "user-message" : "assistant-message"}`} key={`${message.role}-${index}`}>
                      <div className="message-avatar">{message.role === "user" ? "A" : "IQ"}</div>
                      <div className="message-body">
                        <div className="message-meta">
                          <strong>{message.role === "user" ? "You" : "EnterpriseIQ"}</strong>
                          <span>{message.role === "user" ? "QUESTION" : "AI RESPONSE"}</span>
                        </div>
                        <p className="message-content">{message.content}</p>
                        {message.role === "assistant" && message.sources && message.sources.length > 0 && (
                          <div className="inline-evidence">
                            <strong>Retrieved evidence · {message.sources.length} sources</strong>
                            <span>See the evidence panel for chunk references and similarity scores.</span>
                          </div>
                        )}
                      </div>
                    </article>
                  ))}
                  {asking && (
                    <div className="message-row assistant-message">
                      <div className="message-avatar">IQ</div>
                      <div className="message-body">
                        <div className="message-meta"><strong>EnterpriseIQ</strong><span>WORKING</span></div>
                        <p className="message-content thinking-copy">Retrieving relevant passages and generating a response…</p>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
                <form className="composer research-composer" onSubmit={(event) => void handleAsk(event)}>
                  <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask a follow-up question…" />
                  <button type="submit" disabled={!question.trim() || asking}>{asking ? "…" : "↑"}</button>
                </form>
                <div className="composer-footnote">EnterpriseIQ can make mistakes. Verify important information against the source documents.</div>
              </section>

              <aside className="surface-card evidence-card">
                <div className="evidence-heading">
                  <div>
                    <span className="section-kicker">RETRIEVAL TRACE</span>
                    <h2>Retrieved evidence</h2>
                  </div>
                  <span className="evidence-count">{latestSources.length}</span>
                </div>
                {latestSources.length === 0 ? (
                  <div className="evidence-empty">
                    <div className="evidence-empty-icon">⌕</div>
                    <strong>No evidence to display</strong>
                    <p>Sources returned by your latest AI response will appear here.</p>
                  </div>
                ) : (
                  <div className="evidence-list">
                    {latestSources.map((source, index) => (
                      <article className="evidence-item" key={`${source.source_id}-${source.chunk_index}-${index}`}>
                        <div className="evidence-item-top">
                          <span className="evidence-index">SOURCE {String(index + 1).padStart(2, "0")}</span>
                          <span className="similarity-value">{formatSimilarity(source.similarity)}</span>
                        </div>
                        <strong>Document reference</strong>
                        <code>{shortId(source.document_id)}</code>
                        <div className="evidence-meta-row"><span>Chunk index</span><strong>{source.chunk_index}</strong></div>
                        <div className="evidence-meta-row"><span>Similarity</span><strong>{formatSimilarity(source.similarity)}</strong></div>
                        <div className="similarity-track"><span style={{ width: `${Math.max(0, Math.min(100, source.similarity * 100))}%` }} /></div>
                      </article>
                    ))}
                  </div>
                )}
                <div className="evidence-footnote">
                  Similarity values are returned by the retrieval API; they are not a measure of answer correctness.
                </div>
              </aside>
            </div>
          )}

          <footer className="workspace-footer">
            <span>EnterpriseIQ © 2026</span>
            <span>Knowledge intelligence · Retrieval-augmented generation</span>
          </footer>
        </div>
      </section>
    </main>
  );
}

function MetricCard({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: string;
  note: string;
  icon: string;
}) {
  return (
    <article className="metric-card">
      <div className="metric-card-top"><span>{label}</span><span className="metric-icon">{icon}</span></div>
      <strong className="metric-value">{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function DocumentTable({ documents }: { documents: DocumentItem[] }) {
  return (
    <div className="document-table-wrap">
      <table className="document-table">
        <thead>
          <tr><th>DOCUMENT</th><th>FORMAT</th><th>FILE SIZE</th><th>STATUS</th></tr>
        </thead>
        <tbody>
          {documents.map((document, index) => (
            <tr key={`${document.name}-${index}`}>
              <td><div className="document-cell"><span className="document-file-icon">▤</span><strong>{document.name}</strong></div></td>
              <td><span className="format-label">{document.type}</span></td>
              <td>{document.size}</td>
              <td><span className="document-status">{document.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      {documents.length === 0 && (
        <div className="table-empty-state">
          <span>▤</span>
          <strong>No session uploads yet</strong>
          <p>Uploaded files will be listed here during this browser session.</p>
        </div>
      )}
    </div>
  );
}
