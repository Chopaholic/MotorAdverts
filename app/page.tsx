"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  where,
  QueryConstraint,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
} from "firebase/firestore";

/* ----------------------------- Types ----------------------------- */
type Listing = {
  id: string;
  title: string;
  year?: number | string;
  price: number;
  images?: string[];
  category?: string;
  location?: string;
  postTown?: string;
  seats?: number;
  fuelType?: string;
  hasTowBar?: boolean;
  hasWarranty?: boolean;
  createdAt?: any; // Firestore Timestamp
  lat?: number;
  lng?: number;
};

/* --------------------------- Constants --------------------------- */
const PAGE_SIZE = 60;

const CATEGORIES = ["Cars", "Vans", "Bikes", "Caravans", "Trucks", "Farm & Plant"] as const;

type QuickKey = "bargains" | "seats7" | "electric" | "tow" | "warranty" | "within30";

const QUICK_FILTERS: { key: QuickKey; label: string; desc: string }[] = [
  { key: "bargains", label: "Bargains", desc: "Cars priced at £1,500 or less." },
  { key: "seats7", label: "7 Seaters", desc: "Vehicles with 7 or more seats." },
  { key: "electric", label: "Electric", desc: "Battery-electric vehicles (no petrol/diesel)." },
  { key: "tow", label: "Tow Ready", desc: "Listings marked with a fitted tow bar." },
  { key: "warranty", label: "Warranty", desc: "Vehicles where the seller includes a warranty." },
  { key: "within30", label: "Within 30 Miles", desc: "Listings located within 30 miles of your position." },
];

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

// Premium placement
const BLOCK_SIZE = 15;
const PREMIUM_SLOT_IN_BLOCK = 11;

/* --------------------------- UI Helpers -------------------------- */
function Tooltip({ children, text }: { children: any; text: string }) {
  return (
    <div className="relative group w-full">
      {children}
      <div
        role="tooltip"
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-1 whitespace-nowrap rounded-none bg-black text-white text-xs px-2 py-1 shadow opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {text}
      </div>
    </div>
  );
}

/* ------------------------------ Tiles ------------------------------ */
function ListingTile({ x }: { x: Listing }) {
  return (
    <Link
      href={`/listing/${x.id}`}
      className="group relative rounded-none bg-white shadow-sm transition hover:shadow-md"
    >
      <div
        className="relative aspect-square bg-neutral-100 bg-cover bg-center"
        style={{ backgroundImage: x.images?.[0] ? `url(${x.images[0]})` : undefined }}
      >
        {x.category && (
          <span className="absolute left-1 bottom-1 z-10 rounded-none bg-black/55 px-1.5 py-0.5 text-[14px] font-medium text-white">
            {x.category}
          </span>
        )}
      </div>

      <div className="p-2">
        {/* Title 18px: Bold name + lighter year */}
        <div className="truncate text-[18px]">
          <span className="font-semibold">{x.title}</span>
          {x.year && <span className="font-normal text-neutral-700">{" - "}{x.year}</span>}
        </div>
        {/* Price + location 15px */}
        <div className="mt-1 flex items-center justify-between text-[15px] text-neutral-700">
          <span className="font-medium">{gbp.format(Number(x.price || 0))}</span>
          <span className="ml-2 truncate text-neutral-600 capitalize">
            {x.postTown ? x.postTown.toLowerCase() : ""}
          </span>
        </div>
      </div>
    </Link>
  );
}

function PremiumTile({ x }: { x: Listing }) {
  return (
    <Link
      href={`/listing/${x.id}?premium=1`}
      className="group relative block sm:col-span-2 rounded-none bg-white shadow-sm transition hover:shadow-md overflow-hidden"
    >
      <div
        className="relative aspect-[2/1] bg-neutral-100 bg-cover bg-center"
        style={{ backgroundImage: x.images?.[0] ? `url(${x.images[0]})` : undefined }}
      >
        {x.category && (
          <span className="absolute left-1 bottom-1 z-10 rounded-none bg-black/55 px-1.5 py-0.5 text-[14px] font-medium text-white">
            {x.category}
          </span>
        )}
      </div>

      <div className="p-2">
        {/* Title 18px */}
        <div className="truncate text-[18px]">
          <span className="font-semibold">{x.title}</span>
          {x.year && <span className="font-normal text-neutral-700">{" - "}{x.year}</span>}
        </div>
        {/* Price + location 15px */}
        <div className="mt-1 flex items-center justify-between text-[15px] text-neutral-700">
          <span className="font-medium">{gbp.format(Number(x.price || 0))}</span>
          <span className="ml-2 truncate text-neutral-600 capitalize flex items-center gap-1">
            {x.postTown ? x.postTown.toLowerCase() : ""}
            <span className="inline-block rounded-none bg-teal-600 text-white text-[13px] px-1 py-0.5 leading-none">
              Premium
            </span>
          </span>
        </div>
      </div>
    </Link>
  );
}

