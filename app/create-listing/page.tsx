"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { auth, db, storage } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";

/* ------------------------------- types & data ------------------------------ */
type UploadItem = { file: File; preview: string; progress: number; url?: string };
type Step = 1 | 2 | 3 | 4;

const CATEGORIES = ["Cars","Vans","Bikes","Caravans","Trucks","Farm & Plant"] as const;
const FUEL = ["Petrol","Diesel","Hybrid","Electric","Other"] as const;
const TRANSMISSION = ["Manual","Automatic","Other"] as const;
const BODY = ["Hatchback","Saloon","Estate","SUV","Coupe","Convertible","MPV","Van","Other"] as const;

const PLACEHOLDER_HINTS = [
  "Front 3/4 (cover)",
  "Interior",
  "Rear 3/4",
  "Dashboard / Odometer",
];

/* -------------------------------- component -------------------------------- */
export default function CreateListingWizard() {
  /* ---------------------------------- step UI --------------------------------- */
  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);
  const next = () => setStep(s => (s < 4 ? ((s + 1) as Step) : s));
  const back = () => setStep(s => (s > 1 ? ((s - 1) as Step) : s));

  /* ------------------------------ vehicle fields ------------------------------ */
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("Cars");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState<string>("");
  const [mileage, setMileage] = useState<string>("");
  const [fuel, setFuel] = useState<(typeof FUEL)[number] | "">("");
  const [transmission, setTransmission] = useState<(typeof TRANSMISSION)[number] | "">("");
  const [body, setBody] = useState<(typeof BODY)[number] | "">("");
  const [colour, setColour] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState<string>("");

  /* ---------------------------------- photos ---------------------------------- */
  const [files, setFiles] = useState<UploadItem[]>([]);
  const dragIndex = useRef<number | null>(null);

  /* ---------------------------------- contact --------------------------------- */
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [postcode, setPostcode] = useState("");

  const signedIn = !!auth.currentUser;

  /* --------------------------------- helpers ---------------------------------- */
  const input = "w-full border px-3 py-2 rounded-none bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900/10";
  const select = input + " appearance-none";
  const label = "text-sm text-neutral-700";
  const group = "grid gap-2";
  const card = "border bg-white p-4 shadow-sm rounded-none";
  const row2 = "grid grid-cols-1 sm:grid-cols-2 gap-4";
  const row3 = "grid grid-cols-1 sm:grid-cols-3 gap-4";
  const row4 = "grid grid-cols-1 sm:grid-cols-4 gap-4";

  const stepsMeta = [
    { n: 1, name: "Vehicle" },
    { n: 2, name: "Photos" },
    { n: 3, name: "Contact" },
    { n: 4, name: "Review & Publish" },
  ];

  const titleSuggestion = useMemo(() => {
    const y = year ? `${year} ` : "";
    return `${y}${make} ${model}`.trim();
  }, [year, make, model]);

  /* --------------------------------- photos fx -------------------------------- */
  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(e.target.files ?? []);
    if (!chosen.length) return;
    const newItems = chosen.slice(0, 20).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      progress: 0,
    }));
    setFiles(prev => [...prev, ...newItems].slice(0, 20));
  }

  function setAsCover(i: number) {
    setFiles(prev => {
      const next = [...prev];
      const [item] = next.splice(i, 1);
      next.unshift(item);
      return next;
    });
  }

  function move(from: number, to: number) {
    setFiles(prev => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  function onDragStart(i: number) {
    dragIndex.current = i;
  }
  function onDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
  }
  function onDrop(i: number) {
    if (dragIndex.current === null) return;
    const from = dragIndex.current;
    if (from !== i) move(from, i);
    dragIndex.current = null;
  }

  async function uploadAll(): Promise<string[]> {
    const user = auth.currentUser;
    if (!user) throw new Error("Please sign in first.");
    const urls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const { file } = files[i];
      const path = `user_uploads/${user.uid}/${Date.now()}_${i}_${file.name}`;
      const storageRef = ref(storage, path);
      const task = uploadBytesResumable(storageRef, file);
      await new Promise<void>((resolve, reject) => {
        task.on(
          "state_changed",
          (snap) => {
            const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
            setFiles(prev => {
              const next = [...prev];
              next[i] = { ...next[i], progress: pct };
              return next;
            });
          },
          reject,
          async () => {
            const url = await getDownloadURL(task.snapshot.ref);
            urls.push(url);
            setFiles(prev => {
              const next = [...prev];
              next[i] = { ...next[i], url, progress: 100 };
              return next;
            });
            resolve();
          }
        );
      });
    }
    return urls;
  }

  /* -------------------------------- validation ------------------------------- */
  function normPostcode(s: string) {
    return s.toUpperCase().replace(/\s+/g, "").trim();
  }
  function looksLikeUkPostcode(s: string) {
    return /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(normPostcode(s));
  }

  function validateStep(s: Step): string | null {
    const y = Number(year);
    if (s === 1) {
      if (!category) return "Choose a category.";
      if (!make.trim() || !model.trim()) return "Add make and model.";
      if (!year || y < 1900 || y > new Date().getFullYear() + 1) return "Enter a valid year.";
      if (!price || Number(price) <= 0) return "Enter a valid price.";
      // description optional
    }
    if (s === 2) {
      if (files.length === 0) return "Add at least one photo.";
    }
    if (s === 3) {
      if (!contactName.trim()) return "Add a contact name.";
      if (!contactPhone.trim()) return "Add a phone number.";
      if (!postcode.trim()) return "Add a postcode.";
      if (!looksLikeUkPostcode(postcode)) return "Enter a valid UK postcode (e.g. SW1A 1AA).";
    }
    return null;
  }

  async function goNext() {
    const err = validateStep(step);
    if (err) return alert(err);
    next();
  }

  /* --------------------------------- publish -------------------------------- */
  async function publish() {
    const err = validateStep(1) || validateStep(2) || validateStep(3);
    if (err) return alert(err);
    if (!signedIn) return alert("Please sign in.");

    try {
      setSaving(true);
      const user = auth.currentUser!;

      // Upload photos in the current order (index 0 is cover)
      const images = await uploadAll();

      // Create the public listing (postcode omitted for privacy)
      const pubRef = await addDoc(collection(db, "listings"), {
        ownerUid: user.uid,
        category,
        // Use a sensible default title if you later want to show it:
        title: titleSuggestion || `${make} ${model}`.trim(),
        make: make.trim(),
        model: model.trim(),
        year: Number(year) || null,
        mileage: Number(mileage) || null,
        fuel: fuel || null,
        transmission: transmission || null,
        body: body || null,
        colour: colour.trim() || null,
        description: description.trim() || null,
        price: Number(price),
        images, // ordered; index 0 is cover
        status: "live",
        isPremium: false,
        premiumUntil: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Store postcode privately (owner-only)
      await addDoc(collection(db, "listings_private"), {
        listingId: pubRef.id,
        ownerUid: user.uid,
        postcode: normPostcode(postcode),
        createdAt: serverTimestamp(),
      });

      alert("Listing published ✅");
      // reset minimal
      setStep(1);
      setFiles([]);
      setMake(""); setModel(""); setYear(""); setMileage("");
      setFuel(""); setTransmission(""); setBody(""); setColour("");
      setDescription(""); setPrice(""); setContactName(""); setContactPhone(""); setPostcode("");
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "Could not publish listing.");
    } finally {
      setSaving(false);
    }
  }

  /* ---------------------------------- UI ------------------------------------ */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Create Listing</h1>
        <Link href="/" className="border px-3 py-1.5 rounded-none bg-white hover:bg-neutral-50">
          Back to Home
        </Link>
      </div>

      {!signedIn && (
        <div className="border bg-white p-4 text-sm text-red-700 rounded-none">
          Please <Link className="underline" href="/sign-in">sign in</Link> before creating a listing.
        </div>
      )}

      {/* Step indicator */}
      <ol className="grid grid-cols-4 gap-2">
        {stepsMeta.map(s => (
          <li
            key={s.n}
            className={[
              "border px-3 py-2 text-sm rounded-none text-center",
              step === s.n ? "bg-black text-white border-black" : "bg-white",
            ].join(" ")}
          >
            {s.n}. {s.name}
          </li>
        ))}
      </ol>

      {/* Step 1 – Vehicle */}
      {step === 1 && (
        <section className={card}>
          <h2 className="text-lg font-semibold mb-3">Vehicle</h2>
          <div className={row2}>
            <div className={group}>
              <label className={label}>Category</label>
              <select className={select} value={category} onChange={(e)=>setCategory(e.target.value as any)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className={group}>
              <label className={label}>Price (GBP)</label>
              <input className={input} type="number" min={0} step="1" value={price} onChange={(e)=>setPrice(e.target.value)} placeholder="e.g. 8995" />
            </div>
          </div>

          <div className="mt-4">
            <div className={row2}>
              <div className={group}>
                <label className={label}>Make</label>
                <input className={input} value={make} onChange={(e)=>setMake(e.target.value)} placeholder="e.g. Ford" />
              </div>
              <div className={group}>
                <label className={label}>Model</label>
                <input className={input} value={model} onChange={(e)=>setModel(e.target.value)} placeholder="e.g. Fiesta" />
              </div>
            </div>
            <div className="mt-4">
              <div className={row4}>
                <div className={group}>
                  <label className={label}>Year</label>
                  <input className={input} type="number" min={1900} value={year} onChange={(e)=>setYear(e.target.value)} placeholder="e.g. 2017" />
                </div>
                <div className={group}>
                  <label className={label}>Mileage</label>
                  <input className={input} type="number" min={0} value={mileage} onChange={(e)=>setMileage(e.target.value)} placeholder="e.g. 54000" />
                </div>
                <div className={group}>
                  <label className={label}>Fuel</label>
                  <select className={select} value={fuel} onChange={(e)=>setFuel(e.target.value as any)}>
                    <option value="">Select</option>
                    {FUEL.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div className={group}>
                  <label className={label}>Transmission</label>
                  <select className={select} value={transmission} onChange={(e)=>setTransmission(e.target.value as any)}>
                    <option value="">Select</option>
                    {TRANSMISSION.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <div className={row3}>
                <div className={group}>
                  <label className={label}>Body Type</label>
                  <select className={select} value={body} onChange={(e)=>setBody(e.target.value as any)}>
                    <option value="">Select</option>
                    {BODY.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div className={group}>
                  <label className={label}>Colour</label>
                  <input className={input} value={colour} onChange={(e)=>setColour(e.target.value)} placeholder="e.g. Red" />
                </div>
                <div className={group}>
                  <label className={label}>Description</label>
                  <textarea
                    className={input + " min-h-[96px]"}
                    value={description}
                    onChange={(e)=>setDescription(e.target.value)}
                    placeholder="Condition, service history, MOT, owners, extras…"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Step 2 – Photos */}
      {step === 2 && (
        <section className={card}>
          <h2 className="text-lg font-semibold mb-3">Photos</h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            {PLACEHOLDER_HINTS.map((hint, i) => (
              <div key={i} className="border rounded-none p-2 text-center">
                <div className="aspect-square bg-neutral-100 mb-2" />
                <div className="text-xs text-neutral-600">{hint}</div>
              </div>
            ))}
          </div>

          <input className="block w-full border px-3 py-2 rounded-none" type="file" accept="image/*" multiple onChange={onPickFiles} />

          {files.length > 0 && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {files.map((f, i) => (
                <div
                  key={i}
                  className="border bg-white rounded-none group"
                  draggable
                  onDragStart={() => onDragStart(i)}
                  onDragOver={onDragOver}
                  onDrop={() => onDrop(i)}
                  title="Drag to reorder"
                >
                  <div
                    className="aspect-square bg-neutral-100 bg-cover bg-center relative"
                    style={{ backgroundImage: `url(${f.url ?? f.preview})` }}
                  >
                    {i === 0 && (
                      <div className="absolute top-1 left-1 text-[10px] bg-black text-white px-1.5 py-0.5">
                        Cover
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between p-2">
                    <button
                      className="text-xs underline"
                      onClick={() => setAsCover(i)}
                      type="button"
                    >
                      Set as cover
                    </button>
                    <div className="h-1 bg-neutral-100 w-20">
                      <div className="h-full" style={{ width: `${f.progress}%`, background: "#111" }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-neutral-500 mt-2">
            Tip: drag tiles to reorder. The first image is used as the main display photo.
          </p>
        </section>
      )}

      {/* Step 3 – Contact */}
      {step === 3 && (
        <section className={card}>
          <h2 className="text-lg font-semibold mb-3">Contact</h2>
          <div className={row3}>
            <div className={group}>
              <label className={label}>Contact name</label>
              <input className={input} value={contactName} onChange={(e)=>setContactName(e.target.value)} />
            </div>
            <div className={group}>
              <label className={label}>Phone number</label>
              <input className={input} value={contactPhone} onChange={(e)=>setContactPhone(e.target.value)} placeholder="+44…" />
            </div>
            <div className={group}>
              <label className={label}>Postcode (kept private)</label>
              <input className={input} value={postcode} onChange={(e)=>setPostcode(e.target.value)} placeholder="e.g. SW1A 1AA" />
            </div>
          </div>
          <p className="text-xs text-neutral-500 mt-2">
            Your postcode is stored privately and not shown on the advert.
          </p>
        </section>
      )}

      {/* Step 4 – Review & Publish */}
      {step === 4 && (
        <section className={card}>
          <h2 className="text-lg font-semibold mb-3">Review</h2>
          <div className="grid gap-2 text-sm">
            <Row label="Category" value={category} />
            <Row label="Title (auto)" value={titleSuggestion || `${make} ${model}`} />
            <Row label="Make / Model" value={`${make} ${model}`} />
            <Row label="Year / Mileage" value={`${year || "-"} / ${mileage || "-"}`} />
            <Row label="Fuel / Transmission" value={`${fuel || "-"} / ${transmission || "-"}`} />
            <Row label="Body / Colour" value={`${body || "-"} / ${colour || "-"}`} />
            <Row label="Price" value={price ? `£${Number(price).toLocaleString()}` : "-"} />
            <Row label="Contact" value={`${contactName} · ${contactPhone}`} />
            <Row label="Description" value={description || "-"} multiline />
            <div className="mt-2">
              <div className="text-xs text-neutral-500">Photos: {files.length}</div>
              <div className="mt-2 grid grid-cols-5 gap-2">
                {files.slice(0,5).map((f,i)=>(
                  <div key={i} className="aspect-square bg-neutral-100 bg-cover bg-center" style={{backgroundImage:`url(${f.preview})`}} />
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={back}
          disabled={step === 1 || saving}
          className="border px-4 py-2 rounded-none bg-white disabled:opacity-50"
        >
          Back
        </button>

        {step < 4 ? (
          <button
            onClick={() => {
              const err = validateStep(step);
              if (err) return alert(err);
              next();
            }}
            disabled={saving}
            className="px-4 py-2 bg-black text-white rounded-none disabled:opacity-50"
          >
            Next
          </button>
        ) : (
          <button
            onClick={publish}
            disabled={saving || !signedIn}
            className="px-4 py-2 bg-black text-white rounded-none disabled:opacity-50"
          >
            {saving ? "Publishing…" : "Publish listing"}
          </button>
        )}
      </div>
    </div>
  );
}

/* --------------------------------- helpers -------------------------------- */
function Row({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="text-neutral-500">{label}</div>
      <div className={`col-span-2 ${multiline ? "" : "truncate"}`}>{value}</div>
    </div>
  );
}
