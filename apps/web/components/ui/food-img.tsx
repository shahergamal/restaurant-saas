import { Apple, Beef, CupSoda, Fish, Milk, Package, UtensilsCrossed } from 'lucide-react';
import { cn } from '@/lib/cn';
import { imgSrc } from '@/lib/photos';

const CATEGORY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  produce: Apple,
  meat: Beef,
  seafood: Fish,
  dairy: Milk,
  dry_goods: Package,
  beverages: CupSoda,
};

/** Dish or ingredient photo (or drawing) from /public/img; falls back to a category icon when an item has none. */
export function FoodImg({ image, alt = '', category, className, rounded = 'rounded-md' }: { image?: string | null; alt?: string; category?: string; className?: string; rounded?: string }) {
  if (!image) {
    const Icon = (category && CATEGORY_ICON[category]) || UtensilsCrossed;
    return (
      <span className={cn('grid shrink-0 place-items-center bg-surface-muted text-ink-subtle', rounded, className)} aria-hidden={!alt} role={alt ? 'img' : undefined} aria-label={alt || undefined}>
        <Icon className="size-1/2" />
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={imgSrc(image)} alt={alt} loading="lazy" decoding="async" className={cn('shrink-0 bg-surface-muted object-cover', rounded, className)} />;
}
