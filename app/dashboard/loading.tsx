export default function DashboardLoading() {
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="h-7 w-40 bg-gray-800 rounded animate-pulse" />
          <div className="h-4 w-48 bg-gray-800 rounded animate-pulse mt-2" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4 animate-pulse">
            <div className="h-3 w-20 bg-gray-800 rounded mb-2" />
            <div className="h-6 w-12 bg-gray-800 rounded" />
          </div>
        ))}
      </div>
      <div className="mb-8">
        <div className="h-4 w-28 bg-gray-800 rounded animate-pulse mb-4" />
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3 border-b border-gray-800 animate-pulse">
              <div className="w-2.5 h-2.5 rounded-full bg-gray-700" />
              <div className="flex-1">
                <div className="h-4 w-24 bg-gray-800 rounded" />
                <div className="h-3 w-40 bg-gray-800 rounded mt-1" />
              </div>
              <div className="h-4 w-14 bg-gray-800 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
