"use client";
import { useState } from "react";
import { auth } from "@/lib/firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [mode, setMode] = useState<"in"|"up">("in");
  const go = async () => {
    if (mode === "in") await signInWithEmailAndPassword(auth, email, pw);
    else await createUserWithEmailAndPassword(auth, email, pw);
    alert("Success!");
  };
  return (
    <main style={{maxWidth:420,margin:"40px auto",display:"grid",gap:12}}>
      <h1>{mode==="in"?"Sign in":"Create account"}</h1>
      <input placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} />
      <input placeholder="password" type="password" value={pw} onChange={e=>setPw(e.target.value)} />
      <button onClick={go}>{mode==="in"?"Sign in":"Sign up"}</button>
      <button onClick={()=>setMode(mode==="in"?"up":"in")}>
        {mode==="in"?"Need an account? Sign up":"Have one? Sign in"}
      </button>
    </main>
  );
}