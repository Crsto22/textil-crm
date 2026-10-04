"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { LoaderOverlay } from "@/components/ui/loader-overlay";
import { useAuth } from "@/lib/auth/auth-context";

export default function AuthLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/chat");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isAuthenticated && !isLoading) return null;

  return (
    <>
      {isLoading && <LoaderOverlay />}
      {children}
    </>
  );
}
