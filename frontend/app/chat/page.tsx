'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ChatIndexPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/characters'); }, [router]);
  return null;
}
