import { LovableWorkspace } from "@/features/business/LovableWorkspace";
import { createFileRoute } from "@tanstack/react-router";
import { BusinessAppPage } from "@/features/business/BusinessAppPage";
export const Route = createFileRoute("/business/$section")({
  component: BusinessRoute,
});
function BusinessRoute() {
  const { section } = Route.useParams();
  if (section === "lovable") return <LovableWorkspace />;
  return <BusinessAppPage key={section} id={section} />;
}
