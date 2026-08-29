import BrandIcon from "@/components/icons/brand";

// CodeMirror's completion options are plain DOM, and BrandIcon is a React
// component (it uses useId for gradients), so each distinct brand is rendered
// once off-screen and cloned per option. Cloned gradient defs keep painting and
// currentColor still resolves per clone, so brand colors and dark mode work.
const renderedBrands = new Map<string, HTMLElement>();

export function BrandIconCache({ brands }: { brands: readonly string[] }) {
  return (
    <div aria-hidden className="pointer-events-none absolute h-0 w-0 overflow-hidden">
      {brands.map((brand) => (
        <span
          key={brand}
          ref={(element) => {
            if (!element) return;
            renderedBrands.set(brand, element);
          }}
        >
          <BrandIcon color="brand" brand={brand} className="size-4.5 shrink-0" />
        </span>
      ))}
    </div>
  );
}

export function cloneBrandIcon(brand: string | undefined): Node | null {
  if (!brand) return null;
  const source = renderedBrands.get(brand)?.firstElementChild;
  if (!source) return null;
  return source.cloneNode(true);
}
