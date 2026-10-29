export const destinations = [
  {
    href: "/",
    label: "Home",
    icon: "home",
  },
  {
    href: "/stands",
    label: "Stand",
    icon: "stands",
  },
  {
    href: "/products",
    label: "Prodotti",
    icon: "products",
  },
  {
    href: "/profile",
    label: "Profilo",
    icon: "profile",
  },
] as const;

export function isDestinationActive(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}
