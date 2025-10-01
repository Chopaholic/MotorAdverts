"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";

/* ------------------------------- UI helpers ------------------------------- */
const inputClass =
  "w-full border px-3 py-2 rounded-none bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900/10";
const cardClass = "border bg-white p-4 shadow-sm rounded-none";

/* ----------------------------- sample datasets ---------------------------- */
const CARS = [
  ["Ford", "Fiesta", "Hatchback"],
  ["Volkswagen", "Golf", "Hatchback"],
  ["BMW", "3 Series", "Saloon"],
  ["Audi", "A3", "Hatchback"],
  ["Mercedes-Benz", "C-Class", "Saloon"],
  ["Nissan", "Qashqai", "SUV"],
  ["Toyota", "Yaris", "Hatchback"],
  ["Kia", "Sportage", "SUV"],
] as const;

const VANS = [
  ["Ford", "Transit Custom", "Van"],
  ["Mercedes-Benz", "Sprinter", "Van"],
  ["Volkswagen", "Transporter T6", "Van"],
  ["Vauxhall", "Vivaro", "Van"],
] as const;

const BIKES = [
  ["Yamaha", "R1"],
  ["Honda", "CBR600RR"],
  ["Kawasaki", "Ninja 650"],
  ["Ducati", "Monster 821"],
  ["BMW", "R1250GS"],
] as const;

const CARAVANS = [
  ["Swift", "Challenger 580", "Caravan"],
  ["Bailey", "Unicorn Cadiz", "Caravan"],
  ["Elddis", "Avante 550", "Caravan"],
] as const;

const TRUCKS = [
  ["Scania", "R450"],
  ["Volvo", "FH16"],
  ["DAF", "XF 530"],
] as const;

const FARM_PLANT = [
  ["John Deere", "6155R", "Tractor"],
  ["Massey Ferguson", "7718S", "Tractor"],
  ["JCB", "3CX", "Digger"],
  ["Caterpillar", "320", "Excavator"],
] as const;

const FUELS = ["Petrol", "Diesel", "Hybrid", "Electric"] as const;
const GEARS = ["Manual", "Automatic"] as const;
const COLOURS = ["Black", "White", "Grey", "Blue", "Red", "Silver"] as const;

const TOWNS = ["London", "Manchester", "Leeds", "Birmingham", "Glasgow", "Bristol"] as const;
const POSTCODES = ["SW1A1AA", "M11AE", "LS12AB", "B11AA", "G21AA", "BS11AA"] as const;

/* ------------------------------ image helpers ----------------------------- */
// Simple random picsum (not category-aware but always works in dev)
function photoUrl(seed: string, w = 900, h = 900) {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;
}

/** Always 3 images per listing */
function imagesForListing(
  category: string,
  make: string,
  model: string,
  year: number,
  index: number,
  w = 900,
  h = 900
) {
  return [
    photoUrl(`${category}-${make}-${model}-${year}-${index}-1`, w, h),
    photoUrl(`${category}-${make}-${model}-${year}-${index}-2`, w, h),
    photoUrl(`${category}-${make}-${model}-${year}-${index}-3`, w, h),
  ];
}

/* ------------------------------ small helpers ----------------------------- */
const pick = <T,>(arr: readonly T[], i: number) => arr[i % arr.length];
const randInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

/* -------------------------------- factories ------------------------------- */
function makeCar(i: number) {
  const [make, model, body] = pick(CARS, i);
  const year = randInt(2008, 2023);
  const mileage = randInt(20000, 120000);
  const price = randInt(1500, 18000);
  const fuel = pick(FUELS, i);
  const trans = pick(GEARS, i);
  const colour = pick(COLOURS, i);
  const title = `${year} ${make} ${model} ${body}`;

  return {
    category: "Cars" as const,
    make,
    model,
    year,
    mileage,
    fuel,
    transmission: trans,
    body,
    colour,
    price,
    title,
    description: `${title} in ${colour}. ${mileage.toLocaleString()} miles, ${fuel}, ${trans}.`,
    images: imagesForListing("Cars", make, model, year, i),
  };
}

