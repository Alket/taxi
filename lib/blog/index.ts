export type {
  BlogAuthor,
  BlogBlock,
  BlogCategoryId,
  BlogFaqItem,
  BlogFilterId,
  BlogImage,
  BlogPost,
} from "@/lib/blog/types"
export {
  BLOG_CATEGORY_LABELS,
  getPostH2Headings,
  slugifyHeading,
} from "@/lib/blog/types"
export { BLOG_AUTHORS, getBlogAuthor } from "@/lib/blog/authors"
export {
  DEFAULT_BLOG_AUTHORS,
  DEFAULT_BLOG_CATEGORIES,
  authorFromCatalog,
  blogCategoryLabelsMap,
  categoryLabelFromCatalog,
  getBlogCatalog,
  saveBlogCatalog,
  slugifyCatalogId,
  type BlogCatalog,
  type BlogCategoryRecord,
} from "@/lib/blog/catalog"
export {
  BLOG_POSTS,
  archivePostsFromList,
  formatBlogDate,
  getAllPosts,
  getArchivePosts,
  getFeaturedPost,
  getPostAuthor,
  getPostBySlug,
  getPostsByCategory,
  getRelatedDestinations,
  isBlogCategoryId,
  parseBlogFilter,
} from "@/lib/blog/posts"
