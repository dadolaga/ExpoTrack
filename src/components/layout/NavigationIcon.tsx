type NavigationIconProps = {
  name: "home" | "stands" | "products" | "profile" | "search" | "filters" | "close" | "chevronDown" | "back";
};

const paths = {
  home: "m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z",
  stands: "M3 10h18L19 3H5Zm1 0v11h16V10M9 21v-7h6v7",
  products: "m3 7 9-4 9 4v10l-9 4-9-4Zm0 0 9 4 9-4M12 11v10M7.5 5l9 4",
  profile: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2",
  search: "M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Zm-2 5 6 6",
  filters: "M4 6h16M7 12h10M10 18h4M16 3v6M8 9v6M15 15v6",
  close: "m6 6 12 12M18 6 6 18",
  chevronDown: "m6 9 6 6 6-6",
  back: "m15 4-8 8 8 8",
};

export function NavigationIcon({ name }: NavigationIconProps) {
  return (
    <svg
      aria-hidden="true"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <path d={paths[name]} />
    </svg>
  );
}