function makeVan(i: number) {
  const [make, model, body] = pick(VANS, i);
  const year = randInt(2010, 2023);
  const mileage = randInt(50000, 200000);
  const price = randInt(2500, 25000);
  const fuel = "Diesel";
  const trans = pick(GEARS, i);
  const colour = pick(COLOURS, i);
  const title = `${year} ${make} ${model}`;

  return {
    category: "Vans" as const,
    make,
    model,
    year,
    mileage,
    fuel,
    transmission: trans,
    body,
    colour,
    price,
    title,
    description: `${title} in ${colour}. ${mileage.toLocaleString()} miles, ready for work.`,
    images: imagesForListing("Vans", make, model, year, i),
  };
}

function makeBike(i: number) {
  const [make, model] = pick(BIKES, i);
  const year = randInt(2012, 2023);
  const mileage = randInt(1000, 30000);
  const price = randInt(1200, 9000);
  const colour = pick(COLOURS, i);
  const title = `${year} ${make} ${model}`;

  return {
    category: "Bikes" as const,
    make,
    model,
    year,
    mileage,
    fuel: "Petrol",
    transmission: "Manual",
    body: "Bike",
    colour,
    price,
    title,
    description: `${title} in ${colour}. ${mileage.toLocaleString()} miles.`,
    images: imagesForListing("Bikes", make, model, year, i),
  };
}

function makeCaravan(i: number) {
  const [make, model, body] = pick(CARAVANS, i);
  const year = randInt(2008, 2023);
  const price = randInt(2500, 20000);
  const colour = pick(COLOURS, i);
  const title = `${year} ${make} ${model}`;

  return {
    category: "Caravans" as const,
    make,
    model,
    year,
    mileage: 0,
    fuel: "N/A",
    transmission: "N/A",
    body,
    colour,
    price,
    title,
    description: `${title} ${colour} finish, spacious and well maintained.`,
    images: imagesForListing("Caravans", make, model, year, i),
  };
}

function makeTruck(i: number) {
  const [make, model] = pick(TRUCKS, i);
  const year = randInt(2012, 2023);
  const mileage = randInt(200000, 800000);
  const price = randInt(12000, 60000);
  const colour = pick(COLOURS, i);
  const title = `${year} ${make} ${model}`;

  return {
    category: "Trucks" as const,
    make,
    model,
    year,
    mileage,
    fuel: "Diesel",
    transmission: "Automatic",
    body: "Truck",
    colour,
    price,
    title,
    description: `${title} ${mileage.toLocaleString()} km, fleet maintained.`,
    images: imagesForListing("Trucks", make, model, year, i),
  };
}

function makeFarmPlant(i: number) {
  const [make, model, body] = pick(FARM_PLANT, i);
  const year = randInt(2005, 2023);
  const mileage = randInt(500, 5000); // treat as hours
  const price = randInt(4000, 55000);
  const colour = pick(COLOURS, i);
  const title = `${year} ${make} ${model}`;

  return {
    category: "Farm & Plant" as const,
    make,
    model,
    year,
    mileage,
    fuel: "Diesel",
    transmission: "Manual",
    body,
    colour,
    price,
    title,
    description: `${title}, ${mileage.toLocaleString()} hours, ready for work.`,
    images: imagesForListing("Farm & Plant", make, model, year, i),
  };
}

