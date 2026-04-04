"use client";

import { useState } from "react";

interface FormData {
  name: string;
  phone: string;
  email: string;
  description: string;
}

interface FormErrors {
  name?: string;
  phone?: string;
  email?: string;
  description?: string;
}

export default function ContactPage() {
  const [formData, setFormData] = useState<FormData>({
    name: "",
    phone: "",
    email: "",
    description: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!formData.name.trim()) e.name = "Name is required";
    if (!formData.phone.trim()) e.phone = "Phone number is required";
    else if (!/^\+?[\d\s\-(]{7,15}$/.test(formData.phone)) e.phone = "Enter a valid phone number";
    if (!formData.email.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) e.email = "Enter a valid email";
    if (!formData.description.trim()) e.description = "Description is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      setStatus(res.ok ? "success" : "error");
      if (res.ok) setFormData({ name: "", phone: "", email: "", description: "" });
    } catch {
      setStatus("error");
    }
  };

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData((p) => ({ ...p, [field]: value }));
    if (errors[field]) setErrors((p) => ({ ...p, [field]: undefined }));
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700;1,900&family=DM+Sans:wght@300;400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; background: #060912; min-height: 100vh; color: #e8eaf0; }

        .page {
          min-height: 100vh;
          display: flex; align-items: center; justify-content: center;
          padding: 40px 20px;
          position: relative; overflow: hidden;
        }

        .bg { position: fixed; inset: 0; z-index: 0; overflow: hidden; }
        .bg-gradient {
          position: absolute; inset: 0;
          background:
            radial-gradient(ellipse 90% 70% at 15% 10%, rgba(88,28,235,0.22) 0%, transparent 55%),
            radial-gradient(ellipse 70% 60% at 85% 85%, rgba(6,182,212,0.18) 0%, transparent 55%),
            radial-gradient(ellipse 50% 40% at 50% 50%, rgba(139,92,246,0.08) 0%, transparent 60%),
            #060912;
        }
        .bg-orb1 {
          position: absolute; width: 700px; height: 700px; border-radius: 50%;
          background: radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%);
          top: -150px; left: -180px;
          animation: float1 9s ease-in-out infinite;
        }
        .bg-orb2 {
          position: absolute; width: 600px; height: 600px; border-radius: 50%;
          background: radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%);
          bottom: -100px; right: -140px;
          animation: float2 11s ease-in-out infinite;
        }
        .bg-grid {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
          background-size: 48px 48px;
        }
        .bg-dots {
          position: absolute; inset: 0;
          background-image: radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px);
          background-size: 24px 24px;
        }

        @keyframes float1 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(30px,20px) scale(1.05)} }
        @keyframes float2 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-20px,-30px) scale(0.95)} }

        .card {
          position: relative; z-index: 1;
          width: 100%; max-width: 540px;
          background: rgba(8,12,24,0.82);
          border: 1px solid rgba(124,58,237,0.2);
          border-radius: 28px;
          padding: 52px 48px;
          backdrop-filter: blur(32px);
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.04),
            0 40px 80px rgba(0,0,0,0.6),
            0 0 100px rgba(88,28,235,0.1),
            inset 0 1px 0 rgba(255,255,255,0.06);
          animation: cardIn 0.7s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(28px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        .badge {
          display: inline-flex; align-items: center; gap: 7px;
          background: rgba(124,58,237,0.1);
          border: 1px solid rgba(124,58,237,0.22);
          border-radius: 100px; padding: 5px 14px;
          font-size: 10.5px; font-weight: 500; color: #a78bfa;
          letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 22px;
        }
        .bdot { width: 6px; height: 6px; border-radius: 50%; background: #7c3aed; animation: pulse 2.2s ease-in-out infinite; }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.75)} }

        .title {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 42px; font-weight: 900;
          line-height: 1.05; letter-spacing: -1.5px; margin-bottom: 10px;
          background: linear-gradient(135deg, #ffffff 0%, #e0d7ff 30%, #a78bfa 60%, #22d3ee 100%);
          background-size: 300% 300%;
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
          animation: shine 6s ease-in-out infinite;
        }
        .title em { font-style: italic; font-weight: 700; }
        @keyframes shine { 0%,100%{background-position:200% center} 50%{background-position:-200% center} }

        .subtitle { font-size: 13.5px; color: rgba(232,234,240,0.38); margin-bottom: 38px; line-height: 1.65; font-weight: 300; }

        .field { margin-bottom: 18px; }
        label { display: block; font-size: 11px; font-weight: 500; color: rgba(232,234,240,0.42); letter-spacing: 0.07em; text-transform: uppercase; margin-bottom: 7px; }

        input, textarea {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 14px;
          padding: 13px 15px;
          font-family: 'DM Sans', sans-serif; font-size: 14px; color: #e8eaf0;
          outline: none;
          transition: border-color 0.25s, background 0.25s, box-shadow 0.25s;
          -webkit-appearance: none;
        }
        textarea { resize: none; height: 110px; }
        input::placeholder, textarea::placeholder { color: rgba(232,234,240,0.18); }
        input:focus, textarea:focus {
          border-color: rgba(124,58,237,0.55);
          background: rgba(124,58,237,0.06);
          box-shadow: 0 0 0 3px rgba(124,58,237,0.1);
        }
        input.err, textarea.err { border-color: rgba(248,113,113,0.45) !important; background: rgba(248,113,113,0.04) !important; }
        .errt { font-size: 11px; color: #f87171; margin-top: 5px; display: flex; align-items: center; gap: 4px; animation: errIn 0.2s ease both; }
        @keyframes errIn { from{opacity:0;transform:translateX(-6px)} to{opacity:1;transform:translateX(0)} }

        .btn {
          width: 100%; margin-top: 26px; padding: 15px; border: none; border-radius: 14px;
          font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500; letter-spacing: 0.03em; cursor: pointer;
          position: relative; overflow: hidden;
          background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 40%, #0891b2 100%);
          color: #fff;
          transition: transform 0.15s, box-shadow 0.15s, opacity 0.15s;
          box-shadow: 0 4px 24px rgba(124,58,237,0.4), inset 0 1px 0 rgba(255,255,255,0.15);
        }
        .btn::before { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(255,255,255,0.14) 0%, transparent 50%); border-radius: inherit; }
        .btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 32px rgba(124,58,237,0.5); }
        .btn:active:not(:disabled) { transform: translateY(0); }
        .btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .btn-in { display: flex; align-items: center; justify-content: center; gap: 10px; position: relative; z-index: 1; }
        .spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to{transform:rotate(360deg)} }

        .success { text-align: center; padding: 16px 0 4px; animation: successPop 0.5s cubic-bezier(0.16,1,0.3,1) both; }
        @keyframes successPop { 0%{opacity:0;transform:scale(0.7)} 60%{transform:scale(1.08)} 100%{opacity:1;transform:scale(1)} }
        .s-icon { width: 72px; height: 72px; background: linear-gradient(135deg, rgba(34,211,238,0.15), rgba(124,58,237,0.2)); border: 1px solid rgba(34,211,238,0.25); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 30px; }
        .s-title { font-family: 'Playfair Display', serif; font-size: 26px; font-weight: 900; letter-spacing: -0.5px; background: linear-gradient(135deg, #fff, #22d3ee); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin-bottom: 8px; }
        .s-sub { font-size: 13px; color: rgba(232,234,240,0.38); line-height: 1.6; }
        .reset { margin-top: 24px; background: transparent; border: 1px solid rgba(124,58,237,0.2); border-radius: 10px; padding: 9px 22px; font-family: 'DM Sans', sans-serif; font-size: 12px; color: rgba(167,139,250,0.65); cursor: pointer; transition: border-color 0.2s, color 0.2s; }
        .reset:hover { border-color: rgba(124,58,237,0.5); color: #a78bfa; }

        .ebanner { background: rgba(248,113,113,0.08); border: 1px solid rgba(248,113,113,0.2); border-radius: 10px; padding: 11px 14px; font-size: 12.5px; color: #fca5a5; margin-top: 14px; text-align: center; }
        .hr { border: none; border-top: 1px solid rgba(255,255,255,0.05); margin: 28px 0 22px; }
        .fnote { font-size: 10.5px; color: rgba(232,234,240,0.2); text-align: center; line-height: 1.6; }

        @media (max-width: 580px) { .card { padding: 36px 22px; } .title { font-size: 32px; } }
      `}</style>

      <div className="bg">
        <div className="bg-gradient" />
        <div className="bg-orb1" />
        <div className="bg-orb2" />
        <div className="bg-grid" />
        <div className="bg-dots" />
      </div>

      <div className="page">
        <div className="card">
          {status === "success" ? (
            <div className="success">
              <div className="s-icon">✓</div>
              <div className="s-title">Message Sent!</div>
              <p className="s-sub">Thanks for reaching out. Our team will get back to you soon.</p>
              <button className="reset" onClick={() => setStatus("idle")}>Send another message</button>
            </div>
          ) : (
            <>
              <div className="badge"><span className="bdot" /> Collabyz</div>
              <div className="title"><em>Let&rsquo;s</em> Connect.</div>
              <p className="subtitle">Have a project or idea? Drop us a message and we'll be in touch soon.</p>

              {[
                { id: "name", label: "Full Name", type: "text", placeholder: "Rahul Sharma" },
                { id: "phone", label: "Phone Number", type: "tel", placeholder: "+91 98765 43210" },
                { id: "email", label: "Email Address", type: "email", placeholder: "you@example.com" },
              ].map(({ id, label, type, placeholder }) => (
                <div className="field" key={id}>
                  <label htmlFor={id}>{label}</label>
                  <input
                    id={id} type={type} placeholder={placeholder}
                    value={formData[id as keyof FormData]}
                    onChange={(e) => handleChange(id as keyof FormData, e.target.value)}
                    className={errors[id as keyof FormErrors] ? "err" : ""}
                  />
                  {errors[id as keyof FormErrors] && <p className="errt">⚠ {errors[id as keyof FormErrors]}</p>}
                </div>
              ))}

              <div className="field">
                <label htmlFor="description">Your Message</label>
                <textarea
                  id="description" placeholder="Tell us about your project or idea..."
                  value={formData.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  className={errors.description ? "err" : ""}
                />
                {errors.description && <p className="errt">⚠ {errors.description}</p>}
              </div>

              <button className="btn" onClick={handleSubmit} disabled={status === "loading"}>
                <span className="btn-in">
                  {status === "loading" ? <><span className="spinner" /> Sending...</> : "Send Message →"}
                </span>
              </button>

              {status === "error" && <p className="ebanner">Something went wrong. Please try again.</p>}

              <hr className="hr" />
              <p className="fnote">Your message goes directly to our team at collabzy.admin@gmail.com</p>
            </>
          )}
        </div>
      </div>
    </>
  );
}


