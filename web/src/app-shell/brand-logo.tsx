/**
 * The product logo: the "שווה לעבוד בירושלים" shield with the city skyline (DESIGN.md 6.1).
 * The file sits in web/public; the site uses a hash router, so the relative path always resolves
 * against the site root. Width and height are the file's own, so the header never shifts.
 * The supplier-area header uses the shared class; the main bar passes its own sized one.
 */
export function BrandLogo({ className = 'shell-logo' }: { className?: string | undefined }) {
  return (
    <img
      className={className}
      src="brand/logo.png"
      alt="שווה לעבוד בירושלים"
      width={431}
      height={200}
      decoding="async"
    />
  );
}
