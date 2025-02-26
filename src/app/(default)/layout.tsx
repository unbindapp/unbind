import { Navbar } from "@/components/navigation/navbar";
import NavbarSafeAreaInsetBottom from "@/components/navigation/navbar-safe-area-inset-bottom";
import { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export default function Layout({ children }: Props) {
  return (
    <>
      <Navbar />
      {children}
      <NavbarSafeAreaInsetBottom className="sm:hidden" classNameInner="h-12" />
    </>
  );
}
