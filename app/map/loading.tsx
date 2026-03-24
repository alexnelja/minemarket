export default function MapLoading() {
  return (
    <div className="relative h-[calc(100vh-5rem)] -m-6 md:-m-10 overflow-hidden flex items-center justify-center bg-gray-950">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-gray-700 border-t-white rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-500">Loading map data...</p>
      </div>
    </div>
  );
}
