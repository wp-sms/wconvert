import { __ } from "@wordpress/i18n";
import { Eye, Plug, Shield } from "lucide-react";
import { settingsHref, type SettingsGroup } from "../nav";
import { SiteAllowance } from "../optins/SiteAllowance";
import { LeadRetention } from "../leads/LeadRetention";
import { Destinations } from "../destinations/Destinations";
import type { SettingsEditing } from "./useSettingsEditing";
import { Region, RegionBody, RegionHeader } from "../shell/Region";

/** A persistent category rail; the chosen category goes straight to its controls. */
export function Settings({
  group,
  destinationId,
  onEditingStateChange,
}: {
  group: SettingsGroup;
  destinationId?: string;
  onEditingStateChange?: SettingsEditing;
}) {
  const categories = [
    {
      id: "experience",
      label: __("Visitor experience", "wconvert"),
      description: __("Site-wide display limits", "wconvert"),
      icon: Eye,
    },
    {
      id: "connections",
      label: __("Connections & destinations", "wconvert"),
      description: __("Accounts and where leads go", "wconvert"),
      icon: Plug,
    },
    {
      id: "data",
      label: __("Data & privacy", "wconvert"),
      description: __("Retention and personal data", "wconvert"),
      icon: Shield,
    },
  ] as const;
  return (
    <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <nav
        aria-label={__("Settings categories", "wconvert")}
        className="rounded-md border border-border bg-card p-2"
      >
        {categories.map(({ id, label, description, icon: Icon }) => (
          <a
            key={id}
            href={settingsHref(id)}
            aria-current={id === group ? "page" : undefined}
            className={`flex gap-3 rounded-sm p-3 focus-visible:outline-2 focus-visible:outline-ring ${id === group ? "bg-secondary text-primary" : "text-foreground hover:bg-muted"}`}
          >
            <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0">
              <span className="block font-medium">{label}</span>
              <span className="mt-1 block text-note text-muted-foreground">
                {description}
              </span>
            </span>
          </a>
        ))}
      </nav>
      <div className="min-w-0">
        {group === "experience" && (
          <SiteAllowance onEditingStateChange={onEditingStateChange} />
        )}
        {group === "connections" && (
          <Destinations
            destinationId={destinationId}
            onEditingStateChange={onEditingStateChange}
          />
        )}
        {group === "data" && (
          <div className="flex flex-col gap-4">
            <LeadRetention
              expanded
              onEditingStateChange={onEditingStateChange}
            />
            <Region>
              <RegionHeader
                title={__("Export and personal data", "wconvert")}
              />
              <RegionBody className="flex flex-col gap-4">
                <div>
                  <h3 className="m-0 text-body font-medium">
                    {__("Export submissions", "wconvert")}
                  </h3>
                  <p className="my-1 text-note text-muted-foreground">
                    {__(
                      "Choose the relevant records and dates in Leads.",
                      "wconvert",
                    )}
                  </p>
                  <a
                    className="text-note underline underline-offset-2"
                    href="#leads"
                  >
                    {__("Go to Leads", "wconvert")}
                  </a>
                </div>
                <div className="border-t border-border pt-4">
                  <h3 className="m-0 text-body font-medium">
                    {__("Personal data requests", "wconvert")}
                  </h3>
                  <p className="my-1 text-note text-muted-foreground">
                    {__(
                      "Use WordPress’s existing tools for requests. Copies at other services are managed there.",
                      "wconvert",
                    )}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-note">
                    <a
                      className="underline underline-offset-2"
                      href="export-personal-data.php"
                    >
                      {__("Export personal data", "wconvert")}
                    </a>
                    <a
                      className="underline underline-offset-2"
                      href="erase-personal-data.php"
                    >
                      {__("Erase personal data", "wconvert")}
                    </a>
                  </div>
                </div>
              </RegionBody>
            </Region>
          </div>
        )}
      </div>
    </div>
  );
}
