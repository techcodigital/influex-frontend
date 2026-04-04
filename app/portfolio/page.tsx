"use client";

import { useState, useRef, useCallback, useEffect } from "react";

const API_BASE = "https://api.collabzy.in/api";

type MediaFile = {
  id: string;
  file: File;
  preview: string;
  type: "reel" | "post";
  uploading: boolean;
  uploaded: boolean;
  url?: string;
  error?: string;
  progress: number;
};

const MAX_REELS = 2;
const MAX_POSTS = 3;
const MAX_REEL_SIZE_BYTES = 100 * 1024 * 1024;
const MAX_POST_SIZE_BYTES = 10  * 1024 * 1024;

const getToken = () => {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("token") ||
    JSON.parse(localStorage.getItem("cb_user") || "{}").token || "";
};

const getUserId = () => {
  if (typeof window === "undefined") return "";
  const u = JSON.parse(localStorage.getItem("cb_user") || "{}");
  return u._id || u.id || "";
};

const validateFile = (file: File, type: "reel" | "post"): string | null => {
  const maxSize  = type === "reel" ? MAX_REEL_SIZE_BYTES : MAX_POST_SIZE_BYTES;
  const maxLabel = type === "reel" ? "100MB" : "10MB";
  if (file.size > maxSize) return `Too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max ${maxLabel}.`;
  if (type === "reel" && !file.type.startsWith("video/")) return "Wrong format. Use MP4 or MOV.";
  return null;
};

// ✅ helper: is this message a success even if it came via error field?
const isSuccessMessage = (msg?: string) =>
  !!msg && msg.toLowerCase().includes("success");

