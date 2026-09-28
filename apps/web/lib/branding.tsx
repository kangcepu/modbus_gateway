"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { Wrench } from "lucide-react";
export type Branding = {
  appName: string;
  appSubtitle: string;
  logoUrl: string;
  iconUrl: string;
  faviconUrl: string;
};
const defaults: Branding = {
  appName: "MONTARA",
  appSubtitle: "Modbus Monitoring System",
  logoUrl: "",
  iconUrl: "",
  faviconUrl: "",
};
const Context = createContext<{
  branding: Branding;
  update: (value: Branding) => void;
}>({ branding: defaults, update: () => {} });
export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, update] = useState(defaults);
  useEffect(() => {
    let active = true;
    fetch("/api/settings/branding")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((value) => {
        if (active) update(value);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    document.title = `${branding.appName} | ${branding.appSubtitle || "Modbus Monitoring"}`;
    let icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!icon) {
      icon = document.createElement("link");
      icon.rel = "icon";
      document.head.appendChild(icon);
    }
    icon.href = branding.faviconUrl || "/favicon.svg";
  }, [branding]);
  return (
    <Context.Provider value={{ branding, update }}>{children}</Context.Provider>
  );
}
export function useBranding() {
  return useContext(Context);
}
export function BrandImage({
  src,
  name,
  className,
}: {
  src: string;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) return <Wrench className="h-5 w-5" />;
  return (
    <img
      src={src}
      alt={name}
      className={className || "h-full w-full rounded-xl object-contain"}
      onError={() => setFailed(true)}
    />
  );
}
