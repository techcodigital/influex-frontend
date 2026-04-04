"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";

const API          = "https://api.collabzy.in/api";
const RAZORPAY_KEY = "rzp_live_SVOzjhbjcfQiiY";

function DealDetailPageInner() {
  const { id }   = useParams();
  const router   = useRouter();
  

  const [deal,          setDeal]          = useState<any>(null);
  const [escrow,        setEscrow]        = useState<any>(null);
  const [loading,       setLoading]       = useState(true);
  const [token,         setToken]         = useState("");
  const [role,          setRole]          = useState("");
  const [userName,      setUserName]      = useState("");
  const [userEmail,     setUserEmail]     = useState("");
  const [actionLoading, setActionLoading] = useState("");
  const [toast,         setToast]         = useState<{msg:string;type:"success"|"error"|"warn"}|null>(null);
  const [submitNote,    setSubmitNote]    = useState("");
  const [submitFile,    setSubmitFile]    = useState("");
  const [showSubmit,    setShowSubmit]    = useState(false);
  const [brandName,     setBrandName]     = useState("");
  const [creatorName,   setCreatorName]   = useState("");
  const [deliverable,   setDeliverable]   = useState<any>(null);

  const showToast = (msg: string, type: "success"|"error"|"warn" = "success") => {
    setToast({msg,type}); setTimeout(() => setToast(null), 4500);
  };

  useEffect(() => {
    if (typeof window !== "undefined" && !(window as any).Razorpay) {
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.async = true;
      document.head.appendChild(s);
    }
    const raw = localStorage.getItem("cb_user");
    if (!raw) { router.push("/login"); return; }
    const u = JSON.parse(raw);
    setToken(u.token);
    const userRole = (u.role || u.user?.role || "").toLowerCase();
    setRole(userRole);
    setUserName(u.name || u.user?.name || "");
    setUserEmail(u.email || u.user?.email || "");
    fetchDeal(u.token, userRole);
  }, [id]);

  const fetchDeal = async (t: string, userRole?: string) => {
    try {
      const res  = await fetch(`${API}/deal/${id}`, { headers: { Authorization: `Bearer ${t}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      const d = data.deal || data.data || (data._id ? data : null) || data;

      // ✅ localStorage restore SIRF brand ke liye — creator ko fresh server data chahiye
      const currentRole = userRole || role;
      if (currentRole === "brand") {
        const savedStatus = JSON.parse(localStorage.getItem("cb_deal_status") || "{}");
        const localStatus = savedStatus[String(id)];
        if (localStatus && d.paymentStatus === "pending") {
          d.paymentStatus = localStatus;
        }
      }

      setDeal(d);
      const esc = d.escrow || data.escrow || null;
      if (esc) setEscrow(esc);

      // Escrow separately fetch
      try {
        const escRes = await fetch(`${API}/escrow/${id}`, { headers: { Authorization: `Bearer ${t}` } });
        if (escRes.ok) {
          const escData = await escRes.json();
          const escrow = escData.escrow || escData.data || escData;
          if (escrow?.status) setEscrow(escrow);
        }
      } catch { /* silent */ }

      console.log("DEAL DATA:", JSON.stringify(d, null, 2));

      // ✅ Deliverable now comes with deal response (populated in getDealById)
      if (d.deliverable?._id || d.deliverable?.note || d.deliverable?.links?.length) {
        setDeliverable(d.deliverable);
      }

      // Fetch brand & creator names
      const brandId   = d.brandId?._id   || d.brandId;
      const creatorId = d.influencerId?._id || d.influencerId;
      if (brandId && typeof brandId === "string") {
        fetch(`${API}/profile/user/${brandId}`, { headers: { Authorization: `Bearer ${t}` } })
          .then(r => r.json()).then(pd => {
            const p = pd.profile || pd.data || pd;
            setBrandName(p?.companyName || p?.name || d.brandId?.email || "");
          }).catch(() => {});
      }
      if (creatorId && typeof creatorId === "string") {
        fetch(`${API}/profile/user/${creatorId}`, { headers: { Authorization: `Bearer ${t}` } })
          .then(r => r.json()).then(pd => {
            const p = pd.profile || pd.data || pd;
            setCreatorName(p?.name || p?.username || d.influencerId?.email || "");
          }).catch(() => {});
      }
    } catch(e:any) {
      showToast(e.message || "Failed to load deal", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDeposit = async (t?: string) => {
    const tk = t || token;
    if (!deal) return;
    setActionLoading("deposit");
    try {
      const dealAmount    = Number(deal.amount || 0);
      const commission    = Math.round(dealAmount * 0.10);
      const creatorAmount = dealAmount - commission;
      const rawInf = deal.influencerId;
      const influencerId = (typeof rawInf === "object" && rawInf !== null)
        ? (rawInf._id || rawInf.id || String(rawInf))
        : String(rawInf || "");

      const res  = await fetch(`${API}/payment/deposit`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body:    JSON.stringify({ dealId: id, amount: dealAmount, commission, creatorAmount, influencerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create order");
      if (!data.order?.id) throw new Error("No order returned from server");

      if (!(window as any).Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const ex = document.querySelector('script[src*="razorpay"]');
          if (ex) ex.remove();
          const s = document.createElement("script");
          s.src = "https://checkout.razorpay.com/v1/checkout.js";
          s.async = true;
          s.onload  = () => setTimeout(resolve, 500);
          s.onerror = () => reject(new Error("Razorpay failed to load"));
          document.head.appendChild(s);
        });
      }
      if (!(window as any).Razorpay) throw new Error("Razorpay not available. Refresh and try again.");

      const rzp = new (window as any).Razorpay({
        key:         RAZORPAY_KEY,
        order_id:    data.order.id,
        amount:      data.order.amount,
        currency:    data.order.currency || "INR",
        name:        "Influex Escrow",
        description: `Deal: ${deal.title || id}`,
        theme:       { color: "#4f46e5" },
        prefill:     { name: userName, email: userEmail },
        handler: async (response: any) => {
          try {
            const vRes = await fetch(`${API}/payment/verify`, {
              method:  "POST",
              headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
              body:    JSON.stringify({
                dealId:              id,
                razorpay_order_id:   response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature:  response.razorpay_signature,
                influencerId: (typeof deal?.influencerId === "object" && deal?.influencerId !== null)
                  ? (deal.influencerId._id || deal.influencerId.id || String(deal.influencerId))
                  : String(deal?.influencerId || ""),
                amount: Number(deal?.amount || 0),
              }),
            });
            const vData = await vRes.json();
            if (!vRes.ok) throw new Error(vData.message || "Verification failed");
            setEscrow(vData.escrow || { status: "funded" });
            setDeal((prev: any) => ({ ...prev, paymentStatus: "deposited" }));
            // ✅ localStorage mein save — sirf brand ke liye
            try {
              const saved = JSON.parse(localStorage.getItem("cb_deal_status") || "{}");
              saved[String(id)] = "deposited";
              localStorage.setItem("cb_deal_status", JSON.stringify(saved));
            } catch {}
            showToast("✅ Escrow funded! Deal is now active.", "success");
            await fetchDeal(tk);
          } catch(e:any) {
            showToast(e.message || "Verification failed", "error");
          } finally {
            setActionLoading("");
          }
        },
        modal: { ondismiss: () => setActionLoading("") },
      });
      rzp.open();

    } catch(e:any) {
      showToast(e.message || "Payment failed", "error");
      setActionLoading("");
    }
  };

  const handleSubmitWork = async () => {
    if (!submitNote && !submitFile) { showToast("Add a note or link", "error"); return; }
    setActionLoading("submit");
    try {
      const res = await fetch(`${API}/payment/deal/${id}/submit-deliverable`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ note: submitNote, links: [submitFile] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Submit failed");
      // ✅ Save deliverable locally so brand can see it immediately
      const savedDel = data.deliverable || data.data || { note: submitNote, links: [submitFile].filter(Boolean), createdAt: new Date().toISOString() };
      setDeliverable(savedDel);
      showToast("📤 Work submitted! Waiting for approval.", "success");
      setShowSubmit(false);
      setSubmitNote("");
      setSubmitFile("");
      await fetchDeal(token);
    } catch (e:any) {
      showToast(e.message || "Submit failed", "error");
    } finally {
      setActionLoading("");
    }
  };

  const handleApprove = async () => {
    if (!confirm("Approve work and release payment to creator?")) return;
    setActionLoading("approve");
    try {
      // Backend needs deliverableId — use from state or fetch latest
      let deliverableId = deliverable?._id;

      // If no deliverable in state, it means deal has workStatus submitted
      // Use payment/approve-deliverable with deliverableId
      if (!deliverableId) {
        showToast("Deliverable not found. Please refresh.", "error");
        setActionLoading("");
        return;
      }

      const res = await fetch(`${API}/payment/approve-deliverable`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body:    JSON.stringify({ deliverableId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Approval failed");
      showToast("🎉 Approved! Payment released to creator.", "success");
      await fetchDeal(token);
    } catch(e:any) {
      showToast(e.message || "Approval failed", "error");
    } finally {
      setActionLoading("");
    }
  };

  // ✅ Status checks — "deposited" sahi field hai server se
  // ✅ "paid" | "deposited" | "funded" — all mean escrow is funded
  const isEscrowFunded  = ["paid","deposited","funded","released","completed"].includes(deal?.paymentStatus) || ["funded","released"].includes(escrow?.status);
  // ✅ "in_progress" = work started but NOT submitted yet
  // Only "submitted" | "approved" | "completed" = actually submitted
  // "submitted" = pending approval, "approved" = brand approved, both have deliverable
  const isWorkSubmitted = ["submitted","approved","completed"].includes(deal?.workStatus) && !!deal?.deliverable;
  const isCompleted     = ["released","completed"].includes(deal?.paymentStatus) || escrow?.status === "released";
  const isBrand         = role === "brand";
  const isCreator       = role === "influencer" || role === "creator";

  const getStep = (): number => {
    if (!deal) return 0;
    if (isCompleted)     return 4;
    if (isWorkSubmitted) return 3;
    if (isEscrowFunded)  return 2;
    return 1;
  };

  const STEPS = [
    { label: "Deal\nCreated",    icon: "🤝" },
    { label: "Escrow\nFunded",   icon: "💰" },
    { label: "Work\nSubmitted",  icon: "📤" },
    { label: "Brand\nApproved",  icon: "✅" },
    { label: "Payment\nReleased",icon: "🚀" },
  ];

  if (loading) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f7f7f5"}}>
      <div style={{width:32,height:32,border:"3px solid #e0e0e0",borderTopColor:"#4f46e5",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!deal) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f7f7f5",fontFamily:"Plus Jakarta Sans,sans-serif"}}>
      <div style={{textAlign:"center"}}><div style={{fontSize:48,marginBottom:12}}>🤝</div><div style={{fontWeight:700,color:"#111"}}>Deal not found</div></div>
    </div>
  );

  const step = getStep();

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        body{font-family:'Plus Jakarta Sans',sans-serif}
        .dd{background:#f7f7f5;min-height:100vh;padding-bottom:60px}
        .dd-hdr{background:#fff;border-bottom:1px solid #efefef;padding:18px 24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px}
        .dd-back{background:#f5f5f3;border:none;border-radius:10px;padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer;color:#555;text-decoration:none;font-family:inherit}
        .dd-title{font-size:17px;font-weight:800;color:#111}
        .dd-badge{padding:5px 12px;border-radius:100px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em}
        .dd-body{max-width:640px;margin:24px auto;padding:0 16px;display:flex;flex-direction:column;gap:14px;animation:fadeIn .3s ease}
        .dd-card{background:#fff;border-radius:18px;border:1.5px solid #efefef;padding:22px}
        .dd-card-title{font-size:12px;font-weight:700;color:#4f46e5;text-transform:uppercase;letter-spacing:.08em;margin-bottom:16px}
        .dd-row{display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid #f5f5f5;font-size:14px}
        .dd-row:last-child{border-bottom:none}
        .dd-lbl{color:#888;font-weight:500}
        .dd-val{font-weight:700;color:#111}
        .flow{background:#fff;border-radius:18px;border:1.5px solid #efefef;padding:22px 16px}
        .flow-hdr{font-size:12px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.08em;margin-bottom:20px}
        .flow-row{display:flex;align-items:flex-start}
        .flow-step{flex:1;display:flex;flex-direction:column;align-items:center;position:relative}
        .flow-line{position:absolute;top:16px;left:50%;right:-50%;height:2px;background:#e8e8e8;z-index:0;transition:background .4s}
        .flow-line.on{background:linear-gradient(90deg,#4f46e5,#7c3aed)}
        .flow-dot{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;border:2px solid #e8e8e8;background:#fff;color:#bbb;z-index:1;position:relative;transition:all .3s}
        .flow-dot.done{background:linear-gradient(135deg,#4f46e5,#7c3aed);border-color:#4f46e5;color:#fff}
        .flow-dot.cur{background:#fff;border-color:#4f46e5;color:#4f46e5;box-shadow:0 0 0 4px #eef2ff}
        .flow-lbl{font-size:9px;font-weight:600;color:#bbb;margin-top:5px;text-align:center;line-height:1.3;white-space:pre-line}
        .flow-lbl.done{color:#4f46e5}
        .flow-lbl.cur{color:#4f46e5;font-weight:800}
        .esc-amt{font-size:36px;font-weight:800;color:#4f46e5;text-align:center;padding:12px 0 4px}
        .esc-lbl{font-size:12px;color:#aaa;text-align:center;margin-bottom:14px}
        .esc-status{display:flex;align-items:center;justify-content:center;gap:8px;padding:11px 18px;border-radius:12px;font-size:13px;font-weight:700;margin-bottom:12px}
        .esc-funded{background:#f0fdf4;color:#16a34a;border:1.5px solid #86efac}
        .esc-pending{background:#fffbeb;color:#d97706;border:1.5px solid #fde68a}
        .esc-released{background:#eef2ff;color:#4f46e5;border:1.5px solid #c7d2fe}
        .btn{width:100%;padding:14px;border-radius:14px;font-size:14px;font-weight:700;font-family:inherit;border:none;cursor:pointer;transition:all .2s;margin-top:8px;display:flex;align-items:center;justify-content:center;gap:6px}
        .btn:disabled{opacity:.55;cursor:not-allowed;transform:none!important}
        .btn-deposit{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 4px 16px rgba(79,70,229,.28)}
        .btn-deposit:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 6px 20px rgba(79,70,229,.36)}
        .btn-approve{background:linear-gradient(135deg,#16a34a,#22c55e);color:#fff;box-shadow:0 4px 16px rgba(34,197,94,.25)}
        .btn-approve:hover:not(:disabled){transform:translateY(-1px)}
        .btn-submit{background:linear-gradient(135deg,#f59e0b,#f97316);color:#fff;box-shadow:0 4px 16px rgba(245,158,11,.25)}
        .btn-submit:hover:not(:disabled){transform:translateY(-1px)}
        .btn-ghost{background:#f5f5f3;color:#555}
        .sf{background:#f8f9ff;border:1.5px solid #c7d2fe;border-radius:14px;padding:16px;margin-top:10px}
        .sf-lbl{font-size:11px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px;display:block}
        .sf-input{width:100%;padding:10px 12px;border-radius:10px;border:1.5px solid #e0e7ff;font-size:13px;font-family:inherit;outline:none;background:#fff;margin-bottom:10px}
        .sf-input:focus{border-color:#4f46e5}
        .sf-ta{width:100%;padding:10px 12px;border-radius:10px;border:1.5px solid #e0e7ff;font-size:13px;font-family:inherit;outline:none;background:#fff;resize:vertical;min-height:80px;margin-bottom:10px}
        .info{padding:11px 14px;border-radius:10px;font-size:13px;font-weight:600;margin-top:8px}
        .info-green{background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0}
        .info-blue{background:#eef2ff;color:#4f46e5;border:1px solid #c7d2fe}
        .info-orange{background:#fff7ed;color:#c2410c;border:1px solid #fed7aa}
        .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:12px 22px;border-radius:12px;font-size:13px;font-weight:600;z-index:9999;animation:toastIn .3s ease;white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,.12)}
        .toast.success{background:#111;color:#fff}
        .toast.error{background:#ef4444;color:#fff}
        .toast.warn{background:#f59e0b;color:#fff}
      `}</style>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}

      <div className="dd">
        <div className="dd-hdr">
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {/* <a href="/deals" className="dd-back">← Back</a> */}
            <button className="dd-back" onClick={() => router.back()}>← Back</button>
            <div className="dd-title">{deal.title || "Deal"}</div>
          </div>
          <div className="dd-badge" style={{
            background: isCompleted ? "#f0fdf4" : isEscrowFunded ? "#eef2ff" : "#fffbeb",
            color:      isCompleted ? "#16a34a" : isEscrowFunded ? "#4f46e5" : "#d97706",
            border:     `1.5px solid ${isCompleted ? "#86efac" : isEscrowFunded ? "#c7d2fe" : "#fde68a"}`,
          }}>{deal.paymentStatus || "pending"}</div>
        </div>

        <div className="dd-body">

          {/* FLOW STEPS */}
          <div className="flow">
            <div className="flow-hdr">Deal Progress</div>
            <div className="flow-row">
              {STEPS.map((s, i) => (
                <div key={i} className="flow-step">
                  {i < STEPS.length - 1 && <div className={`flow-line ${i < step ? "on" : ""}`}/>}
                  <div className={`flow-dot ${i < step ? "done" : i === step ? "cur" : ""}`}>
                    {i < step ? "✓" : s.icon}
                  </div>
                  <div className={`flow-lbl ${i < step ? "done" : i === step ? "cur" : ""}`}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* DEAL INFO */}
          <div className="dd-card">
            <div className="dd-card-title">📋 Deal Info</div>
            <div className="dd-row"><span className="dd-lbl">Campaign</span><span className="dd-val">{deal.campaignId?.title || deal.campaignTitle || "—"}</span></div>
            <div className="dd-row"><span className="dd-lbl">Brand</span><span className="dd-val">{brandName || deal.brandId?.email || "—"}</span></div>
            <div className="dd-row"><span className="dd-lbl">Creator</span><span className="dd-val">{creatorName || deal.influencerId?.email || "—"}</span></div>
            <div className="dd-row"><span className="dd-lbl">Amount</span><span className="dd-val">₹{Number(deal.amount||0).toLocaleString("en-IN")}</span></div>
            <div className="dd-row"><span className="dd-lbl">Platform Fee (10%)</span><span className="dd-val">₹{Number(deal.platformCommission||0).toLocaleString("en-IN")}</span></div>
            <div className="dd-row"><span className="dd-lbl">Creator Gets</span><span className="dd-val" style={{color:"#16a34a"}}>₹{Number(deal.creatorAmount||0).toLocaleString("en-IN")}</span></div>
            {deal.deadline && <div className="dd-row"><span className="dd-lbl">Deadline</span><span className="dd-val">{new Date(deal.deadline).toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric"})}</span></div>}
            {deal.description && (
              <div style={{marginTop:10,padding:"10px 12px",background:"#f9f9f8",borderRadius:10,fontSize:13,color:"#555",lineHeight:1.6}}>
                {deal.description}
              </div>
            )}
          </div>

          {/* ESCROW / PAYMENT */}
          <div className="dd-card">
            <div className="dd-card-title">💰 Escrow Payment</div>
            <div className="esc-amt">₹{Number(deal.amount||0).toLocaleString("en-IN")}</div>
            <div className="esc-lbl">Deal Amount</div>

            {isCompleted ? (
              <div className="esc-status esc-released">🚀 Payment released to creator!</div>
            ) : isEscrowFunded ? (
              <div className="esc-status esc-funded">🔒 Funds held in escrow — Creator gets ₹{Number(deal.creatorAmount||0).toLocaleString("en-IN")}</div>
            ) : (
              <div className="esc-status esc-pending">⏳ Awaiting escrow deposit</div>
            )}

            {/* Brand: deposit */}
            {isBrand && !isEscrowFunded && !isCompleted && (
              <button className="btn btn-deposit" disabled={actionLoading==="deposit"} onClick={() => handleDeposit()}>
                {actionLoading==="deposit" ? "⏳ Opening payment..." : `💰 Deposit ₹${Number(deal.amount||0).toLocaleString("en-IN")} to Escrow`}
              </button>
            )}

            {/* Brand: waiting for work */}
            {isBrand && isEscrowFunded && !isWorkSubmitted && !isCompleted && (
              <div className="info info-orange">⏳ Waiting for creator to submit work...</div>
            )}

            {/* Brand: approve work */}
            {isBrand && isEscrowFunded && isWorkSubmitted && !isCompleted && (
              <>
                <div className="info info-blue">🎯 Creator submitted work. Review and approve to release payment.</div>
                <button className="btn btn-approve" disabled={actionLoading==="approve"} onClick={handleApprove}>
                  {actionLoading==="approve" ? "⏳ Releasing..." : "✅ Approve Work & Release Payment"}
                </button>
              </>
            )}

            {isCompleted && (
              <div className="info info-green" style={{textAlign:"center",marginTop:8}}>🎉 Deal completed successfully!</div>
            )}
          </div>

          {/* Deliverables */}
          {deal.deliverables?.length > 0 && (
            <div className="dd-card">
              <div className="dd-card-title">✅ Deliverables</div>
              {(Array.isArray(deal.deliverables) ? deal.deliverables : [deal.deliverables]).map((d:string, i:number) => (
                <div key={i} style={{display:"flex",gap:10,padding:"8px 0",borderBottom:"1px solid #f5f5f5",fontSize:14,color:"#444",alignItems:"flex-start"}}>
                  <div style={{width:22,height:22,background:"#eef2ff",color:"#4f46e5",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,flexShrink:0}}>{i+1}</div>
                  <div style={{flex:1,lineHeight:1.5}}>{d}</div>
                </div>
              ))}
            </div>
          )}

          {/* ✅ Creator: submit work — paymentStatus === "deposited" hone par dikhao */}
          {isCreator && isEscrowFunded && !isCompleted && (
            <div className="dd-card" style={{ border: "1.5px solid #fde68a", background: "#fffdf5" }}>
              <div className="dd-card-title">📤 Submit Your Work</div>
              {isWorkSubmitted ? (
                <div className="info info-green">✅ Work submitted! Waiting for brand approval.</div>
              ) : !showSubmit ? (
                <>
                  <div className="info info-orange" style={{marginBottom:10}}>
                    💰 Escrow is funded! Brand is waiting for your work. Submit when ready.
                  </div>
                  <button className="btn btn-submit" onClick={() => setShowSubmit(true)}>
                    📤 Submit Completed Work
                  </button>
                </>
              ) : (
                <div className="sf">
                  <label className="sf-lbl">Work Link / Drive URL</label>
                  <input className="sf-input" value={submitFile} onChange={e=>setSubmitFile(e.target.value)} placeholder="https://drive.google.com/..."/>
                  <label className="sf-lbl">Notes for Brand</label>
                  <textarea className="sf-ta" value={submitNote} onChange={e=>setSubmitNote(e.target.value)} placeholder="Describe what you've completed..."/>
                  <button className="btn btn-submit" disabled={actionLoading==="submit"} onClick={handleSubmitWork}>
                    {actionLoading==="submit" ? "⏳ Submitting..." : "✅ Submit Work"}
                  </button>
                  <button className="btn btn-ghost" style={{marginTop:6}} onClick={()=>setShowSubmit(false)}>Cancel</button>
                </div>
              )}
            </div>
          )}

          {/* Brand: view submitted work — from Deliverable collection */}
          {isBrand && isWorkSubmitted && (
            <div className="dd-card" style={{border:"1.5px solid #c7d2fe",background:"#f8f9ff"}}>
              <div className="dd-card-title">📩 Creator's Submission</div>
              {/* Note */}
              {(deliverable?.note || deal.submittedWork?.note) && (
                <div style={{fontSize:13,color:"#444",lineHeight:1.65,marginBottom:10,padding:"10px 12px",background:"#fff",borderRadius:10}}>
                  {deliverable?.note || deal.submittedWork?.note}
                </div>
              )}
              {/* Links */}
              {(deliverable?.links?.length > 0 || deal.submittedWork?.fileUrl || deal.submittedWork?.links?.[0]) ? (
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {(deliverable?.links || [deal.submittedWork?.fileUrl || deal.submittedWork?.links?.[0]]).filter(Boolean).map((link: string, i: number) => (
                    <a key={i} href={link} target="_blank" rel="noreferrer"
                      style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",background:"#fff",borderRadius:10,color:"#4f46e5",fontWeight:600,fontSize:13,textDecoration:"none",border:"1px solid #c7d2fe"}}>
                      📎 View Submitted Work {deliverable?.links?.length > 1 ? `(${i+1})` : ""} →
                    </a>
                  ))}
                </div>
              ) : (
                <div className="info info-blue">Work submitted — no link provided by creator.</div>
              )}
              {/* Submitted time */}
              {deliverable?.createdAt && (
                <div style={{fontSize:11,color:"#aaa",marginTop:8}}>
                  Submitted: {new Date(deliverable.createdAt).toLocaleString("en-IN")}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </>
  );
}

export default function DealDetailPage() {
  return (
    <Suspense fallback={
      <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f7f7f5"}}>
        <div style={{width:32,height:32,border:"3px solid #e0e0e0",borderTopColor:"#4f46e5",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    }>
      <DealDetailPageInner />
    </Suspense>
  );
}




