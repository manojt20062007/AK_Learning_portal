export default function BrandLoader({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center p-6">
      <div className="relative flex flex-col items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.svg"
          alt="AK Learning"
          className="w-14 h-14 rounded-xl object-contain animate-pulse shadow-sm"
        />
        <div className="mt-4 w-28 h-1 bg-zinc-200 rounded-full overflow-hidden">
          <div className="h-full w-1/2 bg-zinc-950 rounded-full animate-[shimmer_1.2s_ease-in-out_infinite]" />
        </div>
        <p className="mt-3 text-xs font-medium text-zinc-500 tracking-wide">{label}</p>
      </div>
    </div>
  );
}
