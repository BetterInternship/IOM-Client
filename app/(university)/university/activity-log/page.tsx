"use client";

import { useState } from "react";
import { useUniversityProfile } from "@/app/providers/university-profile.provider";
import { useUniversityControllerGetAuditLog } from "@/app/api";
import { PageContainer, PageHeader } from "@/components/page-header";
import { ActivityLogTable } from "@/components/university/activity-log-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export default function ActivityLogPage() {
  const { account } = useUniversityProfile();
  const [includeSignIns, setIncludeSignIns] = useState(false);

  const { data, isLoading } = useUniversityControllerGetAuditLog(
    { limit: 100, includeSignIns },
    { query: { enabled: !!account } },
  );

  const logs = data?.logs ?? [];

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Activity Log"
        description="Review your institution's activity."
      >
        <Label htmlFor="include-sign-ins" className="font-normal">
          <Checkbox
            id="include-sign-ins"
            checked={includeSignIns}
            onCheckedChange={(checked) => setIncludeSignIns(checked === true)}
          />
          Show sign-ins
        </Label>
      </PageHeader>
      <ActivityLogTable logs={logs} isLoading={isLoading} />
    </PageContainer>
  );
}
