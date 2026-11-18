"use client";

import { useEffect, useState } from "react";
const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

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

const initialDocuments: DocumentItem[] = [];

const navigation = [
  { label: "Overview", icon: "◫" },
  { label: "AI Assistant", icon: "✳" },
  { label: "Knowledge Base", icon: "▤" },
  { label: "Activity", icon: "◷" },
];

export default function Home() {
  const [activePage, setActivePage] = useState("Overview");
  const [question, setQuestion] = useState("");
  const [documents, setDocuments] = useState<DocumentItem[]>(initialDocuments);
  const [totalDocuments, setTotalDocuments] = useState(0);
  const [indexedChunks, setIndexedChunks] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [uploading, setUploading] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);



  async function fetchStats() {
    try {
      const response = await fetch(`${API_URL}/api/v1/stats`);

      if (!response.ok) {
        throw new Error("Failed to fetch dashboard statistics.");
      }

      const data = await response.json();

      setTotalDocuments(data.total_documents);
      setIndexedChunks(data.indexed_chunks);
    } catch (error) {
      console.error("Dashboard stats error:", error);
    }
  }

  useEffect(() => {
    fetchStats();
  }, []);



  function handleFileChange(file: File | undefined) {
    if (!file) return;
    setSelectedFile(file);
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

      const response = await fetch(
        `${API_URL}/api/v1/documents/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || "Document upload failed.");
      }

      const status =
        result.status === "already_exists"
          ? "Already indexed"
          : "Processed";

      setDocuments((current) => [
        {
          name: result.original_filename || file.name,
          type: extension!.toUpperCase(),
          size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
          status,
        },
        ...current.filter(
          (document) => document.name !== file.name
        ),
      ]);

      setSuccess(
        result.status === "already_exists"
          ? "This document is already indexed."
          : `Successfully indexed ${file.name} (${result.total_chunks} chunks).`
      );

      setSelectedFile(null);
      await fetchStats();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to upload document."
      );
    } finally {
      setUploading(false);
    }
  }
  async function handleAsk() {
    const userQuestion = question.trim();

    if (!userQuestion || asking) return;

    setAsking(true);
    setError("");
    setQuestion("");
    setActivePage("AI Assistant");

    setMessages((current) => [
      ...current,
      { role: "user", content: userQuestion },
    ]);

    try {
      const response = await fetch(`${API_URL}/api/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: userQuestion,
          top_k: 5,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || "AI request failed.");
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: result.answer || "No answer was returned.",
          sources: result.sources || [],
        },
      ]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to communicate with EnterpriseIQ."
      );
    } finally {
      setAsking(false);
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">E</div>
          <div>
            <div className="brand-name">EnterpriseIQ</div>
            <div className="brand-caption">KNOWLEDGE INTELLIGENCE</div>
          </div>
        </div>

        <div className="workspace-label">WORKSPACE</div>

        <nav className="navigation">
          {navigation.map((item) => (
            <button
              key={item.label}
              onClick={() => setActivePage(item.label)}
              className={`nav-item ${activePage === item.label ? "active" : ""}`}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="system-status">
            <span className="status-dot" />
            <div>
              <strong>System operational</strong>
              <small>Local environment</small>
            </div>
          </div>

          <div className="profile">
            <div className="avatar">A</div>
            <div className="profile-info">
              <strong>Workspace Admin</strong>
              <small>Administrator</small>
            </div>
            <span className="profile-menu">•••</span>
          </div>
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span> <strong>{activePage}</strong>
          </div>
          <div className="topbar-right">
            <span className="environment-pill">
              <span className="status-dot" /> LOCAL ENVIRONMENT
            </span>
            <div className="top-avatar">A</div>
          </div>
        </header>

        <div className="page-content">
          <div className="welcome-row">
            <div>
              <div className="eyebrow">ENTERPRISE KNOWLEDGE PLATFORM</div>
              <h1>{activePage === "Overview" ? "Good evening, Admin." : activePage}</h1>
              <p className="page-description">
                {activePage === "Overview"
                  ? "Your documents, knowledge and AI workspace — all in one place."
                  : `Manage your ${activePage.toLowerCase()} from one workspace.`}
              </p>
            </div>

            <button
              className="primary-button"
              onClick={() => setActivePage("Knowledge Base")}
            >
              <span>＋</span> Add document
            </button>
          </div>

          {activePage === "Overview" && (
            <>
              <div className="stats-grid">
                <StatCard label="Total documents" value={String(totalDocuments)} detail="In your knowledge base" icon="▤" />
                <StatCard label="Indexed chunks" value={String(indexedChunks)} detail="Vector database records" icon="▦" />
                <StatCard label="AI model" value="Qwen 2.5" detail="Local inference via Ollama" icon="✳" />
                <StatCard label="System status" value="Online" detail="API connection pending" icon="⌁" />
              </div>

              <div className="content-grid">
                <section className="panel upload-panel">
                  <div className="section-heading">
                    <div>
                      <h2>Upload documents</h2>
                      <p>Add files to your enterprise knowledge base.</p>
                    </div>
                    <span className="heading-icon">↥</span>
                  </div>

                  <label className="dropzone">
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt"
                      onChange={(event) => handleFileChange(event.target.files?.[0])}
                    />
                    <span className="upload-icon">↑</span>
                    <strong>Click to select a document</strong>
                    <span>or choose a PDF, DOCX or TXT file</span>
                    <small>Supported formats: PDF · DOCX · TXT</small>
                  </label>

                  {selectedFile && (
                    <div className="selected-file">
                      <span>▤</span>
                      <div>
                        <strong>{selectedFile.name}</strong>
                        <small>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</small>
                      </div>
                      <button onClick={() => setSelectedFile(null)}>✕</button>
                    </div>
                  )}

                  <button
                    className="primary-button upload-button"
                    disabled={!selectedFile || uploading}
                    onClick={handleUpload}
                  >
                    Add to workspace
                  </button>
                  <div className="upload-note">
                    {error && <p role="alert">{error}</p>}
                    {success && <p role="status">{success}</p>}
                  </div>
                </section>

                <section className="panel assistant-panel">
                  <div className="section-heading">
                    <div>
                      <h2>Ask EnterpriseIQ</h2>
                      <p>Explore information across your documents.</p>
                    </div>
                    <span className="ai-badge">AI</span>
                  </div>

                  <div className="assistant-intro">
                    <div className="assistant-symbol">✳</div>
                    <h3>Your knowledge assistant</h3>
                    <p>
                      Ask questions in natural language and get answers grounded
                      in your uploaded documents.
                    </p>
                  </div>

                  <div className="suggestions">
                    <button onClick={() => setQuestion("Summarize my uploaded documents.")}>
                      Summarize my documents
                    </button>
                    <button onClick={() => setQuestion("What technical skills are mentioned in my resume?")}>
                      Find skills in my resume
                    </button>
                  </div>

                  <form
                    className="chat-input"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void handleAsk();
                    }}
                  >
                    <input
                      value={question}
                      onChange={(event) => setQuestion(event.target.value)}
                      placeholder="Ask a question about your documents..."
                    />
                    <button type="submit" disabled={!question.trim()}>
                      ↑
                    </button>
                  </form>
                </section>
              </div>

              <section className="panel documents-panel">
                <div className="section-heading">
                  <div>
                    <h2>Recent documents</h2>
                    <p>Your latest knowledge base additions.</p>
                  </div>
                  <button className="text-button" onClick={() => setActivePage("Knowledge Base")}>
                    View all →
                  </button>
                </div>

                <DocumentTable documents={documents.slice(0, 4)} />
              </section>
            </>
          )}

          {activePage === "Knowledge Base" && (
            <section className="panel documents-panel full-panel">
              <div className="section-heading">
                <div>
                  <h2>Knowledge base</h2>
                  <p>Documents available in this dashboard preview.</p>
                </div>
              </div>

              <label className="dropzone compact-dropzone">
                <input
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={(event) => handleFileChange(event.target.files?.[0])}
                />
                <span className="upload-icon">↑</span>
                <strong>Select a document to add</strong>
                <span>PDF, DOCX or TXT</span>
              </label>

              {selectedFile && (
                <div className="selected-file">
                  <span>▤</span>
                  <div>
                    <strong>{selectedFile.name}</strong>
                    <small>Ready to add to the preview</small>
                  </div>
                  <button onClick={() => setSelectedFile(null)}>✕</button>
                </div>
              )}

              <button className="primary-button upload-button" disabled={!selectedFile || uploading} onClick={handleUpload}>
                Add document
              </button>

              <DocumentTable documents={documents} />
            </section>
          )}

          {activePage === "AI Assistant" && (
            <section className="panel chat-page-panel">
              <div className="assistant-intro">
                <div className="assistant-symbol">✳</div>
                <h2>EnterpriseIQ Assistant</h2>
                <p>
                  Ask questions about your uploaded documents.
                  Answers are generated using your local RAG pipeline.
                </p>
              </div>

              <div className="chat-messages">
                {messages.length === 0 && (
                  <div className="chat-preview-message">
                    <strong>EnterpriseIQ</strong>
                    <p>
                      Hello! Ask me anything about your indexed documents.
                    </p>
                  </div>
                )}

                {messages.map((message, index) => (
                  <div
                    key={index}
                    className="chat-preview-message"
                  >
                    <strong>
                      {message.role === "user" ? "You" : "EnterpriseIQ"}
                    </strong>

                    <p>{message.content}</p>

                    {message.sources && message.sources.length > 0 && (
                      <div>
                        <strong>Sources</strong>

                        {message.sources.map((source, sourceIndex) => (
                          <p key={`${source.document_id}-${source.chunk_index}`}>
                            [Source {sourceIndex + 1}] Chunk {source.chunk_index}
                            {" · "}
                            Similarity: {(source.similarity * 100).toFixed(1)}%
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {asking && (
                  <div className="chat-preview-message">
                    <strong>EnterpriseIQ</strong>
                    <p>Searching documents and generating an answer...</p>
                  </div>
                )}
              </div>

              {error && <p role="alert">{error}</p>}

              <form
                className="chat-input large-chat-input"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleAsk();
                }}
              >
                <input
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="Ask EnterpriseIQ anything..."
                />

                <button type="submit" disabled={!question.trim() || asking}>
                  {asking ? "..." : "↑"}
                </button>
              </form>
            </section>
          )}

          {activePage === "Activity" && (
            <section className="panel documents-panel full-panel">
              <div className="section-heading">
                <div>
                  <h2>Workspace activity</h2>
                  <p>Recent activity in this dashboard preview.</p>
                </div>
              </div>
              <div className="activity-item">
                <span className="activity-icon">✓</span>
                <div><strong>RAG pipeline tested successfully</strong><small>Backend · Local environment</small></div>
              </div>
              <div className="activity-item">
                <span className="activity-icon">↥</span>
                <div><strong>Document upload endpoint tested</strong><small>API · FastAPI</small></div>
              </div>
              <div className="activity-item">
                <span className="activity-icon">✳</span>
                <div><strong>Frontend workspace initialized</strong><small>Web · Next.js</small></div>
              </div>
            </section>
          )}

          <footer className="footer">
            <span>EnterpriseIQ © 2026</span>
            <span>Built for intelligent enterprise knowledge retrieval</span>
          </footer>
        </div>
      </section>
    </main>
  );
}

function StatCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <strong className="stat-value">{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function DocumentTable({
  documents,
}: {
  documents: { name: string; type: string; size: string; status: string }[];
}) {
  return (
    <div className="table-wrap">
      <table className="documents-table">
        <thead>
          <tr>
            <th>DOCUMENT</th>
            <th>TYPE</th>
            <th>SIZE / DATE</th>
            <th>STATUS</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((document, index) => (
            <tr key={`${document.name}-${index}`}>
              <td>
                <div className="document-name">
                  <span className="file-icon">▤</span>
                  <strong>{document.name}</strong>
                </div>
              </td>
              <td>{document.type}</td>
              <td>{document.size}</td>
              <td><span className="processed-pill">{document.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      {documents.length === 0 && <p className="empty-state">No documents yet.</p>}
    </div>
  );
}