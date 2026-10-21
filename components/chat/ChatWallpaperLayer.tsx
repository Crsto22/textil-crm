const chatWallpaperClass =
  "bg-[image:url('/modo/modo-claro.png')] bg-center bg-repeat bg-[length:900px_auto] sm:bg-[length:1100px_auto] lg:bg-cover lg:bg-no-repeat dark:bg-[image:url('/modo/modo-oscuro.png')]";

export function ChatWallpaperLayer() {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 opacity-10 ${chatWallpaperClass}`}
    />
  );
}
