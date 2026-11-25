'use client';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  subtitle?: string;
}

const SIZE_MAP = {
  sm: 'w-7 h-7',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
};

export default function BrandLogo({ size = 'md', showText = true, subtitle }: BrandLogoProps) {
  return (
    <span className="inline-flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.svg"
        alt="AK Learning"
        className={`${SIZE_MAP[size]} rounded-md object-contain flex-shrink-0`}
      />
      {showText && (
        <span className="flex flex-col">
          <span className="text-sm sm:text-base font-semibold tracking-tight text-zinc-950 leading-none">
            AK Learning
          </span>
          {subtitle && (
            <span className="text-[11px] text-zinc-500 mt-0.5 leading-none">{subtitle}</span>
          )}
        </span>
      )}
    </span>
  );
}
