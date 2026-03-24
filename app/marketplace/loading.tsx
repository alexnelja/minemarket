export default function MarketplaceLoading() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="h-7 w-40 bg-gray-800 rounded animate-pulse" />
          <div className="h-4 w-64 bg-gray-800 rounded animate-pulse mt-2" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-28 bg-gray-800 rounded-lg animate-pulse" />
          <div className="h-8 w-36 bg-gray-800 rounded-lg animate-pulse" />
        </div>
      </div>
      <div className="flex gap-1 mb-6 border-b border-gray-800 pb-2">
        <div className="h-5 w-24 bg-gray-800 rounded animate-pulse" />
        <div className="h-5 w-32 bg-gray-800 rounded animate-pulse ml-4" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4 animate-pulse">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2.5 h-2.5 rounded-full bg-gray-700" />
              <div className="h-4 w-20 bg-gray-800 rounded" />
            </div>
            <div className="h-6 w-24 bg-gray-800 rounded mt-3" />
            <div className="flex gap-1.5 mt-3">
              <div className="h-4 w-10 bg-gray-800 rounded" />
              <div className="h-4 w-10 bg-gray-800 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
