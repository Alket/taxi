import type { BlogAuthor } from "@/lib/blog/types"

export const BLOG_AUTHORS: Record<string, BlogAuthor> = {
  "landed-team": {
    id: "landed-team",
    name: "Landed Local Experts",
    role: "Tirana Airport transfer drivers & route specialists",
    bio: "Our team lives and works around Tirana International Airport (TIA). We handle fixed-price private transfers across Albania every day—meet & greet, flight tracking, and cash payment on arrival with €0 deposit—so the guides we publish reflect real airport and road experience, not generic travel copy.",
    avatar: {
      src: "/marketing/logo.svg",
      alt: "Landed Albania logo",
      width: 207,
      height: 150,
    },
  },
}

export function getBlogAuthor(authorId: string): BlogAuthor {
  return BLOG_AUTHORS[authorId] ?? BLOG_AUTHORS["landed-team"]
}
