const chatWallpaperClass =
  "bg-[image:url('/modo/modo-claro.png')] bg-cover bg-center dark:bg-[image:url('/modo/modo-oscuro.png')]";

export function ChatWallpaperLayer() {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 opacity-10 ${chatWallpaperClass}`}
    />
  );
}
