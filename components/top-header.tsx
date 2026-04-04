'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ProfileMenu } from '@/components/profile-menu';

export function TopHeader() {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
      <Link
        href="/rootstock"
        className="flex items-center gap-2 hover:opacity-90"
      >
        <Image
          src="/images/scc-tower-logo.png"
          alt="SCC Tower"
          width={140}
          height={30}
          className="h-7 w-auto"
        />
      </Link>

      <div className="flex items-center gap-3">
        <ProfileMenu />
      </div>
    </header>
  );
}