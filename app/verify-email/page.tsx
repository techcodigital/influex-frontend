"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const API = "https://api.collabzy.in/api";

type Status = "loading" | "success" | "error";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token        = searchParams.get("token") ?? "";

  const [status,  setStatus]  = useState<Status>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Invalid or missing verification token.");
      return;
    }

    const verify = async () => {
      try {
        const res  = await fetch(`${API}/auth/verify-email?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Verification failed");
        setStatus("success");
        setMessage(data.message || "Email verified successfully!");
      } catch (err: any) {
        setStatus("error");
        setMessage(err.message || "Verification failed. The link may have expired.");
      }
    };

    verify();
  }, [token]);

  return (
    <div style={{minHeight:"80vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"48px 24px",background:"#f8fafc"}}>
      <div style={{maxWidth:440,width:"100%",background:"#fff",borderRadius:32,padding:"48px 36px",boxShadow:"0 20px 60px rgba(79,70,229,0.08)",border:"1px solid #e2e8f0",textAlign:"center"}}>

        {/* Logo */}
        <div style={{width:85,height:32,background:"linear-gradient(135deg,#4f46e5,#7c3aed)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:600,fontSize:12,margin:"0 auto 32px",boxShadow:"0 4px 12px rgba(79,70,229,0.25)"}}>
          Collabzy
        </div>

        {status === "loading" && (
          <>
            {/* Spinner */}
            <div style={{width:56,height:56,border:"4px solid #e2e8f0",borderTop:"4px solid #4f46e5",borderRadius:"50%",margin:"0 auto 20px",animation:"spin 0.8s linear infinite"}} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <h2 style={{fontSize:22,fontWeight:800,color:"#0f172a",marginBottom:8}}>Verifying Email…</h2>
            <p style={{fontSize:14,color:"#64748b",margin:0}}>Please wait a moment</p>
          </>
        )}

        {status === "success" && (
          <>
            <div style={{width:64,height:64,background:"#f0fdf4",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px",fontSize:32}}>✅</div>
            <h2 style={{fontSize:24,fontWeight:800,color:"#0f172a",marginBottom:10}}>Email Verified!</h2>
            <p style={{fontSize:14,color:"#64748b",marginBottom:28}}>{message}</p>
            <Link
              href="/login"
              style={{display:"inline-block",padding:"13px 32px",background:"linear-gradient(135deg,#4f46e5,#7c3aed)",color:"#fff",borderRadius:14,fontSize:15,fontWeight:700,textDecoration:"none",boxShadow:"0 4px 16px rgba(79,70,229,0.3)"}}
            >
              Go to Login
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <div style={{width:64,height:64,background:"#fff5f5",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px",fontSize:32}}>❌</div>
            <h2 style={{fontSize:24,fontWeight:800,color:"#0f172a",marginBottom:10}}>Verification Failed</h2>
            <p style={{fontSize:14,color:"#64748b",marginBottom:28}}>{message}</p>
            <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
              <Link
                href="/login"
                style={{display:"inline-block",padding:"12px 24px",background:"linear-gradient(135deg,#4f46e5,#7c3aed)",color:"#fff",borderRadius:14,fontSize:14,fontWeight:700,textDecoration:"none",boxShadow:"0 4px 16px rgba(79,70,229,0.3)"}}
              >
                Back to Login
              </Link>
              <Link
                href="/join"
                style={{display:"inline-block",padding:"12px 24px",background:"#f1f5f9",color:"#4f46e5",borderRadius:14,fontSize:14,fontWeight:700,textDecoration:"none"}}
              >
                Create Account
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div style={{minHeight:"80vh",display:"flex",alignItems:"center",justifyContent:"center"}}>Loading…</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}