/* ------------------------------ Page ------------------------------ */
export default function Home() {
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);

  const [activeCat, setActiveCat] = useState<(typeof CATEGORIES)[number] | null>(null);
  const [activeQuick, setActiveQuick] = useState<QuickKey | null>(null);
  const [scrolled, setScrolled] = useState(false);

  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const buildConstraints = (): QueryConstraint[] => {
    const constraints: QueryConstraint[] = [];
    if (activeCat) constraints.push(where("category", "==", activeCat));
    switch (activeQuick) {
      case "bargains":
        constraints.push(where("price", "<=", 1500));
        break;
      case "seats7":
        constraints.push(where("seats", ">=", 7));
        break;
      case "electric":
        constraints.push(where("fuelType", "==", "Electric"));
        break;
      case "tow":
        constraints.push(where("hasTowBar", "==", true));
        break;
      case "warranty":
        constraints.push(where("hasWarranty", "==", true));
        break;
      case "within30":
        // TODO: add geospatial query
        break;
    }
    return constraints;
  };

  // Initial load
  useEffect(() => {
    (async () => {
      setLoading(true);
      setHasMore(true);
      setCursor(null);
      setItems([]);
      const base = collection(db, "listings");
      const constraints = buildConstraints();
      const q = query(base, ...constraints, orderBy("createdAt", "desc"), limit(PAGE_SIZE));
      const snap = await getDocs(q);
      const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Listing[];
      setItems(docs);
      setCursor(snap.docs.length ? snap.docs[snap.docs.length - 1] : null);
      setHasMore(snap.docs.length === PAGE_SIZE);
      setLoading(false);
    })();
  }, [activeCat, activeQuick]);

  // Load next page
  const loadMore = async () => {
    if (loadingMore || !hasMore || !cursor) return;
    setLoadingMore(true);
    const base = collection(db, "listings");
    const constraints = buildConstraints();
    const q = query(base, ...constraints, orderBy("createdAt", "desc"), startAfter(cursor), limit(PAGE_SIZE));
    const snap = await getDocs(q);
    const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Listing[];
    setItems((prev) => [...prev, ...docs]);
    setCursor(snap.docs.length ? snap.docs[snap.docs.length - 1] : null);
    setHasMore(snap.docs.length === PAGE_SIZE);
    setLoadingMore(false);
  };

  // Infinite scroll
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting && hasMore && !loading && !loadingMore) {
          loadMore();
        }
      },
      { rootMargin: "800px 0px 800px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, loadingMore, cursor, activeCat, activeQuick]);

  const nodes = useMemo(() => {
    if (loading && items.length === 0) return [];
    const out: Array<{ type: "listing"; data: Listing } | { type: "premium"; data: Listing }> = [];
    let i = 0;
    while (i < items.length) {
      for (let pos = 1; pos <= BLOCK_SIZE && i < items.length; pos++) {
        if (pos === PREMIUM_SLOT_IN_BLOCK) {
          out.push({ type: "premium", data: items[i] });
          i++;
        } else {
          out.push({ type: "listing", data: items[i] });
          i++;
        }
      }
    }
    return out;
  }, [items, loading]);

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
      {/* STICKY CATEGORY BAR */}
      <div className="sticky z-20 top-[var(--header-height)] -mt-[var(--header-height)]">
        <div
          className={[
            "relative left-1/2 w-screen -translate-x-1/2 transition-colors duration-300 backdrop-blur-sm",
            scrolled ? "bg-black/70" : "bg-black",
          ].join(" ")}
        >
          <div className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-6 py-2">
            <div className="flex items-center justify-between gap-3">
              {/* Category buttons */}
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
              <div className="w-px h-8 bg-neutral-400/50" />
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

        {/* QUICK FILTERS BAR */}
        <div className="relative left-1/2 w-screen -translate-x-1/2 bg-neutral-100/90 border-b border-neutral-200">
          <div className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-6 py-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-6 gap-1">
              {QUICK_FILTERS.map(({ key, label, desc }) => {
                const active = activeQuick === key;
                return (
                  <Tooltip key={key} text={desc}>
                    <button
                      onClick={() => setActiveQuick(active ? null : key)}
                      className={[
                        "w-full whitespace-nowrap px-2 py-1.5 text-xs sm:text-[13px] rounded-none border transition shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-600",
                        active
                          ? "bg-teal-600 text-white border-teal-700"
                          : "bg-white text-neutral-900 border-neutral-300 hover:bg-neutral-50",
                      ].join(" ")}
                      aria-pressed={active}
                      title={desc}
                    >
                      {label}
                    </button>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* LISTINGS GRID */}
      <div className="relative left-1/2 w-screen -translate-x-1/2 bg-neutral-50">
        <main className="pt-[calc(var(--header-height)+0.5rem)] mx-auto max-w-7xl px-3 sm:px-4 lg:px-6 py-4">
          <section className="grid gap-1 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 grid-flow-dense">
            {loading && skeletons}
            {!loading && items.length === 0 && (
              <div className="col-span-full bg-white p-6 text-center text-sm text-neutral-600 rounded-none shadow-sm">
                No listings found
                {activeCat ? ` in ${activeCat}` : ""}
                {activeQuick ? ` • filter: ${QUICK_FILTERS.find((f) => f.key === activeQuick)?.label}` : ""}
                .
              </div>
            )}
            {!loading &&
              nodes.map((n, idx) =>
                n.type === "premium" ? (
                  <PremiumTile key={`p-${n.data.id}-${idx}`} x={n.data} />
                ) : (
                  <ListingTile key={n.data.id} x={n.data} />
                )
              )}
          </section>

          <div ref={loadMoreRef} className="h-12"></div>

          {loadingMore && (
            <div className="py-4 text-center text-sm text-neutral-600">Loading more…</div>
          )}
          {!loading && !loadingMore && !hasMore && items.length > 0 && (
            <div className="py-6 text-center text-sm text-neutral-500">You’ve reached the end.</div>
          )}
        </main>
      </div>
    </div>
  );
}
