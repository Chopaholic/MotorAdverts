"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase"; // make sure lib/firebase exports `auth`

export default function ClientHeader() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<null | { uid: string; displayName?: string }>(null);
  const [query, setQuery] = useState<string>(searchParams.get("q") ?? "");

  // Watch auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u ? { uid: u.uid, displayName: u.displayName ?? undefined } : null);
    });
    return () => unsub();
  }, []);

  // Submit search to home with ?q=
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = query.trim();
    const url = q ? `/?q=${encodeURIComponent(q)}` : "/";
    router.push(url);
  };

  const handleSignOut = async () => {
    await signOut(auth);
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-white/85 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 h-28 flex items-center gap-3">
        {/* Brand */}
        <Link href="/" className="text-3xl font-bold tracking-tight leading-none">
          MotorAdverts
        </Link>

        {/* Search (grows to fill the middle) */}
        <form onSubmit={onSubmit} className="flex-1 flex items-center">
          <input
            type="search"
            name="q"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search cars, vans, bikes..."
            className="
              w-full px-4 py-3
              bg-white border border-neutral-300
              rounded-none
              outline-none focus:border-neutral-500
              placeholder:text-neutral-400
            "
            aria-label="Search listings"
          />
        </form>

        {/* Actions */}
        <nav className="flex items-center gap-3 text-sm">
          <Link
            href="/create-listing"
            className="rounded-none border border-neutral-300 px-3 py-2 hover:bg-neutral-50"
          >
            Post a listing
          </Link>

          {user ? (
            <button
              onClick={handleSignOut}
              className="rounded-none bg-black text-white px-3 py-2 hover:opacity-90"
            >
              Sign out
            </button>
          ) : (
            <Link
              href="/sign-in"
              className="rounded-none bg-black text-white px-3 py-2 hover:opacity-90"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
