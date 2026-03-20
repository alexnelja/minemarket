import { supabase } from "@/lib/supabase";
import { Deployment } from "@/lib/types";
import { timeAgo } from "@/lib/format";

const statusConfig: Record<string, { color: string; label: string }> = {
  Ready: { color: "bg-emerald-500", label: "Ready" },
  Error: { color: "bg-red-500", label: "Error" },
  Building: { color: "bg-yellow-500", label: "Building" },
  Cancelled: { color: "bg-gray-500", label: "Cancelled" },
};

export default async function DeploymentsPage() {
  const { data: deployments, error } = await supabase
    .from("deployments")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-6">
        <p className="font-medium">Failed to load deployments</p>
        <p className="text-sm text-red-500 mt-1">{error.message}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Deployments</h1>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-sm text-gray-400 gap-2">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-gray-500">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Search deployments...
          </div>
          <button className="text-xs bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-gray-400 hover:text-white transition-colors">
            Filter
          </button>
        </div>
      </div>

      {/* Deployments list */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {(deployments as Deployment[]).map((d, i) => {
          const status = statusConfig[d.status] ?? { color: "bg-gray-500", label: d.status };
          return (
            <div
              key={d.id}
              className={`flex items-center gap-4 px-5 py-4 hover:bg-gray-800/50 transition-colors ${
                i !== deployments.length - 1 ? "border-b border-gray-800" : ""
              }`}
            >
              {/* Status dot */}
              <span
                className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${status.color} ${
                  d.status === "Building" ? "animate-pulse" : ""
                }`}
                title={status.label}
              />

              {/* Commit + branch info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-100 truncate">{d.commit_message}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  <span className="text-gray-400">{d.branch}</span>
                  {" · "}
                  <span className="font-mono">{d.hash}</span>
                </p>
              </div>

              {/* Environment badge */}
              <span
                className={`hidden sm:inline-flex text-xs font-medium px-2.5 py-0.5 rounded-full flex-shrink-0 ${
                  d.env === "Production"
                    ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                    : "text-gray-400 border border-gray-700"
                }`}
              >
                {d.env}
              </span>

              {/* Age */}
              <span className="text-xs text-gray-500 w-16 text-right flex-shrink-0">
                {timeAgo(d.created_at)}
              </span>

              {/* Author avatar */}
              <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0" title={d.author}>
                <span className="text-[10px] font-medium text-gray-300">{d.author}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
