"use client";

import { useEffect, useState } from "react";
import { useSearchParams, usePathname } from "next/navigation";

export default function NotFoundClient() {
  const params = useSearchParams();
  const pathname = usePathname();

  // Read search params safely on the client
  const [q, setQ] = useState<string | null>(null);
  useEffect(() => {
    setQ(params.get("q"));
  }, [params]);

  return (
    <div className="text-sm text-neutral-600">
      <p>Path: {pathname}</p>
      {q ? <p>Searched for: “{q}”</p> : null}
    </div>
  );
}
