import {
  getMarketingIcon,
  isCustomMarketingIcon,
} from "@/lib/marketing-icons"
import { cn } from "@/lib/utils"

export function MarketingIcon({
  icon,
  fallbackIndex = 0,
  className,
  imageClassName,
}: {
  icon?: string
  fallbackIndex?: number
  className?: string
  imageClassName?: string
}) {
  if (isCustomMarketingIcon(icon)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={icon}
        alt=""
        className={cn("size-10 object-contain", imageClassName, className)}
        loading="lazy"
      />
    )
  }

  const { icon: Icon } = getMarketingIcon(icon, fallbackIndex)
  return (
    <Icon
      className={cn("size-10 text-primary", imageClassName, className)}
      strokeWidth={2}
      aria-hidden
    />
  )
}
