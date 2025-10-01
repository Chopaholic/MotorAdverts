"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

type Listing = {
  id: string;
  title: string;
  price: number;
  images?: string[];
  category?: string;
  make?: string;
  model?: string;
  year?: number;
  mileage?: number; // bikes/farm may be “hours”
  fuel?: string;
  transmission?: string;
  body?: string;
  colour?: string;
  description?: string;
  postTown?: string;
};

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

export default function ListingPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        if (!params?.id) return;
        const ref = doc(db, "listings", params.id);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          router.replace("/"); // or show a 404 UI
          return;
        }
        setItem({ id: snap.id, ...(snap.data() as any) });
      } finally {
        setLoading(false);
      }
    })();
  }, [params?.id, router]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6 grid gap-6 lg:grid-cols-2">
        <div className="aspect-square bg-neutral-100 animate-pulse" />
        <div className="space-y-3">
          <div className="h-8 w-2/3 bg-neutral-100 animate-pulse" />
          <div className="h-4 w-1/2 bg-neutral-100 animate-pulse" />
          <div className="h-24 bg-neutral-100 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 text-center">
        <p className="text-sm text-neutral-600">Listing not found.</p>
        <Link className="mt-3 inline-block border px-3 py-1.5 rounded-none" href="/">Back to Home</Link>
      </div>
    );
  }

  const images = Array.isArray(item.images) && item.images.length > 0 ? item.images : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 grid gap-6 lg:grid-cols-2">
      {/* Gallery */}
      <div>
        <div className="aspect-square bg-neutral-100 overflow-hidden">
          <img
            src={images[0]}
            alt={item.title}
            className="w-full h-full object-cover"
            loading="eager"
            decoding="async"
          />
        </div>
        {images.length > 1 && (
          <div className="mt-2 grid grid-cols-3 gap-2">
            {images.slice(1).map((src, i) => (
              <div key={i} className="aspect-square overflow-hidden bg-neutral-100">
                <img src={src} alt={`${item.title} ${i + 2}`} className="w-full h-full object-cover" loading="lazy" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Details */}
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">{item.title}</h1>
          <div className="mt-1 flex items-center justify-between text-sm text-neutral-700">
            <span className="text-lg font-semibold">{gbp.format(Number(item.price || 0))}</span>
            <span className="capitalize text-neutral-600">{item.postTown ? String(item.postTown).toLowerCase() : ""}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          {item.category && <Spec label="Category" value={item.category} />}
          {item.year != null && <Spec label="Year" value={String(item.year)} />}
          {item.make && <Spec label="Make" value={item.make} />}
          {item.model && <Spec label="Model" value={item.model} />}
          {item.mileage != null && <Spec label={item.category === "Farm & Plant" ? "Hours" : "Mileage"} value={item.mileage.toLocaleString()} />}
          {item.fuel && <Spec label="Fuel" value={item.fuel} />}
          {item.transmission && <Spec label="Transmission" value={item.transmission} />}
          {item.body && <Spec label="Body" value={item.body} />}
          {item.colour && <Spec label="Colour" value={item.colour} />}
        </div>

        {item.description && (
          <div className="border-t pt-3 text-sm text-neutral-800 whitespace-pre-wrap">
            {item.description}
          </div>
        )}

        <div className="pt-2">
          <Link href="/" className="inline-block border px-3 py-1.5 rounded-none hover:bg-neutral-50">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border bg-white p-2 rounded-none">
      <span className="text-neutral-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
