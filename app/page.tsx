const stats = [
  { label: "Revenue", value: "$48,295", change: "+12.5%", up: true },
  { label: "Active Users", value: "3,842", change: "+8.1%", up: true },
  { label: "Conversion", value: "4.6%", change: "-0.3%", up: false },
  { label: "Avg. Session", value: "2m 41s", change: "+5.4%", up: true },
];

const recentActivity = [
  { user: "Alex N.", action: "Deployed to production", time: "2m ago", status: "success" },
  { user: "Sam K.", action: "Opened pull request #42", time: "18m ago", status: "info" },
  { user: "Jordan L.", action: "Build failed on staging", time: "1h ago", status: "error" },
  { user: "Taylor M.", action: "Added 3 new team members", time: "3h ago", status: "info" },
  { user: "Alex N.", action: "Merged feature/auth-v2", time: "5h ago", status: "success" },
];

const statusColor: Record<string, string> = {
  success: "bg-emerald-500",
  error: "bg-red-500",
  info: "bg-blue-500",
};

export default function Dashboard() {
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
          <p className="text-gray-400 text-sm mt-1">March 2026 · All projects</p>
        </div>
        <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full font-medium">
          ● Live
        </span>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-8">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-gray-900 border border-gray-800 rounded-xl p-5"
          >
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">{s.label}</p>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className={`text-xs mt-1 font-medium ${s.up ? "text-emerald-400" : "text-red-400"}`}>
              {s.change} this month
            </p>
          </div>
        ))}
      </div>

      {/* Fake chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Revenue · Last 7 days</h2>
        <div className="flex items-end gap-2 h-28">
          {[40, 65, 50, 80, 55, 90, 75].map((h, i) => (
            <div key={i} className="flex-1 flex flex-col justify-end">
              <div
                className="rounded-t bg-indigo-500 opacity-80 hover:opacity-100 transition-opacity"
                style={{ height: `${h}%` }}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-gray-600 mt-2">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <span key={d} className="flex-1 text-center">{d}</span>
          ))}
        </div>
      </div>

      {/* Recent activity */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Recent Activity</h2>
        <ul className="space-y-3">
          {recentActivity.map((item, i) => (
            <li key={i} className="flex items-center gap-3 text-sm">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColor[item.status]}`} />
              <span className="text-gray-200 font-medium w-24 flex-shrink-0">{item.user}</span>
              <span className="text-gray-400 flex-1">{item.action}</span>
              <span className="text-gray-600 text-xs">{item.time}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
