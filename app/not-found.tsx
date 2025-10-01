import { Suspense } from "react";
import NotFoundClient from "./not-found.client";

export default function NotFound() {
  return (
    <div className="space-y-3 py-10">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p>Try adjusting your filters or go back to the home page.</p>

      {/* Any useSearchParams/usePathname must live under Suspense in a client child */}
      <Suspense fallback={null}>
        <NotFoundClient />
      </Suspense>
    </div>
  );
}
