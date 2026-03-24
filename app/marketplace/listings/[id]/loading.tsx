export default function ListingDetailLoading() {
  return (
    <div className="max-w-3xl">
      <div className="h-3 w-32 bg-gray-800 rounded animate-pulse" />
      <div className="mt-4 bg-gray-900 border border-gray-800 rounded-xl p-6 animate-pulse">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 rounded-full bg-gray-700" />
              <div className="h-6 w-28 bg-gray-800 rounded" />
            </div>
            <div className="h-4 w-36 bg-gray-800 rounded mt-1" />
          </div>
          <div className="h-8 w-24 bg-gray-800 rounded" />
        </div>
        <div className="grid grid-cols-2 gap-4 mt-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i}>
              <div className="h-3 w-20 bg-gray-800 rounded mb-1" />
              <div className="h-4 w-32 bg-gray-800 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
