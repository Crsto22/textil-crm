"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Autoplay from "embla-carousel-autoplay";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/theme-toggle";
import { KimentsCrmLogo } from "@/components/KimentsCrmLogo";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth/auth-context";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { isAuthenticated, isLoading: isAuthLoading, login } = useAuth();
  const router = useRouter();

  const systemVersion = "v1.0.0";
  const carouselImages = [
    "https://images.unsplash.com/photo-1445205170230-053b83016050?w=1200&q=80",
    "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1200&q=80",
    "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=1200&q=80",
  ];

  useEffect(() => {
    if (!isAuthLoading && isAuthenticated) {
      router.replace("/chat");
    }
  }, [isAuthLoading, isAuthenticated, router]);

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem("auth:session-expired") === "1") {
        window.sessionStorage.removeItem("auth:session-expired");
        toast.warning("Tu sesion expiro. Vuelve a iniciar sesion.");
      }
      if (window.sessionStorage.getItem("auth:crm-access-denied") === "1") {
        window.sessionStorage.removeItem("auth:crm-access-denied");
        toast.error("No tienes acceso al CRM");
      }
    } catch {
      // sessionStorage puede no estar disponible
    }
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);

    const result = await login({ email: email.trim(), password });

    if (result.ok) {
      toast.success("Sesion iniciada correctamente");
      router.push("/chat");
    } else {
      toast.error(result.message ?? "Error al iniciar sesion");
    }

    setIsLoading(false);
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex items-center justify-between">
          <KimentsCrmLogo size="sm" />
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="mb-1">
                  <KimentsCrmLogo size="lg" />
                </div>
              </div>

              <div className="grid gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="m@ejemplo.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center">
                    <Label htmlFor="password">Contrasena</Label>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isLoading || isAuthLoading}>
                  {isLoading || isAuthLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Iniciando sesion...
                    </span>
                  ) : (
                    "Iniciar Sesion"
                  )}
                </Button>
              </div>

              <div className="text-center text-xs text-muted-foreground">
                Version {systemVersion}
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="relative hidden overflow-hidden lg:block">
        <Carousel
          opts={{
            loop: true,
            align: "start",
          }}
          plugins={[
            Autoplay({
              delay: 3000,
              stopOnInteraction: false,
            }),
          ]}
          className="h-full w-full"
        >
          <CarouselContent className="h-screen">
            {carouselImages.map((image, index) => (
              <CarouselItem key={image} className="relative h-full">
                <Image
                  src={image}
                  alt={`Login background ${index + 1}`}
                  fill
                  className="object-cover"
                  priority={index === 0}
                  unoptimized
                />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </div>
    </div>
  );
}
