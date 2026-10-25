import type { Template } from '@renderer/types';
import { DesignStage } from '../stage/DesignStage';

/**
 * The saved design at the stage's thumb size (ADR 0170), drawn through the same
 * `Preview` as the editor — coupon space, phone field and format surface
 * included. No loader, capture or tracking.
 */
export default function CampaignDesign({ template, displayType }: { template: Template; displayType: string }) {
  return <DesignStage size="thumb" displayType={displayType} source={{ live: { template } }} />;
}
