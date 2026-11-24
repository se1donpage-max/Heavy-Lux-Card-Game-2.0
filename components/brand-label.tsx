"use client";

import { useState, type ButtonHTMLAttributes } from "react";
import { brandAssets, findBrandAsset, type BrandAssetId } from "@/lib/brand-assets";

export function BrandLabel({ text, asset, eager = false }: { text: string; asset?: BrandAssetId; eager?: boolean }) {
  const id = asset ?? findBrandAsset(text);
  const [failed, setFailed] = useState<BrandAssetId>();
  if (!id || failed === id) return <span className="k7-label-fallback">{text}</span>;
  const { small, large } = brandAssets[id];
  // Native img preserves the supplied PNG alpha channel and avoids a server image optimizer.
  return <span className={`k7-brand-label${text.length > 32 ? " k7-brand-label-long" : ""}`}>
    <span className="k7-label-readable">{text}</span>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img className="k7-label-art" src={`/k7-ui/${small.path}`} srcSet={`/k7-ui/${small.path} 2x, /k7-ui/${large.path} 4x`} width={small.width} height={small.height} alt="" aria-hidden="true" loading={eager ? "eager" : "lazy"} decoding="async" onError={() => setFailed(id)} />
  </span>;
}

export function BrandButton({ label, asset, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; asset?: BrandAssetId }) {
  return <button {...props}>{children}<BrandLabel text={label} asset={asset} /></button>;
}
