/**
 * Utility for handling image paths across development and production.
 *
 * In production, images are converted to WebP for smaller file sizes.
 * In development, original PNG/JPG files are used for the editor workflow.
 */

/**
 * Converts an image path to use WebP extension in production builds.
 * In development, returns the original path unchanged.
 *
 * @param path - The original image path (e.g., "portraits/hero.png")
 * @returns The path with .webp extension in production, original in development
 */
export function getImagePath(path: string): string {
  // In production, use webp versions
  if (import.meta.env.PROD) {
    return path.replace(/\.(png|jpg|jpeg)$/i, '.webp');
  }
  return path;
}

/**
 * Gets the full URL for an image in the /images directory.
 * Handles WebP conversion in production.
 *
 * @param path - The image path relative to /images (e.g., "portraits/hero.png")
 * @returns The full URL path (e.g., "/images/portraits/hero.webp" in production)
 */
export function getImageUrl(path: string): string {
  return `/images/${getImagePath(path)}`;
}