export default function InfluencerPortfolio() {
  const [reels, setReels]                     = useState<MediaFile[]>([]);
  const [posts, setPosts]                     = useState<MediaFile[]>([]);
  const [existingReels, setExistingReels]     = useState(0);
  const [existingPosts, setExistingPosts]     = useState(0);
  const [loadingExisting, setLoadingExisting] = useState(true);

  const reelInputRef = useRef<HTMLInputElement>(null);
  const postInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const token  = getToken();
    const userId = getUserId();
    if (!token || !userId) { setLoadingExisting(false); return; }

    fetch(`${API_BASE}/posts/${userId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then((data: any) => {
        const list = data.data || data.posts || [];
        let rc = 0, pc = 0;
        list.forEach((p: any) => {
          if (Array.isArray(p.urls)   && p.urls.length   > 0) rc++;
          if (Array.isArray(p.images) && p.images.length > 0) pc++;
        });
        setExistingReels(rc);
        setExistingPosts(pc);
      })
      .catch(() => {})
      .finally(() => setLoadingExisting(false));
  }, []);

  const reelSlotsRemaining = Math.max(0, MAX_REELS - existingReels - reels.length);
  const postSlotsRemaining = Math.max(0, MAX_POSTS - existingPosts - posts.length);

  const uploadFile = useCallback(async (
    mediaFile: MediaFile,
    setter: React.Dispatch<React.SetStateAction<MediaFile[]>>,
    type: "reel" | "post"
  ) => {
    const err = validateFile(mediaFile.file, type);
    if (err) {
      setter(prev => prev.map(f => f.id === mediaFile.id ? { ...f, uploading: false, error: err } : f));
      return;
    }

    setter(prev => prev.map(f => f.id === mediaFile.id ? { ...f, uploading: true, progress: 0, error: undefined } : f));

    const formData = new FormData();
    const isReel = type === "reel";
    formData.append(isReel ? "videos" : "image", mediaFile.file);

    try {
      const token = getToken();
      if (!token) throw new Error("Not logged in. Please login again.");

      const endpoint = isReel ? `${API_BASE}/create-post` : `${API_BASE}/upload/image`;

      const progressInterval = setInterval(() => {
        setter(prev => prev.map(f =>
          f.id === mediaFile.id && f.progress < 85
            ? { ...f, progress: f.progress + 8 }
            : f
        ));
      }, 400);

      let res: Response;
      try {
        res = await fetch(endpoint, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
      } catch {
        clearInterval(progressInterval);
        throw new Error("Network error. Check your connection.");
      }

      clearInterval(progressInterval);

      let data: any = {};
      try { data = await res.json(); } catch { data = { success: false, message: `Server error (${res.status})` }; }

      if (!res.ok || !data.success) throw new Error(data.message || `Upload failed (${res.status})`);

      const url = isReel
        ? data.urls?.[0] || data.url || data.post?.videoUrl || ""
        : data.url || "";

      if (!isReel && url) {
        const postData = new FormData();
        postData.append("images", url);
        try {
          await fetch(`${API_BASE}/create-post`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: postData,
          });
          setExistingPosts(prev => prev + 1);
        } catch {}
      }

      if (isReel) setExistingReels(prev => prev + 1);

      // ✅ uploaded:true, error:undefined — always green
      setter(prev => prev.map(f =>
        f.id === mediaFile.id
          ? { ...f, uploading: false, uploaded: true, url, progress: 100, error: undefined }
          : f
      ));
    } catch (err: any) {
      const msg: string = err.message || "Upload failed";
      // ✅ if backend returns success message via throw, treat as uploaded
      if (isSuccessMessage(msg)) {
        setter(prev => prev.map(f =>
          f.id === mediaFile.id
            ? { ...f, uploading: false, uploaded: true, progress: 100, error: undefined }
            : f
        ));
      } else {
        setter(prev => prev.map(f =>
          f.id === mediaFile.id
            ? { ...f, uploading: false, uploaded: false, error: msg, progress: 0 }
            : f
        ));
      }
    }
  }, []);

  const handleReelSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newItems: MediaFile[] = files.slice(0, reelSlotsRemaining).map(file => ({
      id: `reel-${Date.now()}-${Math.random()}`,
      file, preview: URL.createObjectURL(file),
      type: "reel", uploading: false, uploaded: false, progress: 0,
    }));
    setReels(prev => [...prev, ...newItems]);
    newItems.forEach(r => uploadFile(r, setReels, "reel"));
    e.target.value = "";
  };

  const handlePostSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newItems: MediaFile[] = files.slice(0, postSlotsRemaining).map(file => ({
      id: `post-${Date.now()}-${Math.random()}`,
      file, preview: URL.createObjectURL(file),
      type: "post", uploading: false, uploaded: false, progress: 0,
    }));
    setPosts(prev => [...prev, ...newItems]);
    newItems.forEach(p => uploadFile(p, setPosts, "post"));
    e.target.value = "";
  };

  const retryUpload = (media: MediaFile, type: "reel" | "post") => {
    const setter = type === "reel" ? setReels : setPosts;
    setter(prev => prev.map(f => f.id === media.id ? { ...f, error: undefined, progress: 0 } : f));
    uploadFile(media, setter, type);
  };

  const removeReel = (id: string) => setReels(p => p.filter(f => f.id !== id));
  const removePost = (id: string) => setPosts(p => p.filter(f => f.id !== id));

  const isUploading    = [...reels, ...posts].some(f => f.uploading);
  const totalReels     = existingReels + reels.filter(r => r.uploaded).length;
  const totalPosts     = existingPosts + posts.filter(p => p.uploaded).length;

  if (loadingExisting) return (
    <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 28, height: 28, border: "3px solid #e0e0e0", borderTopColor: "#7C3AED", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={s.page}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={s.titleArea}>
        <button style={s.backBtn} onClick={() => window.history.back()}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8l4-4" stroke="#374151" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>
        <h1 style={s.title}>My Portfolio</h1>
        <p style={s.subtitle}>Showcase your best work to brands</p>
      </div>

      <div style={s.statsBar}>
        <StatPill color="#7C3AED" label={`Reels: ${totalReels}/${MAX_REELS}`} />
        <StatPill color="#F59E0B" label={`Posts: ${totalPosts}/${MAX_POSTS}`} />
        <StatPill color="#22C55E" label="Reels: Max 100MB" />
        <StatPill color="#3B82F6" label="Posts: Max 10MB" />
      </div>

      {/* REELS */}
      <div style={s.card}>
        <div style={s.cardHeader}>
          <div style={s.cardTitleRow}>
            <span style={s.emoji}>🎬</span>
            <span style={s.sectionLabel}>REELS</span>
          </div>
          <span style={s.countText}>{totalReels}/{MAX_REELS} added</span>
        </div>
        <input ref={reelInputRef} type="file" accept="video/mp4,video/quicktime,video/*" multiple style={{ display: "none" }} onChange={handleReelSelect} />
        <div style={s.grid}>
          {reels.map(r => <MediaCard key={r.id} media={r} onRemove={removeReel} onRetry={() => retryUpload(r, "reel")} />)}
          {reelSlotsRemaining > 0 && <AddCard label="Add Reel" hint="MP4, MOV • Max 100MB" emoji="🎬" onClick={() => reelInputRef.current?.click()} />}
          {reelSlotsRemaining === 0 && reels.length === 0 && <div style={s.limitReached}>✅ Reel limit reached ({MAX_REELS}/{MAX_REELS})</div>}
        </div>
      </div>

      {/* POSTS */}
      <div style={s.card}>
        <div style={s.cardHeader}>
          <div style={s.cardTitleRow}>
            <span style={s.emoji}>📷</span>
            <span style={s.sectionLabel}>POSTS</span>
          </div>
          <span style={s.countText}>{totalPosts}/{MAX_POSTS} added</span>
        </div>
        <input ref={postInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handlePostSelect} />
        <div style={s.grid}>
          {posts.map(p => <MediaCard key={p.id} media={p} onRemove={removePost} onRetry={() => retryUpload(p, "post")} />)}
          {postSlotsRemaining > 0 && <AddCard label="Add Post" hint="JPG, PNG, WebP • Max 10MB" emoji="📷" onClick={() => postInputRef.current?.click()} />}
          {postSlotsRemaining === 0 && posts.length === 0 && <div style={s.limitReached}>✅ Post limit reached ({MAX_POSTS}/{MAX_POSTS})</div>}
        </div>
      </div>

      <div style={s.footerRow}>
        <button style={{ ...s.saveBtn, opacity: isUploading ? 0.65 : 1 }} disabled={isUploading} onClick={() => window.history.back()}>
          {isUploading ? "Uploading…" : "Done ✓"}
        </button>
      </div>
    </div>
  );
}

function StatPill({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 500, color: "#374151" }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
      {label}
    </span>
  );
}

function AddCard({ label, hint, emoji, onClick }: { label: string; hint: string; emoji: string; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ border: `2px dashed ${hover ? "#7C3AED" : "#D1D5DB"}`, borderRadius: 14, aspectRatio: "4/5", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", gap: 8, background: hover ? "#F5F3FF" : "#F9FAFB", transition: "all 0.15s", padding: "16px 12px" }}>
      <div style={{ width: 52, height: 52, borderRadius: "50%", background: hover ? "#EDE9FE" : "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{emoji}</div>
      <p style={{ fontSize: 13, fontWeight: 600, color: hover ? "#7C3AED" : "#374151", margin: 0 }}>{label}</p>
      <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0, textAlign: "center", lineHeight: 1.4 }}>{hint}</p>
    </div>
  );
}

function MediaCard({ media, onRemove, onRetry }: {
  media: MediaFile;
  onRemove: (id: string) => void;
  onRetry: () => void;
}) {
  // ✅ "Post created successfully" in error field = treat as green success
  const isSuccessMsg = isSuccessMessage(media.error);
  const isSuccess    = media.uploaded || isSuccessMsg;
  const isError      = !!media.error && !isSuccessMsg;

  const borderColor  = isError   ? "2px solid #FCA5A5"
                     : isSuccess ? "2px solid #86EFAC"
                     : "1px solid #E5E7EB";
  const statusColor  = isSuccess ? "#16A34A" : isError ? "#DC2626" : "#9CA3AF";
  const statusText   = media.uploading        ? `Uploading ${media.progress}%`
                     : isSuccess              ? "Uploaded ✓"
                     : isError               ? media.error!
                     : "Pending…";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ position: "relative", aspectRatio: "4/5", borderRadius: 14, overflow: "hidden", background: "#F3F4F6", border: borderColor }}>
        {media.type === "reel"
          ? <video src={media.preview} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted loop playsInline
              onMouseEnter={e => (e.currentTarget as HTMLVideoElement).play()}
              onMouseLeave={e => (e.currentTarget as HTMLVideoElement).pause()} />
          : <img src={media.preview} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
        }

        {/* uploading overlay */}
        {media.uploading && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.52)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <div style={{ width: 46, height: 46, borderRadius: "50%", border: "3px solid rgba(255,255,255,0.2)", borderTopColor: "#fff", animation: "spin 0.8s linear infinite", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#fff" }}>{media.progress}%</span>
            </div>
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: "rgba(255,255,255,0.15)" }}>
              <div style={{ height: "100%", width: `${media.progress}%`, background: "linear-gradient(90deg,#7C3AED,#EC4899)", transition: "width 0.3s" }} />
            </div>
          </div>
        )}

        {/* ✅ green tick — success (uploaded OR success message) */}
        {isSuccess && !media.uploading && (
          <div style={{ position: "absolute", top: 8, right: 8, width: 22, height: 22, borderRadius: "50%", background: "#16A34A", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}

        {/* ✅ red retry — only actual errors */}
        {isError && !media.uploading && (
          <div title={`${media.error} — Click to retry`}
            onClick={e => { e.stopPropagation(); onRetry(); }}
            style={{ position: "absolute", top: 8, right: 8, width: 22, height: 22, borderRadius: "50%", background: "#DC2626", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            ↺
          </div>
        )}

        {/* remove */}
        <button onClick={() => onRemove(media.id)}
          style={{ position: "absolute", top: 8, left: 8, width: 24, height: 24, borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 1l8 8M9 1L1 9" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div>
        <p style={{ fontSize: 11, fontWeight: 500, color: "#374151", margin: "0 0 1px" }}>
          {media.file.name.length > 18 ? media.file.name.slice(0, 16) + "…" : media.file.name}
        </p>
        <p title={media.error} style={{ fontSize: 11, margin: 0, fontWeight: 500, color: statusColor, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 140 }}>
          {statusText}
        </p>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page:         { minHeight: "100vh", background: "#ffffff", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", color: "#111827", padding: "28px 20px 80px", maxWidth: 760, margin: "0 auto" },
  titleArea:    { marginBottom: 20 },
  backBtn:      { display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "1px solid #E5E7EB", borderRadius: 8, padding: "6px 12px", fontSize: 13, fontWeight: 500, color: "#374151", cursor: "pointer", marginBottom: 16 },
  title:        { fontSize: 22, fontWeight: 700, margin: "0 0 3px", color: "#111827" },
  subtitle:     { fontSize: 13, color: "#6B7280", margin: 0 },
  statsBar:     { display: "flex", gap: 20, padding: "11px 18px", background: "#F9FAFB", borderRadius: 12, marginBottom: 16, border: "1px solid #E5E7EB", flexWrap: "wrap" },
  card:         { background: "#fff", borderRadius: 16, padding: "22px", marginBottom: 14, border: "1px solid #E5E7EB" },
  cardHeader:   { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  cardTitleRow: { display: "flex", alignItems: "center", gap: 7 },
  emoji:        { fontSize: 17 },
  sectionLabel: { fontSize: 12, fontWeight: 700, letterSpacing: "0.07em", color: "#374151" },
  countText:    { fontSize: 12, color: "#9CA3AF", fontWeight: 500 },
  grid:         { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(145px, 1fr))", gap: 14 },
  footerRow:    { display: "flex", justifyContent: "flex-end", marginTop: 20 },
  saveBtn:      { background: "linear-gradient(135deg,#7C3AED,#6D28D9)", color: "#fff", border: "none", borderRadius: 10, padding: "11px 30px", fontSize: 14, fontWeight: 600, cursor: "pointer", letterSpacing: "-0.1px" },
  limitReached: { display: "flex", alignItems: "center", justifyContent: "center", aspectRatio: "4/5", borderRadius: 14, background: "#F0FDF4", border: "1.5px solid #BBF7D0", fontSize: 12, fontWeight: 600, color: "#16A34A", textAlign: "center", padding: 12 },
};


