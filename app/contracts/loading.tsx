export default function ContractsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-8 w-48 bg-gray-800 rounded mb-2" />
        <div className="h-4 w-64 bg-gray-800 rounded" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="h-3 w-20 bg-gray-800 rounded mb-2" />
            <div className="h-8 w-16 bg-gray-800 rounded" />
          </div>
        ))}
      </div>
      <div className="space-y-4">
        {[1,2,3].map(i => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex justify-between mb-3">
              <div className="h-5 w-32 bg-gray-800 rounded" />
              <div className="h-5 w-20 bg-gray-800 rounded" />
            </div>
            <div className="h-2 w-full bg-gray-800 rounded mb-3" />
            <div className="flex gap-2">
              <div className="h-6 w-24 bg-gray-800 rounded" />
              <div className="h-6 w-24 bg-gray-800 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