/* ------------------------------ seeder logic ----------------------------- */
export default function SeedPage() {
  const [count, setCount] = useState({
    cars: 10,
    vans: 10,
    bikes: 10,
    caravans: 5,
    trucks: 5,
    farm: 5,
  });
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const isDevSafe = useMemo(() => {
    if (typeof window === "undefined") return false;
    const host = window.location.hostname || "";
    const local =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host.endsWith(".local") ||
      /^192\.168\./.test(host) ||
      /^10\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);
    const allowEnv = process.env.NEXT_PUBLIC_ALLOW_SEED === "true";
    return local || allowEnv;
  }, []);

  const append = (line: string) => setLog((l) => [...l, line]);

  async function wipeMine() {
    const user = auth.currentUser;
    if (!user) throw new Error("Sign in first.");

    append("Wiping existing listings…");
    const listingsQ = query(collection(db, "listings"), where("ownerUid", "==", user.uid));
    const snap = await getDocs(listingsQ);
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(doc(db, "listings", d.id)));
    await batch.commit();

    const privQ = query(collection(db, "listings_private"), where("ownerUid", "==", user.uid));
    const privSnap = await getDocs(privQ);
    const batch2 = writeBatch(db);
    privSnap.docs.forEach((d) => batch2.delete(doc(db, "listings_private", d.id)));
    await batch2.commit();

    append(`Deleted ${snap.size} listing(s) and ${privSnap.size} private record(s).`);
  }

  type Kind = "Cars" | "Vans" | "Bikes" | "Caravans" | "Trucks" | "Farm & Plant";

  function build(kind: Kind, index: number) {
    switch (kind) {
      case "Cars": return makeCar(index);
      case "Vans": return makeVan(index);
      case "Bikes": return makeBike(index);
      case "Caravans": return makeCaravan(index);
      case "Trucks": return makeTruck(index);
      case "Farm & Plant": return makeFarmPlant(index);
    }
  }

  async function seedOne(kind: Kind, index: number, ownerUid: string) {
    const base = build(kind, index);

    const pubRef = await addDoc(collection(db, "listings"), {
      ...base,
      ownerUid,
      status: "live",
      isPremium: false,
      premiumUntil: null,
      postTown: TOWNS[index % TOWNS.length],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await addDoc(collection(db, "listings_private"), {
      listingId: pubRef.id,
      ownerUid,
      postcode: POSTCODES[index % POSTCODES.length],
      createdAt: serverTimestamp(),
    });
  }

  async function run() {
    if (!isDevSafe) {
      alert(
        "Seeding is disabled on this host. Run on localhost/your LAN, or set NEXT_PUBLIC_ALLOW_SEED=true to override."
      );
      return;
    }
    if (!auth.currentUser) {
      alert("Please sign in first so listings are owned by your user.");
      return;
    }

    setBusy(true);
    setLog([]);
    try {
      await wipeMine();

      const ownerUid = auth.currentUser!.uid;
      const tasks: Promise<any>[] = [];
      for (let i = 0; i < count.cars; i++) tasks.push(seedOne("Cars", i, ownerUid));
      for (let i = 0; i < count.vans; i++) tasks.push(seedOne("Vans", i, ownerUid));
      for (let i = 0; i < count.bikes; i++) tasks.push(seedOne("Bikes", i, ownerUid));
      for (let i = 0; i < count.caravans; i++) tasks.push(seedOne("Caravans", i, ownerUid));
      for (let i = 0; i < count.trucks; i++) tasks.push(seedOne("Trucks", i, ownerUid));
      for (let i = 0; i < count.farm; i++) tasks.push(seedOne("Farm & Plant", i, ownerUid));

      append("Writing documents in chunks…");
      const chunkSize = 20;
      for (let i = 0; i < tasks.length; i += chunkSize) {
        append(`Writing ${i + 1}–${Math.min(i + chunkSize, tasks.length)}…`);
        await Promise.all(tasks.slice(i, i + chunkSize));
      }

      append("Done! Refresh the home page to see sample data.");
    } catch (e: any) {
      console.error(e);
      append(`Error: ${e?.message ?? e}`);
      alert("Seeding failed — check the log and console.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dev Seeder</h1>
        <Link href="/" className="border px-3 py-1.5 rounded-none bg-white hover:bg-neutral-50">
          Back to Home
        </Link>
      </div>

      {!isDevSafe && (
        <div className="border bg-white p-4 rounded-none text-sm text-red-700">
          Seeding is disabled on this host. Use <code>localhost</code>/<code>127.0.0.1</code>/<code>192.168.*</code>, or set
          <code className="mx-1">NEXT_PUBLIC_ALLOW_SEED=true</code> and reload.
        </div>
      )}

      <section className={cardClass}>
        <h2 className="text-lg font-semibold mb-3">Counts</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {Object.entries(count).map(([k, v]) => (
            <div key={k}>
              <label className="text-sm text-neutral-700 capitalize">
                {k === "farm" ? "Farm & Plant" : k}
              </label>
              <input
                type="number"
                min={0}
                className={inputClass}
                value={v}
                onChange={(e) => setCount((c) => ({ ...c, [k]: Number(e.target.value) }))}
              />
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={run}
            className="px-4 py-2 bg-black text-white rounded-none disabled:opacity-50"
          >
            {busy ? "Seeding…" : "Wipe & Seed"}
          </button>
          <span className="text-sm text-neutral-600">You must be signed in.</span>
        </div>
      </section>

      <section className={cardClass}>
        <h2 className="text-lg font-semibold mb-3">Log</h2>
        <pre className="whitespace-pre-wrap text-sm text-neutral-700">{log.join("\n")}</pre>
      </section>
    </div>
  );
}
