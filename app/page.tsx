"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, limit, getDocs, where } from "firebase/firestore";

type Listing = {
  id: string;
  title: string;
  price: number;
  images?: string[];
  category?: string;
  location?: string;
  postTown?: string;
};

// No "All"
const CATEGORIES = ["Cars", "Vans", "Bikes", "Caravans", "Trucks", "Farm & Plant"] as const;

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

export default function Home() {
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState<(typeof CATEGORIES)[number] | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const base = collection(db, "listings");
      const q = activeCat
        ? query(base, where("category", "==", activeCat), orderBy("createdAt", "desc"), limit(60))
        : query(base, orderBy("createdAt", "desc"), limit(60));

      const snap = await getDocs(q);
      setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      setLoading(false);
    })();
  }, [activeCat]);

  const skeletons = useMemo(
    () =>
      Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="rounded-none bg-white shadow-sm animate-pulse">
          <div className="aspect-square bg-neutral-100" />
          <div className="p-2 space-y-2">
            <div className="h-3.5 w-3/4 bg-neutral-100" />
            <div className="h-3.5 w-1/3 bg-neutral-100" />
          </div>
        </div>
      )),
    []
  );

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* FULL-BLEED, STICKY CATEGORY BAR */}
      <div
        className="
          sticky z-20
          top-[var(--header-height)]
          -mt-[var(--header-height)]
        "
      >
        <div
          className={[
            "relative left-1/2 w-screen -translate-x-1/2 transition-colors duration-300 backdrop-blur-sm",
            scrolled ? "bg-black/70" : "bg-black",
          ].join(" ")}
        >
          <div className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-6 py-2">
            <div className="flex items-center justify-between gap-3">
              {/* Category buttons (6 columns now) */}
              <div className="grid grid-cols-6 gap-1 flex-1">
                {CATEGORIES.map((c) => {
                  const active = c === activeCat;
                  return (
                    <button
                      key={c}
                      onClick={() => setActiveCat(c === activeCat ? null : c)}
                      className={[
                        "w-full px-3 py-2 text-sm border rounded-none transition text-center",
                        active
                          ? "text-white bg-gradient-to-b from-teal-500 to-teal-700 hover:from-teal-600 hover:to-teal-800 border-teal-700"
                          : "bg-white text-neutral-900 border-neutral-300 hover:bg-neutral-100",
                      ].join(" ")}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>

              {/* Divider */}
              <div className="w-px h-8 bg-neutral-400/50" />

              {/* Filter + Sort buttons with vertical gradient */}
              <div className="flex gap-2">
                <button className="px-3 py-2 text-sm text-white bg-gradient-to-b from-teal-500 to-teal-700 hover:from-teal-600 hover:to-teal-800 transition rounded-none">
                  Filter
                </button>
                <button className="px-3 py-2 text-sm text-white bg-gradient-to-b from-teal-500 to-teal-700 hover:from-teal-600 hover:to-teal-800 transition rounded-none">
                  Sort
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FULL-BLEED very light grey background behind adverts */}
      <div className="relative left-1/2 w-screen -translate-x-1/2 bg-neutral-50">
        {/* adverts start just below header + categories */}
        <main className="pt-[calc(var(--header-height)+0.5rem)] mx-auto max-w-7xl px-3 sm:px-4 lg:px-6 py-4">
          <section className="grid gap-1 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {loading && skeletons}

            {!loading && items.length === 0 && (
              <div className="col-span-full bg-white p-6 text-center text-sm text-neutral-600 rounded-none shadow-sm">
                No listings found{activeCat ? ` in ${activeCat}` : ""}.
              </div>
            )}

            {!loading &&
              items.map((x) => (
                <Link
                  key={x.id}
                  href={`/listing/${x.id}`}
                  className="group relative rounded-none bg-white shadow-sm transition hover:shadow-md"
                >
                  {/* Category badge */}
                  {x.category && (
                    <span className="absolute left-1 top-1 z-10 rounded-none bg-black/55 px-1.5 py-0.5 text-[11px] font-medium text-white">
                      {x.category}
                    </span>
                  )}

                  <div
                    className="aspect-square bg-neutral-100 bg-cover bg-center"
                    style={{
                      backgroundImage: x.images?.[0]
                        ? `url(${x.images[0]})`
                        : undefined,
                    }}
                  />
                  <div className="p-2">
                    <div className="truncate text-[15px] font-semibold">{x.title}</div>

                    {/* Price + Post Town */}
                    <div className="mt-1 flex items-center justify-between text-[13px] text-neutral-700">
                      <span className="font-medium">
                        {gbp.format(Number(x.price || 0))}
                      </span>
                      <span className="ml-2 truncate text-neutral-600 capitalize">
                        {x.postTown ? x.postTown.toLowerCase() : ""}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
          </section>
        </main>
      </div>
    </div>
  );
}
