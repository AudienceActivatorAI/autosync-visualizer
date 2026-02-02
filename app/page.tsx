import { Suspense } from "react";
import AutosyncLanding from "@/components/AutosyncLanding";

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AutosyncLanding />
    </Suspense>
  );
}
