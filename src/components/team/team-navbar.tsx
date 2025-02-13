import { Navbar, NavbarBreadcrumb } from "@/components/navigation/navbar";
import TeamBreadcrumb from "@/components/team/team-breadcrumb";

export default async function TeamNavbar() {
  return (
    <Navbar>
      <NavbarBreadcrumb>
        <TeamBreadcrumb />
      </NavbarBreadcrumb>
    </Navbar>
  );
}
